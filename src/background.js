'use strict';

var ALLOWED_HOSTS = [
  /(^|\.)bitbucket\.org$/i,
  /(^|\.)github\.com$/i,
  /(^|\.)githubusercontent\.com$/i
];

function isAllowed(url) {
  try {
    var parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.some(function (re) {
      return re.test(parsed.hostname);
    });
  } catch (e) {
    return false;
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.type !== 'realloc:fetch') return false;
  if (!isAllowed(message.url)) {
    sendResponse({ ok: false, error: 'Blocked URL' });
    return false;
  }

  fetch(message.url, {
    credentials: 'include',
    redirect: 'follow',
    headers: { Accept: message.accept || 'text/plain' }
  }).then(function (res) {
    return res.text().then(function (text) {
      sendResponse({
        ok: res.ok,
        status: res.status,
        text: text,
        error: res.ok ? null : 'HTTP ' + res.status
      });
    });
  }).catch(function (err) {
    sendResponse({ ok: false, error: err && err.message ? err.message : 'Fetch failed' });
  });

  return true;
});
