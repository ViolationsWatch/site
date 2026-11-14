# Violations Watch

Source for **https://violationswatch.org**: an open log of reported violations of international humanitarian law (IHL) and international human rights law (IHRL), shared as leads for investigators, journalists and researchers.

Most entries are **unverified leads, not findings**. Each one records what was reported, by whom and when, with links to the original sources and archived copies where available.

## What's here

| File | What it is |
|---|---|
| `index.html` | The site: map, filterable incident log, method and corrections |
| `data.json` | The incident data the page loads (reviewed incidents last reported in the past 28 days) |
| `incidents.csv` | The same data as CSV (UTF-8 with BOM, one row per incident) |
| `world.json` | Country outlines for the map (Natural Earth via world-atlas, public domain) |
| `_headers` | Security and caching headers for Cloudflare Pages |

There is no build step: Cloudflare Pages serves the files as they are.

## How the data is updated

The data files are regenerated from the project's incident register every morning (about 05:40 UK time) and committed here, so the commit history is a public, dated record of every change. Incidents keep a permanent ID (`VW-YYYY-NNNN`); corrections update the entry rather than removing it silently.

## Citing

Cite incidents by their VW number and the date you accessed the site, for example: *Violations Watch, VW-2026-0041, accessed 14 Nov 2026, https://violationswatch.org*.

## Corrections and contact

violationswatch@proton.me — include the VW number, what is wrong and a source if you have one.

## Blog (not public yet)

The blog lives in `blog/`. It is **not deployed yet**: the line `blog` in `.assetsignore` keeps it off the live site. To publish it, delete that line (and add a "Blog" link to the top bar of `index.html`).

### Writing a post

1. Copy `blog/posts/_template.md` to a new file named `YYYY-MM-DD-short-title.md` in `blog/posts/`, e.g. `2026-12-01-sudan-hospitals.md`.
2. Fill in the front matter (title, date, summary, author, tags) and write the post in Markdown below it.
3. Commit. Cloudflare rebuilds the post list (`blog/posts.json`) automatically on every deploy.

Mention an incident number such as `VW-2026-0041` and it becomes a link to that incident. Put images in `blog/images/`.

`draft: true` hides a post from the public list (it can be previewed at `/blog/?drafts`). **This repository is public, so anything committed, drafts included, can be read on GitHub.** Write drafts elsewhere and commit only when ready to publish.
