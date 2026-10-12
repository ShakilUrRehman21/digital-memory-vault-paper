#!/usr/bin/env bash
# Reproduces every result in the paper from a clean database.
#
# Builds the baseline implementation (baseline/, with a node-postgres database client) and the revised application
# (app/), starts both, and runs the functional, simulation, performance, metamorphic, property-based, mutation and
# real-data experiments. Results are written to evaluation/results/.
#
# Requirements: Node.js >= 22.18, a PostgreSQL 16 server (docker compose -f evaluation/docker-compose.yml up -d
# starts one), and the psql client. Optional: taskset (util-linux) to pin the servers and the database to CPU 0 and
# the load generators to CPU 1, as in the paper (PIN_CPUS=1).
#
# Usage (from the repository root):  PGURL=postgres://postgres:postgres@localhost:5432 evaluation/run-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVAL="$ROOT/evaluation"
WORK="${WORK_DIR:-$(mktemp -d -t dmv-eval-XXXXXX)}"  # outside the repository, so the app build does not see it
PGURL="${PGURL:-postgres://postgres@localhost:5432}"
PIN_CPUS="${PIN_CPUS:-1}"
SKIP_MUTATION="${SKIP_MUTATION:-0}"
SERVER_CPU=""; CLIENT_CPU=""
if [[ "$PIN_CPUS" == "1" ]] && command -v taskset >/dev/null && [[ "$(nproc)" -ge 2 ]]; then
  SERVER_CPU="taskset -c 0"; CLIENT_CPU="taskset -c 1"
fi
PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

log() { printf '\n=== %s\n' "$*"; }
wait_for() { for _ in $(seq 1 60); do curl -s -o /dev/null "$1" && return 0; sleep 1; done; echo "timeout waiting for $1"; exit 1; }

log "Installing kit dependencies"
(cd "$EVAL" && npm ci --no-audit --no-fund >/dev/null)

log "Preparing databases"
for db in dmv_eval_baseline dmv_eval_revised; do
  psql "$PGURL/postgres" -qc "drop database if exists $db" -c "create database $db"
done

mkdir -p "$WORK"
secret() { node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'; }
build() {  # $1 = label, $2 = source directory
  log "Building $1 ($2)"
  rm -rf "$WORK/$1"; mkdir -p "$WORK/$1"
  (cd "$ROOT/$2" && tar --exclude=node_modules --exclude=.next --exclude=.env.local -cf - .) | (cd "$WORK/$1" && tar -xf -)
  (cd "$WORK/$1" && npm ci --no-audit --no-fund >/dev/null)
  printf 'DATABASE_URL=%s/dmv_eval_%s\nJWT_SECRET=%s\n' "$PGURL" "$1" "$(secret)" > "$WORK/$1/.env.local"
}
build baseline baseline
# The baseline targets Neon's serverless driver; locally it uses node-postgres through a seven-line client.
cp "$EVAL/baseline-rules/lib-db-index.local.ts" "$WORK/baseline/lib/db/index.ts"
(cd "$WORK/baseline" && npm install --no-save --no-audit --no-fund pg@8 >/dev/null)
build revised app
for v in baseline revised; do (cd "$WORK/$v" && npx drizzle-kit push --force >/dev/null && npx next build > "$WORK/$v-build.log" 2>&1); done

log "Starting servers"
# Direct instances (3101, 3102) and instances behind the counting/delay proxy (3111, 3112).
proxy_url() { echo "$PGURL" | sed -E "s#:[0-9]+\$#:$1#"; }
i=0
for v in baseline revised; do
  i=$((i+1))
  (cd "$EVAL" && LISTEN_PORT=610$i TARGET_PORT="${PGURL##*:}" CONTROL_PORT=710$i $CLIENT_CPU node performance/pg-proxy.mjs > "$WORK/proxy-$v.log" 2>&1) & PIDS+=($!)
  (cd "$WORK/$v" && NODE_ENV=production $SERVER_CPU npx next start -p 310$i > "$WORK/server-$v.log" 2>&1) & PIDS+=($!)
  (cd "$WORK/$v" && NODE_ENV=production DATABASE_URL="$(proxy_url 610$i)/dmv_eval_$v" $SERVER_CPU npx next start -p 311$i > "$WORK/server-proxied-$v.log" 2>&1) & PIDS+=($!)
done
for p in 3101 3102 3111 3112; do wait_for "http://localhost:$p/"; done

run() { (cd "$EVAL" && $CLIENT_CPU node --no-warnings "$@"); }
i=0
for v in baseline revised; do
  i=$((i+1))
  export LABEL=$v RESULTS_DIR="$EVAL/results/$v" DATABASE_URL="$PGURL/dmv_eval_$v" VERSION=$v
  log "$v: functional tests";            BASE_URL=http://localhost:310$i run functional/functional.mjs | tail -1
  log "$v: simulation through the API";  BASE_URL=http://localhost:310$i run scores/differential.mjs | tail -1
  log "$v: latency";                     BASE_URL=http://localhost:310$i run performance/latency.mjs | grep '^n='
  log "$v: statement counts";            BASE_URL=http://localhost:311$i PROXY_CONTROL=http://127.0.0.1:710$i LABEL=$v-proxied REPS=5 SIZES=20,100,500 run performance/latency.mjs | grep '^n='
  log "$v: load";                        for n in 100 500; do BASE_URL=http://localhost:310$i N=$n run performance/load.mjs; done
  log "$v: network round trips";         BASE_URL=http://localhost:311$i PROXY_CONTROL=http://127.0.0.1:710$i N=100 run performance/network.mjs
done
unset VERSION

export RESULTS_DIR="$EVAL/results/offline"
log "Unit, property-based and metamorphic tests"; (cd "$EVAL" && FC_RUNS=1000 node --no-warnings --test tests/*.test.mjs | grep -E '^# (tests|pass|fail)')
log "Metamorphic relations, baseline and revised";   run scores/metamorphic.mjs | tail -3
log "Detection power";                        run scores/power.mjs | grep -A7 'minimum history'
log "Real-data replay (ForecastBench)";       run scores/replay.mjs | grep rho
if [[ "$SKIP_MUTATION" != "1" ]]; then
  log "Mutation testing"
  cp "$ROOT/app/lib/analytics/scores.ts" "$WORK/scores.ts.bak"
  for c in 1-worked 2-metamorphic 3-property 4-full 5-examples-only; do
    (cd "$ROOT" && FC_RUNS=100 "$EVAL/node_modules/.bin/stryker" run "evaluation/mutation/stryker.$c.json" 2>&1 | grep 'All files' | sed "s/^/$c /")
  done
  cmp -s "$ROOT/app/lib/analytics/scores.ts" "$WORK/scores.ts.bak" || { echo "scores.ts was not restored"; exit 1; }
fi
log "Dependency audit";  for v in baseline revised; do (cd "$WORK/$v" && npm audit --omit=dev --package-lock-only --json > "$EVAL/results/$v/npm-audit-$v.json" 2>/dev/null || true); done

cleanup; trap - EXIT
log "Done. Results are in evaluation/results/. Summarise with: node evaluation/summarise.mjs"
