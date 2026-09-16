(function (global) {
  'use strict';

  var TEST_FILE_RE = /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\./i;

  function isTestFile(path) {
    return TEST_FILE_RE.test(path || '');
  }

  var GROUPS = {
    cLike: { line: ['//'], block: [{ open: '/*', close: '*/' }] },
    python: { line: ['#'], block: [{ open: '"""', close: '"""' }, { open: "'''", close: "'''" }] },
    hash: { line: ['#'] },
    sql: { line: ['--'] },
    html: { line: [], block: [{ open: '<!--', close: '-->' }] }
  };

  var EXT_TO_GROUP = {
    js: 'cLike', mjs: 'cLike', cjs: 'cLike', jsx: 'cLike', ts: 'cLike', tsx: 'cLike',
    c: 'cLike', cc: 'cLike', cpp: 'cLike', h: 'cLike', hpp: 'cLike', cs: 'cLike',
    java: 'cLike', go: 'cLike', rs: 'cLike', kt: 'cLike', swift: 'cLike',
    scala: 'cLike', dart: 'cLike', php: 'cLike', m: 'cLike', mm: 'cLike',
    css: 'cLike', scss: 'cLike', less: 'cLike', sass: 'cLike',
    py: 'python', rb: 'hash', r: 'hash', pl: 'hash', pm: 'hash',
    sh: 'hash', bash: 'hash', zsh: 'hash', ksh: 'hash',
    yml: 'hash', yaml: 'hash', ini: 'hash', cfg: 'hash', toml: 'hash',
    sql: 'sql',
    html: 'html', htm: 'html', xml: 'html', xhtml: 'html', vue: 'html',
    md: 'html', markdown: 'html', svg: 'html'
  };

  var DEFAULT_GROUP = { line: ['//', '#'], block: [{ open: '/*', close: '*/' }] };

  function tokensForPath(path) {
    var ext = (path || '').split('.').pop().toLowerCase();
    var g = EXT_TO_GROUP[ext];
    return g ? GROUPS[g] : DEFAULT_GROUP;
  }

  function classifyLine(code, tokens, state) {
    var trimmed = code.trim();
    if (!trimmed) return { isComment: false, state: state };
    if (trimmed.charAt(0) === '#' && trimmed.charAt(1) === '!') {
      return { isComment: true, state: state };
    }
    if (state) {
      var closeIdx = trimmed.indexOf(state.close);
      if (closeIdx !== -1) return { isComment: true, state: null };
      return { isComment: true, state: state };
    }
    var i;
    var lineTokens = tokens.line;
    for (i = 0; i < lineTokens.length; i++) {
      if (trimmed.indexOf(lineTokens[i]) === 0) return { isComment: true, state: state };
    }
    var blocks = tokens.block;
    for (i = 0; i < blocks.length; i++) {
      var open = blocks[i].open;
      if (trimmed.indexOf(open) === 0) {
        var j = trimmed.indexOf(blocks[i].close, open.length);
        if (j !== -1) return { isComment: true, state: null };
        return { isComment: true, state: { open: open, close: blocks[i].close } };
      }
    }
    return { isComment: false, state: state };
  }

  function classifyHunk(lines, tokens) {
    var oldState = null;
    var newState = null;
    var stats = { added: 0, removed: 0, commentsAdded: 0, commentsRemoved: 0 };
    for (var n = 0; n < lines.length; n++) {
      var raw = lines[n];
      if (!raw) continue;
      var c = raw.charAt(0);
      if (c === '\\') continue;
      if (c === ' ') {
        var ctxOld = classifyLine(raw.slice(1), tokens, oldState);
        var ctxNew = classifyLine(raw.slice(1), tokens, newState);
        oldState = ctxOld.state;
        newState = ctxNew.state;
        continue;
      }
      if (c === '+') {
        stats.added++;
        var r = classifyLine(raw.slice(1), tokens, newState);
        newState = r.state;
        if (r.isComment) stats.commentsAdded++;
      } else if (c === '-') {
        stats.removed++;
        var d = classifyLine(raw.slice(1), tokens, oldState);
        oldState = d.state;
        if (d.isComment) stats.commentsRemoved++;
      }
    }
    return stats;
  }

  function extractPath(line) {
    if (line.slice(0, 'diff --git '.length) !== 'diff --git ') return null;
    var rest = line.slice('diff --git '.length).split('\t')[0];
    var mm = /^a\/(.+?) b\/(.+)$/.exec(rest);
    if (mm) return mm[2].trim();
    var tok = rest.split(/\s+/);
    if (tok.length === 2 && tok[0].slice(0, 2) === 'a/') return tok[1].replace(/^b\//, '').trim();
    return null;
  }

  function parseDiff(text) {
    var files = [];
    var cur = null;
    var inHunk = false;
    var hunk = [];

    function finish() {
      if (!cur) return;
      if (cur.path == null && cur.pendingB != null) cur.path = cur.pendingB;
      if (cur.path == null && cur.pendingA != null) cur.path = cur.pendingA;
      if (!cur.path) {
        files.pop();
        cur = null;
        return;
      }
      cur.isTest = isTestFile(cur.path);
      files.push(cur);
      cur = null;
    }

    var lines = String(text == null ? '' : text).split(/\r?\n/);
    for (var n = 0; n < lines.length; n++) {
      var raw = lines[n];
      if (raw.slice(0, 'diff --git '.length) === 'diff --git ') {
        if (cur && hunk.length) {
          var st = classifyHunk(hunk, tokensForPath(cur.path || ''));
          cur.added += st.added; cur.removed += st.removed;
          cur.commentsAdded += st.commentsAdded; cur.commentsRemoved += st.commentsRemoved;
          hunk = [];
        }
        finish();
        cur = {
          path: extractPath(raw),
          pendingA: null,
          pendingB: null,
          added: 0,
          removed: 0,
          commentsAdded: 0,
          commentsRemoved: 0,
          isTest: false
        };
        inHunk = false;
        continue;
      }
      if (cur && !inHunk && raw.slice(0, 4) === '--- ') {
        var ap = raw.slice(4).trim();
        if (ap !== '/dev/null') cur.pendingA = ap;
        continue;
      }
      if (cur && !inHunk && raw.slice(0, 4) === '+++ ') {
        var bp = raw.slice(4).trim();
        if (bp !== '/dev/null') cur.pendingB = bp;
        continue;
      }
      if (cur && raw.slice(0, 2) === '@@') {
        if (hunk.length) {
          var st2 = classifyHunk(hunk, tokensForPath(cur.path || ''));
          cur.added += st2.added; cur.removed += st2.removed;
          cur.commentsAdded += st2.commentsAdded; cur.commentsRemoved += st2.commentsRemoved;
          hunk = [];
        }
        inHunk = true;
        continue;
      }
      if (cur && inHunk) hunk.push(raw);
    }
    if (cur && hunk.length) {
      var st3 = classifyHunk(hunk, tokensForPath(cur.path || ''));
      cur.added += st3.added; cur.removed += st3.removed;
      cur.commentsAdded += st3.commentsAdded; cur.commentsRemoved += st3.commentsRemoved;
    }
    finish();
    return files;
  }

  var api = {
    parseDiff: parseDiff,
    isTestFile: isTestFile,
    classifyLine: classifyLine,
    DEFAULT_GROUP: DEFAULT_GROUP,
    GROUPS: GROUPS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BBLocParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);