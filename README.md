# news-image-20261123 — The World in One Day

[![make.fun · news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/jamete21/news-image-20261123/rank.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/jamete21/news-image-20261123/reward.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)

A newspaper front page that sums up the world's news of **Monday 23 November 2026** in one 1024×1024 image:

- **Top story — Iran war widens:** tankers attacked in the Strait of Hormuz, Iran hits Bahrain as a U.S. blockade looms.
- **Ukraine:** sea drones sink the Russian corvette Merkury off Libya; a Russian strike kills 15 near Kyiv.
- **Climate:** COP31 ends with no deal — the longest climate summit ever.
- **Gaza:** 99% of Gaza left toxic, a report says; settler arson condemned.
- **America:** 1,600 flights delayed in Thanksgiving travel chaos; Trump ends the penny after 232 years.
- **Sport:** Alcaraz wins the ATP Finals.
- **Markets:** stocks slide on AI fears.

## How it works

`main.ts` (Node 22, standard library only) draws the whole page itself: a hand-built single-stroke font, a small software rasteriser, and a hand-rolled PNG encoder (zlib from the Node standard library). No network, no downloaded images, no dependencies — and fully deterministic, so both grader runs write byte-identical output.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png (1024x1024, under 1 MiB)
```

## License

MIT — see [LICENSE](LICENSE).
