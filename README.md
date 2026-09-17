# Bitbucket PR LOC Breakdown

A Chrome extension (Manifest V3) that adds granular line-of-code stats to Bitbucket Cloud pull requests. Instead of just `+100 -23`, it breaks out added/removed lines by category:

- **Test files** — files matching `tests/`, `specs/`, `__tests__/`, `*.test.*`, `*.spec.*`
- **Documentation** — `.md`, `.markdown`, `.mdx`, `.rst`, and any `README*` file
- **Comment lines** — lines that are code comments (`//`, `/* */`, `#`, `--`, `<!-- -->`, Python docstrings, shebangs)
- **Code** — everything else (non-test, non-documentation, non-comment)

The categories are mutually exclusive and always sum to the PR total.

## What it shows

On the PR diff page it renders:

- A **summary card** at the top of the page with a Total + `Test` / `Documentation` / `Comment` / `Code` breakdown and a stacked bar showing the percentage of added lines per category.
- An expandable **per-file table** with each file's `+/-`, comment `+/-`, and a `TEST`/`DOC` tag.
- An inline **chip** next to Bitbucket's `+N -M` "Lines updated" summary.
- Small **badges** on rows in the diff file list for test/doc/comment files.

## Install in Chrome

1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select this folder.
5. Open a Bitbucket Cloud PR diff page.

## How it works

The extension gets the data from Bitbucket's same-origin internal API, so it uses your existing Bitbucket session — no OAuth, no extra auth setup:

```
{pageOrigin}/!api/2.0/repositories/{workspace}/{repo}/pullrequests/{id}/diff
```

The unified diff is parsed locally in `parser.js` and results are cached per PR (in-memory + `sessionStorage`, 15 min TTL). The UI in `content.js` watches the SPA and re-injects on tab navigation.

## Project layout

```
manifest.json    Extension manifest (MV3, content scripts)
parser.js        Unified diff parser + classification (works in browser and Node)
content.js       Fetch, cache, render the panel, chips, and badges
icons/           Extension icons (16/48/128)
fixtures/        Sample diffs + expected output for tests
scripts/verify.cjs   Offline test runner
scripts/gen-icons.py  Regenerates the icons (no PIL needed)
```

## Development

Run the offline tests (no browser needed):

```sh
node scripts/verify.cjs
```

The tests parse each `fixtures/*.diff` file, assert per-file counts and category summaries, and print `PASS`/`FAIL`.

To add a case, drop a `mycase.diff` in `fixtures/` plus a matching `mycase.json` with the expected `added`/`removed`/`commentsAdded`/`commentsRemoved`/`isTest`/`isDoc` per file and a `summary` block (see existing fixtures for the shape).

Regenerate icons if you change `scripts/gen-icons.py`:

```sh
python3 scripts/gen-icons.py
```

Reload the extension at `chrome://extensions` after editing content scripts.

## Known limitations

- Very large PRs may be truncated by Bitbucket's diff API.
- Comment detection is heuristic (e.g. Python docstrings are treated as comments); it is good enough for rough PR stats, not a strict linter.
- Per-file row badges rely on Bitbucket's `a[href="#chg-{path}"]` anchors in the diff file list.