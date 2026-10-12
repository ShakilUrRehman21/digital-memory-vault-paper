# Paper source

- `main.tex`, `references.tex`: manuscript (Software Testing, Verification and Reliability, free-format submission).
- `numbers.tex`: copy of `../evaluation/results/numbers.tex`; every number in the text is one of these macros.
- `tab_*.tex`, `Fig3-5.pdf`: built from `../evaluation/results/` by `make_assets.py` (Python 3, matplotlib).
- `Fig1.pdf`, `Fig2.pdf`: diagrams, built from `figsrc/*.svg` by `render_diagrams.py` (Playwright).
- `gtoc.tex`, `GTOC_figure.*`: graphical table of contents (`make_gtoc.py`).
- `Main_Document.pdf`, `Graphical_TOC.pdf`: compiled outputs.

Build: `python3 make_assets.py && python3 make_gtoc.py && pdflatex main.tex` (three times) and `pdflatex gtoc.tex`.
