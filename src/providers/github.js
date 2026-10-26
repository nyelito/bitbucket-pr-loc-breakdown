(function (global) {
  'use strict';

  var HOST_RE = /(^|\.)github\.com$/i;
  var PATH_RE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/;
  var ADD_RE = /^\+[\d,]+$/;
  var DEL_RE = /^[−-][\d,]+$/;

  function toUrl(input) {
    try {
      if (input == null) {
        if (!global.location) return null;
        return new URL(global.location.href);
      }
      return input instanceof URL ? input : new URL(input);
    } catch (e) {
      return null;
    }
  }

  function normalize(text) {
    return String(text == null ? '' : text).replace(/\s+/g, '');
  }

  function parseLocation(input) {
    var u = toUrl(input);
    if (!u || !HOST_RE.test(u.hostname)) return null;
    var m = PATH_RE.exec(u.pathname.replace(/\/+/g, '/'));
    if (!m) return null;
    return {
      provider: 'github',
      owner: m[1],
      repo: m[2],
      id: m[3]
    };
  }

  function isDiffPage(loc, input) {
    var u = toUrl(input);
    if (!u) return false;
    var path = u.pathname.replace(/\/+/g, '/');
    var m = PATH_RE.exec(path);
    if (!m) return false;
    if (loc && String(loc.id) !== m[3]) return false;
    var rest = path.slice(m[0].length);
    return rest === '' || rest === '/' ||
      /^(files|changes)\/?$/.test(rest);
  }

  function diffUrl(loc, origin) {
    var base = origin || (global.location && global.location.origin);
    return base +
      '/' + encodeURIComponent(loc.owner) +
      '/' + encodeURIComponent(loc.repo) +
      '/pull/' + encodeURIComponent(loc.id) + '.diff';
  }

  async function fetchDiff(loc, origin) {
    return global.Realloc.net.fetchText(diffUrl(loc, origin), { accept: 'text/plain' });
  }

  function anchor() {
    return document.querySelector(
      '#repo-content-turbo-frame, #repo-content-pjax-container, main, [data-turbo-body]'
    ) || document.body;
  }

  function inFileHeader(el) {
    return !!(el && el.closest && el.closest(
      '.file, .js-file, .file-header, [data-path], [data-testid="diff-file-header"]'
    ));
  }

  function clusterFrom(node) {
    if (!node) return null;
    var candidates = [];
    if (node.tagName === 'SPAN' && node.children.length === 0) candidates = [node];
    else if (node.querySelectorAll) candidates = Array.prototype.slice.call(node.querySelectorAll('span'));
    if (!candidates.length && node.children) candidates = Array.prototype.slice.call(node.children);

    var add = null;
    var del = null;
    for (var i = 0; i < candidates.length; i++) {
      var t = normalize(candidates[i].textContent);
      if (ADD_RE.test(t)) add = candidates[i];
      else if (DEL_RE.test(t)) del = candidates[i];
    }
    if (!add || !del) return null;
    var parent = add.parentElement;
    if (parent && parent === del.parentElement) return parent;
    return node;
  }

  function summaryClusters() {
    var out = [];
    var seen = [];

    function push(node) {
      if (!node || inFileHeader(node) || seen.indexOf(node) !== -1) return;
      seen.push(node);
      out.push(node);
    }

    var stats = document.querySelectorAll('.diffstat, [data-testid="diffstat"]');
    for (var i = 0; i < stats.length; i++) {
      if (inFileHeader(stats[i])) continue;
      push(clusterFrom(stats[i]));
    }
    if (out.length) return out;

    var spans = document.querySelectorAll('span');
    for (var j = 0; j < spans.length; j++) {
      if (!ADD_RE.test(normalize(spans[j].textContent))) continue;
      push(clusterFrom(spans[j].parentElement));
    }
    return out;
  }

  var api = {
    id: 'github',
    label: 'GitHub',
    matches: function (input) { return !!parseLocation(input); },
    parseLocation: parseLocation,
    isDiffPage: isDiffPage,
    diffUrl: diffUrl,
    fetchDiff: fetchDiff,
    anchor: anchor,
    summaryClusters: summaryClusters
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Realloc = global.Realloc || {};
  global.Realloc.providers = global.Realloc.providers || {};
  global.Realloc.providers.github = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
