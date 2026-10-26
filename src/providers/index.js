(function (global) {
  'use strict';

  var providers = (global.Realloc && global.Realloc.providers) || {};
  var list = [providers.bitbucket, providers.github].filter(Boolean);

  providers.list = list;
  providers.detect = function (input) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].matches(input)) return list[i];
    }
    return null;
  };

  global.Realloc = global.Realloc || {};
  global.Realloc.providers = providers;

  if (typeof module !== 'undefined' && module.exports) module.exports = providers;
})(typeof globalThis !== 'undefined' ? globalThis : this);
