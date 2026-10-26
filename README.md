# Realloc — PR LOC Breakdown

A Chrome extension (Manifest V3) that adds granular line-of-code stats to **Bitbucket Cloud** and **GitHub** pull requests. Instead of just `+100 -23`, it breaks out added/removed lines by category:

- **Test files** — files matching `tests?/`, `specs?/`, `__tests__/`, `androidTest/`, `testFixtures/`, `*.test.*`, `*.spec.*`, `*Test.kt`, `*Test.java`
- **Documentation** — Markdown/reStructuredText files plus `README*`, `LICENSE*`, `CHANGELOG*`
- **Comment lines** — lines that are code comments (`//`, `/* */`, `#`, `--`, `<!-- -->`, Python docstrings, shebangs)
- **Code** — everything else (non-test, non-documentation, non-comment)

The categories are mutually exclusive and always sum to the PR total.

It detects comment syntax per language, with first-class support for React Native/TypeScript and Android/Kotlin/Java projects. The registry also covers Python, Ruby, Go, Rust, Swift, C/C++, C#, PHP, SQL, HTML/XML, YAML, Gradle, shell, and more.

## What it shows

On a pull request page it renders:

- A **summary card** at the top with a Total + `Test` / `Documentation` / `Comment` / `Code` breakdown and a stacked bar showing the percentage of added lines per category.
- An expandable **per-file table** with each file's `+/-`, comment `+/-`, and a `TEST`/`DOC` tag.
- An inline **chip** next to the provider's own `+N -M` diff summary (Bitbucket "Lines updated" / GitHub diffstat).

## Install in Chrome

1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select this folder.
5. Open a Bitbucket Cloud or GitHub pull request.

## How it works

The extension fetches the unified diff from the same origin, using your existing browser session — no OAuth or token setup:

- Bitbucket: `{origin}/!api/2.0/repositories/{workspace}/{repo}/pullrequests/{id}/diff`
- GitHub: `{origin}/{owner}/{repo}/pull/{id}.diff`

The diff is fetched by the extension's background service worker (so cross-origin redirects such as GitHub's `patch-diff.githubusercontent.com` work), then parsed locally by the provider-agnostic parser. Results are cached per PR in `sessionStorage` for 15 minutes. The content script watches SPA navigation (including GitHub Turbo) and re-injects the panel on tab changes.

For GitHub, the `.diff` endpoint uses your signed-in session; private repositories work as long as you are logged in.

## Project layout

```
manifest.json           Extension manifest (MV3, content scripts)
src/languages.js        Language registry: extensions/filenames -> comment syntax
src/parser.js           Unified diff parser + classification (browser and Node)
src/cache.js            sessionStorage cache with TTL
src/net.js              Content -> background fetch bridge
src/background.js       Extension service worker/network proxy
src/providers/
  bitbucket.js          Bitbucket URL parsing, diff fetching, DOM anchors
  github.js             GitHub URL parsing, diff fetching, DOM anchors
  index.js              Provider detection registry
src/ui.js               Provider-agnostic panel, bar graph, table, inline chips
src/content.js          Orchestration: detect provider, load/cache data, render
icons/                  Extension icons (16/48/128)
fixtures/               Sample diffs + expected output for tests
scripts/verify.cjs      Offline test runner
scripts/gen-icons.py    Regenerates the icons (no PIL needed)
```

## Development

Run the offline tests (no browser needed):

```sh
node scripts/verify.cjs
```

The tests parse each `fixtures/*.diff` file, assert per-file counts and category summaries, and also verify provider URL handling, GitHub diff URLs, Android test detection, and language lookup.

To add a parser case, drop a `mycase.diff` in `fixtures/` plus a matching `mycase.json` with the expected `added`/`removed`/`commentsAdded`/`commentsRemoved`/`isTest`/`isDoc` per file and a `summary` block (see existing fixtures for the shape).

Regenerate icons if you change `scripts/gen-icons.py`:

```sh
python3 scripts/gen-icons.py
```

Reload the extension at `chrome://extensions` after editing content scripts.

## Adding a provider

A provider is a small object in `src/providers/` with this interface:

```js
{
  id, label,                       // "github", "GitHub"
  matches(url),                    // does this provider handle the URL?
  parseLocation(url),              // -> { provider, owner, repo, id }
  isDiffPage(loc, url),            // should the inline chip be shown?
  diffUrl(loc, origin),            // unified diff URL
  fetchDiff(loc, origin),          // -> Promise<string>
  anchor(loc),                     // element to prepend the panel to
  summaryClusters()                // elements next to which to put the chip
}
```

Then add it to `src/providers/index.js`, load it before the index in `manifest.json`, and extend the `matches` / `host_permissions` entries.

## Adding a language

Languages live in the registry in `src/languages.js`. Add an entry:

```js
Realloc.languages.register({
  id: 'my-language',
  name: 'My Language',
  extensions: ['ml'],
  filenames: [],                  // e.g. ['Makefile']
  line: ['//'],                   // line-comment prefixes
  block: [{ open: '/*', close: '*/' }]
});
```

The parser resolves the file extension (including compound extensions such as `build.gradle.kts`) and uses the returned token set when classifying comments. Test-file and documentation heuristics live in `src/parser.js`.

## Known limitations

- Very large PRs may be truncated by a provider's diff endpoint.
- GitHub's `.diff` endpoint and Bitbucket's diff API can omit generated/binary files.
- Comment detection is heuristic (e.g. Python docstrings are treated as comments); it is good enough for rough PR stats, not a strict linter.
