(function (global) {
  'use strict';

  function hasRuntime() {
    try {
      return !!(global.chrome && global.chrome.runtime && global.chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function fetchViaBackground(url, accept) {
    return new Promise(function (resolve, reject) {
      var message = {
        type: 'realloc:fetch',
        url: url,
        accept: accept
      };
      try {
        global.chrome.runtime.sendMessage(message, function (response) {
          if (global.chrome.runtime.lastError) {
            reject(new Error(global.chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(new Error('No response from the extension service worker'));
            return;
          }
          if (!response.ok) {
            reject(new Error(response.error || 'Fetch failed'));
            return;
          }
          resolve(response.text);
        });
      } catch (e) {
        reject(e && e.message ? e : new Error('Could not reach the extension service worker'));
      }
    });
  }

  function fetchDirect(url, accept) {
    return global.fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: accept || 'text/plain' }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    });
  }

  function fetchText(url, options) {
    options = options || {};
    var accept = options.accept || 'text/plain';
    if (hasRuntime() && global.chrome.runtime.sendMessage) {
      return fetchViaBackground(url, accept);
    }
    return fetchDirect(url, accept);
  }

  global.Realloc = global.Realloc || {};
  global.Realloc.net = { fetchText: fetchText };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Realloc.net;
})(typeof globalThis !== 'undefined' ? globalThis : this);
