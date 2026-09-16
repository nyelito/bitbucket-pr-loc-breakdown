(() => {
  'use strict';

  const P = globalThis.BBLocParser;
  if (!P) return;

  const ROOT_ID = 'bb-loc-stats-root';
  const STYLE_ID = 'bb-loc-stats-style';
  const CACHE_PREFIX = 'bb-loc-stats:';
  const CACHE_TTL_MS = 15 * 60 * 1000;

  const CSS = `
#${ROOT_ID}{font:400 13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#172b4d;background:#f5f6f7;border:1px solid #dfe3e8;border-radius:8px;padding:12px 14px;margin:12px 0;}
#${ROOT_ID} .bb-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}
#${ROOT_ID} .bb-title{font-weight:600;font-size:13px;color:#243547;}
#${ROOT_ID} .bb-refresh{font:600 11px/1 inherit;color:#0b57d0;background:none;border:0;cursor:pointer;padding:2px 6px;border-radius:4px;}
#${ROOT_ID} .bb-refresh:hover{background:#e8eef9;}
#${ROOT_ID} .bb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;}
#${ROOT_ID} .bb-metric{background:#fff;border:1px solid #e3e7ec;border-radius:6px;padding:6px 10px;}
#${ROOT_ID} .bb-num{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;}
#${ROOT_ID} .bb-lab{font-size:11px;color:#5e6c84;margin-top:1px;}
#${ROOT_ID} .bb-add{color:#1b7f1b;} #${ROOT_ID} .bb-del{color:#c73a3a;}
#${ROOT_ID} .bb-muted{color:#5e6c84;}
#${ROOT_ID} details{margin-top:10px;}
#${ROOT_ID} summary{cursor:pointer;font-size:12px;color:#0b57d0;font-weight:600;}
#${ROOT_ID} table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px;}
#${ROOT_ID} td,#${ROOT_ID} th{border-top:1px solid #e3e7ec;padding:3px 6px;text-align:right;white-space:nowrap;}
#${ROOT_ID} td:first-child,#${ROOT_ID} th:first-child{text-align:left;word-break:break-all;white-space:normal;}
#${ROOT_ID} th{color:#5e6c84;font-weight:600;}
#${ROOT_ID} .bb-tag{display:inline-block;font-size:10px;line-height:1;margin-left:6px;padding:2px 5px;border-radius:8px;background:#e0edfc;color:#0b57d0;font-weight:600;}
#${ROOT_ID} .bb-err{color:#c73a3a;}
.bb-loc-badge{display:inline-block;margin-left:8px;font:600 10px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#33691e;background:#e8f5e9;border-radius:8px;padding:0 6px;white-space:nowrap;pointer-events:none;vertical-align:middle;}
.bb-loc-inline{display:inline-block;margin-left:10px;font:600 11px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#4a5f7a;background:#fff;border:1px dashed #b3bfce;border-radius:10px;padding:1px 8px;white-space:nowrap;vertical-align:middle;}
.bb-loc-inline .bb-add{color:#1b7f1b;}
.bb-loc-inline .bb-del{color:#c73a3a;}
`;

  let lastData = null;
  let appendedBadges = [];

  function styleTag() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = CSS;
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  function parseLocation() {
    const m = /^\/?([^/]+)\/([^/]+)\/pull-requests\/(\d+)/.exec(location.pathname);
    if (!m) return null;
    return { workspace: m[1], repo: m[2], id: m[3] };
  }

  function dataKey(loc) {
    return loc.workspace + '/' + loc.repo + '/' + loc.id;
  }

  function isDiffPage() {
    return /\/pull-requests\/\d+\/diff($|\/)/.test(location.pathname);
  }

  function cacheGet(key) {
    try {
      const v = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!v) return null;
      const parsed = JSON.parse(v);
      if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, data) {
    try {
      const s = JSON.stringify({ at: Date.now(), data });
      if (s.length > 2 * 1024 * 1024) return;
      sessionStorage.setItem(CACHE_PREFIX + key, s);
    } catch (e) {
      /* storage full/unavailable */
    }
  }

  function cacheRemove(key) {
    try {
      sessionStorage.removeItem(CACHE_PREFIX + key);
    } catch (e) {}
  }

  async function fetchDiff(loc) {
    const url = location.origin +
      '/!api/2.0/repositories/' +
      encodeURIComponent(loc.workspace) + '/' +
      encodeURIComponent(loc.repo) + '/pullrequests/' +
      encodeURIComponent(loc.id) + '/diff';
    const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/plain' } });
    if (!res.ok) throw new Error('diff API returned HTTP ' + res.status);
    return await res.text();
  }

  function buildSummary(files) {
    let added = 0, removed = 0, cAdded = 0, cRemoved = 0;
    let tCount = 0, tAdded = 0, tRemoved = 0, tcAdded = 0, tcRemoved = 0;
    for (const f of files) {
      added += f.added; removed += f.removed;
      cAdded += f.commentsAdded; cRemoved += f.commentsRemoved;
      if (f.isTest) {
        tCount++;
        tAdded += f.added; tRemoved += f.removed;
        tcAdded += f.commentsAdded; tcRemoved += f.commentsRemoved;
      }
    }
    return {
      files,
      fileCount: files.length,
      testFileCount: tCount,
      added, removed,
      commentsAdded: cAdded, commentsRemoved: cRemoved,
      testAdded: tAdded, testRemoved: tRemoved,
      testCommentsAdded: tcAdded, testCommentsRemoved: tcRemoved,
      fetchedAt: Date.now()
    };
  }

  async function loadData(loc, force) {
    const key = dataKey(loc);
    if (!force) {
      const cached = cacheGet(key);
      if (cached) return cached;
    }
    const text = await fetchDiff(loc);
    const data = buildSummary(P.parseDiff(text));
    cacheSet(key, data);
    return data;
  }

  // ---------- DOM helpers ----------

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function num(v, kind) {
    const s = (v > 0 ? '+' : '') + String(v);
    return el('span', 'bb-num ' + kind, s);
  }

  function metric(lab, addV, remV, opts) {
    opts = opts || {};
    const wrap = el('div', 'bb-metric');
    const row = el('div', 'bb-line');
    row.appendChild(num(addV, 'bb-add'));
    if (remV) {
      row.appendChild(document.createTextNode(' '));
      row.appendChild(num(remV, 'bb-del'));
    }
    wrap.appendChild(row);
    wrap.appendChild(el('div', 'bb-lab', lab + (opts.suffix ? ' ' + opts.suffix : '')));
    return wrap;
  }

  function bestAnchor() {
    return document.querySelector('[role="main"], main, #content') || document.body;
  }

  function injectPanel(loc, data, err) {
    styleTag();
    const old = document.getElementById(ROOT_ID);
    if (old) old.remove();

    const root = el('div');
    root.id = ROOT_ID;

    if (err) {
      root.appendChild(el('div', 'bb-head', ''));
      const head = root.firstChild;
      head.appendChild(el('span', 'bb-title bb-err', 'LOC breakdown'));
      root.appendChild(el('div', 'bb-err', 'Could not load diff: ' + err.message));
    } else if (data) {
      const head = el('div', 'bb-head');
      head.appendChild(el('span', 'bb-title', 'LOC breakdown'));
      const refresh = el('button', 'bb-refresh', 'Refresh');
      refresh.type = 'button';
      refresh.addEventListener('click', () => {
        cacheRemove(dataKey(loc));
        render(true);
      });
      head.appendChild(refresh);
      root.appendChild(head);

      const grid = el('div', 'bb-grid');
      grid.appendChild(metric('Total', data.added, data.removed, { suffix: data.fileCount + ' file' + (data.fileCount === 1 ? '' : 's') }));
      grid.appendChild(metric('Test files', data.testAdded, data.testRemoved, { suffix: data.testFileCount + ' file' + (data.testFileCount === 1 ? '' : 's') }));

      const cmt = metric('Comment lines', data.commentsAdded, data.commentsRemoved);
      const codeAdd = data.added - data.commentsAdded;
      const codeRem = data.removed - data.commentsRemoved;
      const code = metric('Code (non-comment)', codeAdd, codeRem);

      cmt.querySelector('.bb-lab').appendChild(el('span', 'bb-tag', '// # /* */'));
      grid.appendChild(cmt);
      grid.appendChild(code);
      root.appendChild(grid);

      const details = el('details');
      details.appendChild(el('summary', '', 'Per-file breakdown (' + data.files.length + ')'));
      const table = el('table');
      const thead = el('thead');
      const hr = el('tr');
      ['File', '+', '−', 'Comment +', 'Comment −', 'Type'].forEach((txt) => {
        const th = el('th', null, txt);
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      const tb = el('tbody');
      for (const f of data.files) {
        const tr = el('tr');
        const tdF = el('td', null, f.path);
        if (f.isTest) tdF.appendChild(el('span', 'bb-tag', 'TEST'));
        [f.added, f.removed, f.commentsAdded, f.commentsRemoved].forEach((v, i) => {
          const td = el('td', 'bb-num ' + (i % 2 === 0 ? 'bb-add' : 'bb-del'), String(v));
          tr.appendChild(td);
        });
        tr.insertBefore(tdF, tr.firstChild);
        tb.appendChild(tr);
      }
      table.appendChild(tb);
      details.appendChild(table);
      root.appendChild(details);
    }

    const anchor = bestAnchor();
    if (anchor && anchor.prepend) anchor.prepend(root);
    else document.body.appendChild(root);
  }

  // ---------- per-file row badges (best effort) ----------

  function rowLabel(f) {
    const parts = [];
    if (f.isTest) parts.push('test +' + f.added + ' −' + f.removed);
    if (f.commentsAdded || f.commentsRemoved) parts.push('cmt +' + f.commentsAdded + ' −' + f.commentsRemoved);
    return parts.length ? parts.join(' · ') : '';
  }

  function clearBadges() {
    for (const b of appendedBadges) if (b.parentNode) b.parentNode.removeChild(b);
    appendedBadges = [];
  }

  function rowsForFile(path) {
    const target = '#chg-' + path;
    const exact = [];
    const lenient = [];
    const anchors = document.querySelectorAll('a[href^="#chg-"]');
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      if (href === target) exact.push(a);
      else {
        const t = (a.textContent || '').trim();
        if (t && t.length < 260 && t.includes(path.split('/').pop())) lenient.push(a);
      }
    }
    return exact.length ? exact.slice(0, 1) : lenient.slice(0, 1);
  }

  function summaryClusters() {
    const out = [];
    const els = document.querySelectorAll('div,span');
    for (const el of els) {
      if (el.children.length !== 2) continue;
      const kids = Array.prototype.slice.call(el.children);
      if (!kids.every((c) => c.tagName === 'SPAN' && c.getAttribute('aria-hidden') === 'true')) continue;
      const t = (el.textContent || '').trim();
      if (!/^[+−-]\d+[−-]\d+$/.test(t)) continue;
      out.push(el);
    }
    return out;
  }

  function summaryChip(data) {
    const chip = el('span', 'bb-loc-inline');
    const part = (label, a, r) => {
      chip.appendChild(el('span', null, label + ' '));
      chip.appendChild(el('span', 'bb-add', '+' + a));
      chip.appendChild(document.createTextNode(' '));
      chip.appendChild(el('span', 'bb-del', '−' + r));
    };
    part('test', data.testAdded, data.testRemoved);
    chip.appendChild(document.createTextNode(' · '));
    part('cmt', data.commentsAdded, data.commentsRemoved);
    return chip;
  }

  function decorateRows(data) {
    if (!data || !data.files || !isDiffPage()) return;
    clearBadges();
    for (const f of data.files) {
      const label = rowLabel(f);
      if (!label) continue;
      const els = rowsForFile(f.path);
      for (const rowEl of els) {
        if (rowEl.dataset.bbLocked) continue;
        rowEl.dataset.bbLocked = '1';
        const badge = el('span', 'bb-loc-badge', label);
        rowEl.appendChild(badge);
        appendedBadges.push(badge);
      }
    }
    for (const cluster of summaryClusters()) {
      if (cluster.dataset.bbSummed) continue;
      cluster.dataset.bbSummed = '1';
      const chip = summaryChip(data);
      cluster.insertAdjacentElement('afterend', chip);
      appendedBadges.push(chip);
    }
  }

  let decorateTimer = null;
  function scheduleDecorate(data) {
    if (!data) return;
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(() => decorateRows(data), 900);
  }

  // ---------- render / lifecycle ----------

  async function render(force) {
    const loc = parseLocation();
    if (!loc) return;
    const key = dataKey(loc);
    try {
      const data = lastData && lastData._key === key && !force
        ? lastData
        : await loadData(loc, force);
      lastData = Object.assign({}, data, { _key: key });
      injectPanel(loc, lastData);
      scheduleDecorate(lastData);
    } catch (err) {
      injectPanel(loc, null, err);
    }
  }

  let rendering = false;
  let lastPath = null;
  function onMaybeNav(force) {
    if (rendering) {
      if (force) setTimeout(() => render(true), 100);
      return;
    }
    const loc = parseLocation();
    if (!loc) return;
    const needRoot = !document.getElementById(ROOT_ID);
    const pathChanged = lastPath !== location.pathname;
    if (needRoot || pathChanged || force) {
      lastPath = location.pathname;
      rendering = true;
      render(force).finally(() => { rendering = false; });
    }
  }

  function hookHistory() {
    for (const method of ['pushState', 'replaceState']) {
      const orig = history[method];
      if (!orig || orig.__bbHooked) continue;
      history[method] = function () {
        const r = orig.apply(this, arguments);
        onMaybeNav();
        return r;
      };
      history[method].__bbHooked = true;
    }
  }

  function start() {
    styleTag();
    lastPath = location.pathname;
    onMaybeNav();
    hookHistory();
    window.addEventListener('popstate', () => onMaybeNav());
    new MutationObserver(() => onMaybeNav()).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    const io = new MutationObserver(() => scheduleDecorate(lastData));
    io.observe(document.documentElement, { childList: true, subtree: true });
  }

  start();
})();