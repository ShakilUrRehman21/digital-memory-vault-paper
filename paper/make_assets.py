"""Builds the manuscript's data tables (tab_*.tex) and charts (Fig3-Fig5) from evaluation/results."""
import json, os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

RES = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "evaluation", "results")
OUT = os.path.dirname(os.path.abspath(__file__))
def load(*p):
    with open(os.path.join(RES, *p)) as f:
        return json.load(f)
def write(name, text):
    with open(os.path.join(OUT, name), "w") as f:
        f.write(text)

# ---------------------------------------------------------------- tables
S = load("summary.json")
areas = ["Authentication", "Route protection", "Access control", "Decision logging", "Outcome recording", "Prediction integrity", "Analytics", "Report export"]
rows = []
for a in areas:
    b = S["baseline"]["byArea"].get(a, {"tests": 0, "passed": 0}); r = S["revised"]["byArea"].get(a, {"tests": 0, "passed": 0})
    rows.append(f"{a} & {b['tests']} & {b['passed']} & {r['passed']}\\\\")
f1, f2 = S["baseline"]["functional"], S["revised"]["functional"]
write("tab_functional.tex", "\\begin{tabular}{@{}lccc@{}}\n\\toprule\nArea & Tests & Passed, baseline & Passed, revised\\\\\n\\midrule\n" + "\n".join(rows) +
      f"\n\\midrule\nCore tests (TC01--TC33) & 33 & {f1['core']['passed']} & {f2['core']['passed']}\\\\\nSafeguard tests (TC34--TC46) & 13 & {f1['safeguard']['passed']} & {f2['safeguard']['passed']}\\\\\nTotal & 46 & {f1["all"]["passed"]} & {f2["all"]["passed"]}\\\\\n\\botrule\n\\end{{tabular}}\n")

lr = []
for n in ["100", "500"]:
    for v, lab in [("baseline", "Baseline"), ("revised", "Revised")]:
        x = S[v]["load"][n]
        lr.append(f"{n} & {lab} & {x['requests']:,} & {x['throughput']:.1f} & {x['median']:,.1f} & {x['p95']:,.1f} & {x['errors']}\\\\")
write("tab_load.tex", "\\begin{tabular}{@{}llrrrrr@{}}\n\\toprule\nDecisions & Implementation & Requests & Requests/s & Median (ms) & 95th pct.\\ (ms) & Errors\\\\\n\\midrule\n" + "\n".join(lr) + "\n\\botrule\n\\end{tabular}\n")

mr = S["metamorphic"]
ids = ["MR1", "MR2a", "MR2b", "MR3", "MR4", "MR5", "MR6", "MR7", "MR8", "MR9"]
keys = [("decisionAccuracyScore", "DA"), ("confidenceCalibrationScore", "CC"), ("riskCalibrationScore", "RC"), ("emotionalBiasScore", "EB")]
def cell(i, v, k):
    r = [x for x in mr if x["id"] == i and x["version"] == v and x["score"] == k]
    return "--" if not r else (f"{100*r[0]['rate']:.1f}" if r[0]['rate'] not in (0, 1) else ("0" if r[0]['rate'] == 0 else "100"))
mrows = [f"{i} & " + " & ".join(cell(i, "baseline", k) for k, _ in keys) + " & " + " & ".join(cell(i, "revised", k) for k, _ in keys) + "\\\\" for i in ids]
write("tab_mr.tex", "\\footnotesize\n\\begin{tabular}{@{}lcccccccc@{}}\n\\toprule\n & \\multicolumn{4}{c}{Baseline rules} & \\multicolumn{4}{c}{Revised rules}\\\\\n\\cmidrule(lr){2-5}\\cmidrule(l){6-9}\nRelation & DA & CC & RC & EB & DA & CC & RC & EB\\\\\n\\midrule\n" + "\n".join(mrows) + "\n\\botrule\n\\end{tabular}\n")

sim_rows = []
prof = ["Calibrated", "Overconfident", "Underconfident", "Inconsistent"]
for p in prof:
    a, b = S["baseline"]["diff"]["summary"][p], S["revised"]["diff"]["summary"][p]
    f = lambda d, k: f"{d[k]['mean']:.1f} ({d[k]['sd']:.1f})"
    sim_rows.append(f"{p} & {a['meanGap']['mean']:+.1f} & {f(a,'decisionAccuracyScore')} & {f(a,'confidenceCalibrationScore')} & {f(a,'riskCalibrationScore')} & {f(b,'confidenceCalibrationScore')} & {f(b,'riskCalibrationScore')}\\\\".replace("+-", "$-$").replace("-", "$-$") if False else
                    f"{p} & {0.0 if abs(a['meanGap']['mean']) < 0.05 else a['meanGap']['mean']:.1f} & {f(a,'decisionAccuracyScore')} & {f(a,'confidenceCalibrationScore')} & {f(a,'riskCalibrationScore')} & {f(b,'confidenceCalibrationScore')} & {f(b,'riskCalibrationScore')}\\\\")
sim_rows = [r.replace(" -", " $-$") for r in sim_rows]
write("tab_sim.tex", "\\footnotesize\n\\begin{tabular}{@{}lrcccccc@{}}\n\\toprule\n & Mean gap & Accuracy & \\multicolumn{2}{c}{Baseline rules} & \\multicolumn{2}{c}{Revised rules}\\\\\n\\cmidrule(lr){4-5}\\cmidrule(l){6-7}\nProfile & (steps) & (both) & CC & RC & CC & RC\\\\\n\\midrule\n" + "\n".join(sim_rows) + "\n\\botrule\n\\end{tabular}\n")

def m(x):
    return f"{x:.2f}".replace("-", "$-$")
cr = []
for c in S["replay"]["correlations"]:
    cr.append(f"{c['score'].replace('baseline', 'Baseline').replace('revised', 'Revised')} & {c['reference'].replace('|calibration-in-the-large|', '$|$calibration-in-the-large$|$')} & {m(c['rho'])} & [{m(c['ci95'][0])}, {m(c['ci95'][1])}]\\\\")
write("tab_replay.tex", "\\footnotesize\n\\begin{tabular}{@{}L{4.0cm}L{3.6cm}rl@{}}\n\\toprule\nScore & Reference measure & $\\rho$ & 95\\% CI\\\\\n\\midrule\n" + "\n".join(cr) + "\n\\botrule\n\\end{tabular}\n")

dr = []
for d in S["replay"]["distortion"]:
    r = d["results"]
    vals = " & ".join(f"{100*r[k]['agreement']:.0f}" for k in ["baseline confidence calibration", "baseline risk calibration", "revised confidence calibration", "revised risk calibration"])
    name = d["name"].replace("p + 0.2", "$p+0.2$").replace("p - 0.2", "$p-0.2$").replace("market - 0.2, event + 0.2", "market $-0.2$, event $+0.2$")
    dr.append(f"{d['id']} & {name} & {vals}\\\\")
write("tab_dist.tex", "\\footnotesize\n\\begin{tabular}{@{}lL{4.6cm}cccc@{}}\n\\toprule\n & & \\multicolumn{2}{c}{Baseline rules} & \\multicolumn{2}{c}{Revised rules}\\\\\n\\cmidrule(lr){3-4}\\cmidrule(l){5-6}\n & Distortion & CC & RC & CC & RC\\\\\n\\midrule\n" + "\n".join(dr) + "\n\\botrule\n\\end{tabular}\n")

mt = S["mutation"]
labels = [("1-worked", "Worked-example check"), ("2-metamorphic", "+ metamorphic tests"), ("3-property", "+ property-based tests"), ("4-full", "+ example-based unit tests (full suite)"), ("5-examples-only", "Worked-example check + example-based unit tests only")]
mr_ = [f"{lab} & {mt[k]['killed']} & {mt[k]['mutants']-mt[k]['killed']} & {mt[k]['score']:.1f}\\\\" for k, lab in labels if k in mt]
write("tab_mut.tex", "\\footnotesize\n\\begin{tabular}{@{}L{6.4cm}rrr@{}}\n\\toprule\nTest set & Killed & Survived & Score (\\%)\\\\\n\\midrule\n" + "\n".join(mr_) + "\n\\botrule\n\\end{tabular}\n")

# ---------------------------------------------------------------- figures
for fp in ["/usr/share/fonts/truetype/freefont/FreeSans.ttf", "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"]:
    if os.path.exists(fp):
        font_manager.fontManager.addfont(fp)
plt.rcParams.update({"font.family": "FreeSans", "font.size": 8, "axes.labelsize": 8, "xtick.labelsize": 7.5, "ytick.labelsize": 7.5,
                     "legend.fontsize": 7.5, "axes.linewidth": 0.6, "pdf.fonttype": 42, "ps.fonttype": 42,
                     "axes.spines.top": False, "axes.spines.right": False})
MM = 1 / 25.4
C1, C2 = "#555555", "#000000"   # grey (baseline) and black (revised): legible in black-and-white print

def panel_label(ax, s):
    ax.text(-0.16, 1.04, s, transform=ax.transAxes, fontsize=9, fontweight="bold", va="bottom")

# Fig 3: latency vs n, latency vs RTT
lat = {v: load(v, f"latency-{v}.json") for v in ["baseline", "revised"]}
net = {v: load(v, f"network-{v}-n100.json") for v in ["baseline", "revised"]}
fig, axes = plt.subplots(1, 2, figsize=(131 * MM, 55 * MM))
ax = axes[0]
for v, col, mk, ls, lab in [("baseline", C1, "o", "--", "Baseline"), ("revised", C2, "s", "-", "Revised")]:
    ns = sorted(int(n) for n in lat[v]["analyticsByN"])
    med = [lat[v]["analyticsByN"][str(n)]["median"] for n in ns]
    p95 = [lat[v]["analyticsByN"][str(n)]["p95"] for n in ns]
    ax.errorbar(ns, med, yerr=[[0] * len(ns), [p - m for p, m in zip(p95, med)]], color=col, marker=mk, ms=3.5, ls=ls, lw=1, capsize=2, elinewidth=0.6,
                label=lab, mfc="white" if v == "baseline" else col)
ax.set_xscale("log"); ax.set_yscale("log")
ax.set_xlabel("Resolved decisions per user"); ax.set_ylabel("Analytics response time (ms)")
ax.set_xticks([10, 50, 100, 250, 500, 1000]); ax.set_xticklabels(["10", "50", "100", "250", "500", "1,000"])
ax.legend(frameon=False, loc="upper left"); panel_label(ax, "(a)")
ax = axes[1]
for v, col, mk, ls, lab in [("baseline", C1, "o", "--", "Baseline"), ("revised", C2, "s", "-", "Revised")]:
    rt = sorted(int(r) for r in net[v]["byRtt"])
    base = net[v]["byRtt"]["0"]["analytics"]["median"]
    ax.plot(rt, [net[v]["byRtt"][str(r)]["analytics"]["median"] - base for r in rt], color=col, marker=mk, ms=3.5, ls=ls, lw=1, label=lab, mfc="white" if v == "baseline" else col)
ax.set_xlabel("Database round-trip time (ms)"); ax.set_ylabel("Increase over zero delay (ms)"); ax.set_ylim(bottom=0)
ax.set_xticks([0, 2, 5, 10, 20]); panel_label(ax, "(b)")
fig.tight_layout(w_pad=2.5)
fig.savefig(os.path.join(OUT, "Fig3.pdf")); plt.close(fig)

# Fig 4: detection power
pw = load("offline", "power.json")
L = pw["lengths"]
fig, axes = plt.subplots(1, 3, figsize=(131 * MM, 58 * MM), sharey=True)
for ax, (prof, lab) in zip(axes, [("Overconfident (+1)", "(a)"), ("Inconsistent (+/-2)", "(b)"), ("Noisy (SD 2)", "(c)")]):
    for score, col, mk, ls, filled, name in [("baseline confidence calibration", C1, "o", "--", False, "baseline confidence calibration"),
                                             ("baseline risk calibration", C1, "s", "--", False, "baseline risk calibration"),
                                             ("revised confidence calibration", C2, "o", "-", True, "revised confidence calibration"),
                                             ("revised risk calibration", C2, "s", "-", True, "revised risk calibration")]:
        y = [next(r["auc"] for r in pw["rows"] if r["n"] == n and r["profile"] == prof and r["score"] == score) for n in L]
        ax.plot(L, y, color=col, marker=mk, ms=3, ls=ls, lw=0.9, mfc=col if filled else "white", label=name)
    ax.axhline(0.5, color="#555", lw=0.5, ls=":")
    ax.set_xscale("log"); ax.set_xticks([5, 10, 20, 40, 120]); ax.set_xticklabels(["5", "10", "20", "40", "120"])
    ax.set_ylim(0.45, 1.02); ax.set_xlabel("Decisions"); panel_label(ax, lab)
axes[0].set_ylabel("AUC")
h, l = axes[0].get_legend_handles_labels()
fig.legend(h, l, loc="lower center", ncol=2, frameon=False, bbox_to_anchor=(0.5, -0.01), handlelength=2.8, columnspacing=2.5)
fig.tight_layout(rect=(0, 0.17, 1, 1), w_pad=1.2)
fig.savefig(os.path.join(OUT, "Fig4.pdf")); plt.close(fig)

# Fig 5: replay scatter
rp = load("offline", "replay.json")["perForecaster"]
fig, axes = plt.subplots(1, 2, figsize=(131 * MM, 55 * MM))
for ax, (sk1, sk2, ref, xl, lab) in zip(axes, [("baselinecc", "revisedcc", "ece", "Expected calibration error", "(a)"), ("baselinerc", "revisedrc", "dce", "Domain-conditional calibration error", "(b)")]):
    ax.scatter([r[ref] for r in rp], [r[sk1] for r in rp], s=12, facecolors="white", edgecolors=C1, linewidths=0.8, marker="o", label="Baseline rules")
    ax.scatter([r[ref] for r in rp], [r[sk2] for r in rp], s=11, color=C2, marker="s", label="Revised rules")
    ax.set_xlabel(xl); ax.set_ylabel("Confidence calibration score" if sk1 == "baselinecc" else "Risk calibration score"); panel_label(ax, lab)
axes[0].legend(frameon=False, loc="lower left")
fig.tight_layout(w_pad=2.5)
fig.savefig(os.path.join(OUT, "Fig5.pdf")); plt.close(fig)
print("assets written")
