import json, os, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
font_manager.fontManager.addfont("/usr/share/fonts/truetype/freefont/FreeSans.ttf")
plt.rcParams.update({"font.family": "FreeSans", "font.size": 7, "pdf.fonttype": 42, "axes.spines.top": False, "axes.spines.right": False, "axes.linewidth": 0.6})
c = {x["score"] + "|" + x["reference"]: abs(x["rho"]) for x in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "evaluation", "results", "summary.json")))["replay"]["correlations"]}
vals = [(c["baseline confidence calibration|ECE"], c["revised confidence calibration|ECE"]), (c["baseline risk calibration|domain calibration error"], c["revised risk calibration|domain calibration error"])]
MM = 1 / 25.4
fig, ax = plt.subplots(figsize=(50 * MM, 60 * MM))
x = [0, 1]
ax.bar([i - 0.19 for i in x], [v[0] for v in vals], 0.36, color="white", edgecolor="black", hatch="////", lw=0.6, label="Baseline rules")
ax.bar([i + 0.19 for i in x], [v[1] for v in vals], 0.36, color="black", label="Revised rules")
for i, (a, b) in enumerate(vals):
    ax.text(i - 0.19, a + 0.02, f"{a:.2f}", ha="center", fontsize=6.5); ax.text(i + 0.19, b + 0.02, f"{b:.2f}", ha="center", fontsize=6.5)
ax.set_xticks(x); ax.set_xticklabels(["Confidence\ncalibration", "Risk\ncalibration"])
ax.set_ylim(0, 1.42); ax.set_yticks([0, 0.5, 1.0])
ax.set_ylabel("Agreement with reference\nmeasure, |Spearman ρ|")
ax.set_title("39 real forecasters", fontsize=7)
ax.legend(frameon=False, loc="upper left", fontsize=6.5, handlelength=1.2)
fig.tight_layout(pad=0.3)
fig.savefig("GTOC_figure.pdf"); fig.savefig("GTOC_figure.png", dpi=600); fig.savefig("GTOC_figure.tif", dpi=600)
