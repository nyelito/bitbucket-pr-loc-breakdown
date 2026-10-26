(() => {
  'use strict';

  const R = globalThis.Realloc;
  if (!R || !R.parser || !R.providers || !R.ui || !R.cache) return;

  const P = R.parser;
  const UI = R.ui;
  const cache = R.cache.create('realloc:', 15 * 60 * 1000);

  let active = null;
  let rendering = false;
  let lastHref = null;

  function context() {
    const provider = R.providers.detect(location.href);
    if (!provider) return null;
    const loc = provider.parseLocation(location.href);
    if (!loc) return null;
    return { provider: provider, loc: loc };
  }

  function dataKey(ctx) {
    return ctx.provider.id + ':' + ctx.loc.owner + '/' + ctx.loc.repo + ':' + ctx.loc.id;
  }

  function buildSummary(files) {
    return Object.assign(P.summarize(files), { files: files, fetchedAt: Date.now() });
  }

  async function loadData(ctx, force) {
    const key = dataKey(ctx);
    if (!force) {
      const cached = cache.get(key);
      if (cached) return cached;
    }
    const text = await ctx.provider.fetchDiff(ctx.loc, location.origin);
    if (/^\s*<!doctype html/i.test(text)) {
      throw new Error('diff endpoint returned an HTML page; check that you are signed in');
    }
    const data = buildSummary(P.parseDiff(text));
    cache.set(key, data);
    return data;
  }

  async function render(force) {
    const ctx = context();
    if (!ctx) return;
    const key = dataKey(ctx);
    try {
      const data = await loadData(ctx, force);
      active = { ctx: ctx, data: data };
      UI.injectPanel({
        provider: ctx.provider,
        loc: ctx.loc,
        data: data,
        onRefresh: () => {
          cache.remove(key);
          onMaybeNav(true);
        }
      });
      UI.scheduleDecorate(ctx.provider, ctx.loc, data);
    } catch (err) {
      active = { ctx: ctx, data: null };
      UI.injectPanel({
        provider: ctx.provider,
        loc: ctx.loc,
        error: err,
        onRefresh: () => {
          cache.remove(key);
          onMaybeNav(true);
        }
      });
    }
  }

  function onMaybeNav(force) {
    const ctx = context();
    const root = document.getElementById(UI.rootId);

    if (!ctx) {
      if (root) UI.reset();
      active = null;
      lastHref = location.href;
      return;
    }

    if (rendering) {
      if (force) setTimeout(() => onMaybeNav(true), 100);
      return;
    }

    const href = location.href;
    const changed = lastHref !== href;
    if (!root || changed || force) {
      lastHref = href;
      rendering = true;
      render(force).finally(() => { rendering = false; });
    }
  }

  function hookHistory() {
    ['pushState', 'replaceState'].forEach((method) => {
      const original = history[method];
      if (!original || original.__reallocHooked) return;
      history[method] = function () {
        const result = original.apply(this, arguments);
        onMaybeNav();
        return result;
      };
      history[method].__reallocHooked = true;
    });
  }

  function start() {
    UI.styleTag();
    lastHref = location.href;
    onMaybeNav();
    hookHistory();
    window.addEventListener('popstate', () => onMaybeNav());
    document.addEventListener('turbo:load', () => onMaybeNav());
    document.addEventListener('pjax:end', () => onMaybeNav());

    new MutationObserver(() => onMaybeNav()).observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    const decorator = new MutationObserver(() => {
      if (!active || !active.data) return;
      UI.scheduleDecorate(active.ctx.provider, active.ctx.loc, active.data);
    });
    decorator.observe(document.documentElement, { childList: true, subtree: true });
  }

  start();
})();
