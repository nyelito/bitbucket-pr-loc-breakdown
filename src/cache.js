(function (global) {
  'use strict';

  function create(prefix, ttlMs) {
    var keyPrefix = prefix || 'realloc:';
    var ttl = ttlMs || 15 * 60 * 1000;

    function storage() {
      try {
        return global.sessionStorage || null;
      } catch (e) {
        return null;
      }
    }

    function get(key) {
      var store = storage();
      if (!store) return null;
      try {
        var raw = store.getItem(keyPrefix + key);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (Date.now() - parsed.at > ttl) return null;
        return parsed.data;
      } catch (e) {
        return null;
      }
    }

    function set(key, data) {
      var store = storage();
      if (!store) return;
      try {
        var raw = JSON.stringify({ at: Date.now(), data: data });
        if (raw.length > 2 * 1024 * 1024) return;
        store.setItem(keyPrefix + key, raw);
      } catch (e) {
        /* storage full or unavailable */
      }
    }

    function remove(key) {
      var store = storage();
      if (!store) return;
      try {
        store.removeItem(keyPrefix + key);
      } catch (e) {
        /* ignore */
      }
    }

    return { get: get, set: set, remove: remove, ttl: ttl };
  }

  global.Realloc = global.Realloc || {};
  global.Realloc.cache = { create: create };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Realloc.cache;
})(typeof globalThis !== 'undefined' ? globalThis : this);
