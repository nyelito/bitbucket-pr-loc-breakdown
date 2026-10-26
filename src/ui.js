(function (global) {
  'use strict';

  var ROOT_ID = 'realloc-root';
  var STYLE_ID = 'realloc-style';
  var DECORATE_DELAY_MS = 900;

  var CSS = `
#${ROOT_ID}{font:400 13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#172b4d;background:#f5f6f7;border:1px solid #dfe3e8;border-radius:8px;padding:12px 14px;margin:12px 0;}
#${ROOT_ID} .rl-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}
#${ROOT_ID} .rl-title{font-weight:600;font-size:13px;color:#243547;}
#${ROOT_ID} .rl-provider{font-size:10px;line-height:1;padding:2px 6px;border-radius:9px;background:#e8eef9;color:#0b57d0;font-weight:600;margin-right:auto;}
#${ROOT_ID} .rl-refresh{font:600 11px/1 inherit;color:#0b57d0;background:none;border:0;cursor:pointer;padding:2px 6px;border-radius:4px;}
#${ROOT_ID} .rl-refresh:hover{background:#e8eef9;}
#${ROOT_ID} .rl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;}
#${ROOT_ID} .rl-metric{background:#fff;border:1px solid #e3e7ec;border-radius:6px;padding:6px 10px;}
#${ROOT_ID} .rl-num{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;}
#${ROOT_ID} .rl-lab{font-size:11px;color:#5e6c84;margin-top:1px;}
#${ROOT_ID} .rl-add{color:#1b7f1b;} #${ROOT_ID} .rl-del{color:#c73a3a;}
#${ROOT_ID} .rl-muted{color:#5e6c84;}
#${ROOT_ID} .rl-err{color:#c73a3a;}
#${ROOT_ID} details{margin-top:10px;}
#${ROOT_ID} summary{cursor:pointer;font-size:12px;color:#0b57d0;font-weight:600;}
#${ROOT_ID} table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px;}
#${ROOT_ID} td,#${ROOT_ID} th{border-top:1px solid #e3e7ec;padding:3px 6px;text-align:right;white-space:nowrap;}
#${ROOT_ID} td:first-child,#${ROOT_ID} th:first-child{text-align:left;word-break:break-all;white-space:normal;}
#${ROOT_ID} th{color:#5e6c84;font-weight:600;}
#${ROOT_ID} .rl-tag{display:inline-block;font-size:10px;line-height:1;margin-left:6px;padding:2px 5px;border-radius:8px;background:#e0edfc;color:#0b57d0;font-weight:600;}
#${ROOT_ID} .rl-tag-doc{background:#f5e2c8;color:#8a5606;}
.realloc-inline{display:inline-block;margin-left:10px;font:600 11px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#4a5f7a;background:#fff;border:1px dashed #b3bfce;border-radius:10px;padding:1px 8px;white-space:nowrap;vertical-align:middle;}
.realloc-inline .rl-add{color:#1b7f1b;}
.realloc-inline .rl-del{color:#c73a3a;}
.rl-bar{margin-top:10px;}
.rl-bar-row{display:flex;height:9px;border-radius:5px;overflow:hidden;background:#dfe3e8;}
.rl-seg-test{background:#1b7f1b;} .rl-seg-doc{background:#c26b08;} .rl-seg-cmt{background:#0b57d0;} .rl-seg-code{background:#42526e;}
.rl-bar-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:#5e6c84;}
.rl-bar-item{display:inline-flex;align-items:center;gap:4px;}
.rl-bar-dot{display:inline-block;width:8px;height:8px;border-radius:2px;}
.rl-bar-dot.rl-seg-test{background:#1b7f1b;} .rl-bar-dot.rl-seg-doc{background:#c26b08;} .rl-bar-dot.rl-seg-cmt{background:#0b57d0;} .rl-bar-dot.rl-seg-code{background:#42526e;}
.rl-bar-empty{font-size:11px;color:#5e6c84;}
`;

  var decorations = [];
  var decorateTimer = null;

  function styleTag() {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = CSS;
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function num(value, kind) {
    var text = (value > 0 ? '+' : '') + String(value);
    return el('span', 'rl-num ' + kind, text);
  }

  function metric(label, addValue, removeValue, opts) {
    opts = opts || {};
    var wrap = el('div', 'rl-metric');
    var row = el('div', 'rl-line');
    row.appendChild(num(addValue, 'rl-add'));
    if (removeValue) {
      row.appendChild(document.createTextNode(' '));
      row.appendChild(num(removeValue, 'rl-del'));
    }
    wrap.appendChild(row);
    wrap.appendChild(el('div', 'rl-lab', label + (opts.suffix ? ' ' + opts.suffix : '')));
    return wrap;
  }

  function barGraph(data) {
    var total = data.added;
    var segs = [
      { label: 'tests', value: data.testAdded, cls: 'rl-seg-test' },
      { label: 'docs', value: data.docAdded, cls: 'rl-seg-doc' },
      { label: 'comments', value: data.commentAdded, cls: 'rl-seg-cmt' },
      { label: 'code', value: data.codeAdded, cls: 'rl-seg-code' }
    ];
    var wrap = el('div', 'rl-bar');
    if (!total) {
      wrap.appendChild(el('div', 'rl-bar-empty', 'No added lines'));
      return wrap;
    }
    var bar = el('div', 'rl-bar-row');
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      var part = el('div', seg.cls);
      var percent = total ? (seg.value / total) * 100 : 0;
      part.style.width = percent.toFixed(2) + '%';
      if (percent > 0) part.title = seg.label + ' ' + Math.round(percent) + '%';
      bar.appendChild(part);
    }
    wrap.appendChild(bar);

    var legend = el('div', 'rl-bar-legend');
    for (var j = 0; j < segs.length; j++) {
      var item = el('span', 'rl-bar-item');
      item.appendChild(el('span', 'rl-bar-dot ' + segs[j].cls));
      item.appendChild(el('span', 'rl-bar-label', segs[j].label + ' ' + Math.round(total ? (segs[j].value / total) * 100 : 0) + '%'));
      legend.appendChild(item);
    }
    wrap.appendChild(legend);
    return wrap;
  }

  function clearBadges() {
    for (var i = 0; i < decorations.length; i++) {
      var d = decorations[i];
      if (d.chip && d.chip.parentNode) d.chip.parentNode.removeChild(d.chip);
      if (d.cluster && d.cluster.dataset) delete d.cluster.dataset.reallocSummed;
    }
    decorations = [];
  }

  function reset() {
    clearTimeout(decorateTimer);
    decorateTimer = null;
    clearBadges();
    var old = document.getElementById(ROOT_ID);
    if (old) old.remove();
  }

  function anchorFor(provider, loc) {
    try {
      return (provider && provider.anchor && provider.anchor(loc)) || null;
    } catch (e) {
      return null;
    }
  }

  function injectPanel(opts) {
    styleTag();
    var old = document.getElementById(ROOT_ID);
    if (old) old.remove();

    var root = el('div');
    root.id = ROOT_ID;

    var head = el('div', 'rl-head');
    var title = el('span', 'rl-title' + (opts.error ? ' rl-err' : ''), 'LOC breakdown');
    head.appendChild(title);
    if (opts.provider) head.appendChild(el('span', 'rl-provider', opts.provider.label));
    if (opts.onRefresh) {
      var refresh = el('button', 'rl-refresh', 'Refresh');
      refresh.type = 'button';
      refresh.addEventListener('click', opts.onRefresh);
      head.appendChild(refresh);
    }
    root.appendChild(head);

    if (opts.error) {
      root.appendChild(el('div', 'rl-err', 'Could not load diff: ' + opts.error.message));
    } else if (opts.data) {
      var data = opts.data;
      var grid = el('div', 'rl-grid');
      grid.appendChild(metric('Total', data.added, data.removed, {
        suffix: data.fileCount + ' file' + (data.fileCount === 1 ? '' : 's')
      }));
      grid.appendChild(metric('Test files', data.testAdded, data.testRemoved, {
        suffix: data.testFileCount + ' file' + (data.testFileCount === 1 ? '' : 's')
      }));
      grid.appendChild(metric('Documentation', data.docAdded, data.docRemoved, {
        suffix: data.docFileCount + ' file' + (data.docFileCount === 1 ? '' : 's')
      }));

      var comments = metric('Comment lines', data.commentAdded, data.commentRemoved);
      comments.title = 'Comment lines outside test files';
      comments.querySelector('.rl-lab').appendChild(el('span', 'rl-tag', '// # /* */'));
      grid.appendChild(comments);

      grid.appendChild(metric('Code', data.codeAdded, data.codeRemoved, {
        suffix: 'non-test / non-comment'
      }));
      root.appendChild(grid);

      root.appendChild(barGraph(data));

      var details = el('details');
      details.appendChild(el('summary', '', 'Per-file breakdown (' + data.files.length + ')'));
      var table = el('table');
      var thead = el('thead');
      var headRow = el('tr');
      ['File', '+', '−', 'Comment +', 'Comment −', 'Type'].forEach(function (label) {
        headRow.appendChild(el('th', null, label));
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = el('tbody');
      for (var i = 0; i < data.files.length; i++) {
        var file = data.files[i];
        var row = el('tr');
        var pathCell = el('td', null, file.path);
        if (file.isTest) pathCell.appendChild(el('span', 'rl-tag', 'TEST'));
        else if (file.isDoc) pathCell.appendChild(el('span', 'rl-tag rl-tag-doc', 'DOC'));
        row.appendChild(pathCell);
        [file.added, file.removed, file.commentsAdded, file.commentsRemoved].forEach(function (value, index) {
          row.appendChild(el('td', 'rl-num ' + (index % 2 === 0 ? 'rl-add' : 'rl-del'), String(value)));
        });
        tbody.appendChild(row);
      }
      table.appendChild(tbody);
      details.appendChild(table);
      root.appendChild(details);
    }

    var anchor = anchorFor(opts.provider, opts.loc);
    if (anchor && anchor.prepend) anchor.prepend(root);
    else document.body.appendChild(root);
  }

  function summaryChip(data) {
    var chip = el('span', 'realloc-inline');
    function part(label, added, removed) {
      chip.appendChild(el('span', null, label + ' '));
      chip.appendChild(el('span', 'rl-add', '+' + added));
      chip.appendChild(document.createTextNode(' '));
      chip.appendChild(el('span', 'rl-del', '−' + removed));
    }
    part('test', data.testAdded, data.testRemoved);
    chip.appendChild(document.createTextNode(' · '));
    part('cmt', data.commentAdded, data.commentRemoved);
    return chip;
  }

  function decorate(provider, loc, data) {
    if (!data || !provider || !provider.isDiffPage) return;
    var href = global.location && global.location.href;
    try {
      if (!provider.isDiffPage(loc, href)) return;
    } catch (e) {
      return;
    }
    clearBadges();
    var clusters;
    try {
      clusters = provider.summaryClusters() || [];
    } catch (e) {
      clusters = [];
    }
    for (var i = 0; i < clusters.length; i++) {
      var cluster = clusters[i];
      if (!cluster || (cluster.dataset && cluster.dataset.reallocSummed)) continue;
      if (cluster.dataset) cluster.dataset.reallocSummed = '1';
      var chip = summaryChip(data);
      cluster.insertAdjacentElement('afterend', chip);
      decorations.push({ chip: chip, cluster: cluster });
    }
  }

  function scheduleDecorate(provider, loc, data) {
    if (!data) return;
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(function () {
      decorate(provider, loc, data);
    }, DECORATE_DELAY_MS);
  }

  global.Realloc = global.Realloc || {};
  global.Realloc.ui = {
    rootId: ROOT_ID,
    styleTag: styleTag,
    injectPanel: injectPanel,
    decorate: decorate,
    scheduleDecorate: scheduleDecorate,
    reset: reset
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
