# csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Noddy1012/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Noddy1012/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast, dependency-free drop-in replacement for csv-reader 1.0.0's `readCsv`,
entered in make.fun's “Read broken CSV files faster, 21 November 2026” bounty.
`main.ts` is the house driver; `solve.js` exports `run(input) -> {columns, rows, errors}`
and returns answers identical to the reference implementation for every input —
including its broken-CSV quirks (stray CRs, quote junk, unterminated quotes,
short/long rows) — produced by indexOf-driven scanning and slice-based field
extraction instead of per-character reads.

## Run it

```sh
# Node 22+. Reads $MAKEFUN_INPUT_DIR/cases.json ([{id, input}, ...]) and
# writes $MAKEFUN_OUTPUT_DIR/answers.json, one answer per case, in order.
# Outside the harness container the two variables stand in for /input and /output.
MAKEFUN_INPUT_DIR=/path/to/input MAKEFUN_OUTPUT_DIR=/path/to/output node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
