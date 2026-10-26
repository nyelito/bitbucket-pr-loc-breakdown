(function (global) {
  'use strict';

  var HOST_RE = /(^|\.)bitbucket\.org$/i;
  var PATH_RE = /^\/?([^/]+)\/([^/]+)\/pull-requests\/(\d+)(?:\/|$)/;

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

  function parseLocation(input) {
    var u = toUrl(input);
    if (!u || !HOST_RE.test(u.hostname)) return null;
    var m = PATH_RE.exec(u.pathname.replace(/\/+/g, '/'));
    if (!m) return null;
    return {
      provider: 'bitbucket',
      owner: m[1],
      repo: m[2],
      id: m[3]
    };
  }

  function isDiffPage(loc, input) {
    var u = toUrl(input);
    if (!u) return false;
    return /\/pull-requests\/\d+\/diff(?:\/|$)/.test(u.pathname);
  }

  function diffUrl(loc, origin) {
    var base = origin || (global.location && global.location.origin);
    return base +
      '/!api/2.0/repositories/' +
      encodeURIComponent(loc.owner) + '/' +
      encodeURIComponent(loc.repo) + '/pullrequests/' +
      encodeURIComponent(loc.id) + '/diff';
  }

  async function fetchDiff(loc, origin) {
    return global.Realloc.net.fetchText(diffUrl(loc, origin), { accept: 'text/plain' });
  }

  function anchor() {
    return document.querySelector('[role="main"], main, #content') || document.body;
  }

  function summaryClusters() {
    var out = [];
    var els = document.querySelectorAll('div,span');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length !== 2) continue;
      var kids = Array.prototype.slice.call(el.children);
      if (!kids.every(function (c) {
        return c.tagName === 'SPAN' && c.getAttribute('aria-hidden') === 'true';
      })) continue;
      var t = (el.textContent || '').trim();
      if (!/^[+−-][\d,]+[−-][\d,]+$/.test(t)) continue;
      out.push(el);
    }
    return out;
  }

  var api = {
    id: 'bitbucket',
    label: 'Bitbucket',
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
  global.Realloc.providers.bitbucket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
