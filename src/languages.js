(function (global) {
  'use strict';

  var DEFAULT_LANGUAGE = {
    id: 'unknown',
    name: 'Unknown',
    extensions: [],
    filenames: [],
    line: ['//', '#'],
    block: [{ open: '/*', close: '*/' }]
  };

  var list = [];
  var byId = {};
  var byFilename = Object.create(null);
  var byExtension = Object.create(null);
  var extensionKeys = [];

  function normalize(lang) {
    return {
      id: lang.id,
      name: lang.name || lang.id,
      extensions: (lang.extensions || []).map(function (e) {
        return String(e).toLowerCase();
      }),
      filenames: (lang.filenames || []).map(function (f) {
        return String(f).toLowerCase();
      }),
      line: lang.line || [],
      block: lang.block || []
    };
  }

  function rebuildExtensionIndex() {
    extensionKeys = Object.keys(byExtension).sort(function (a, b) {
      return b.length - a.length;
    });
  }

  function register(lang) {
    if (!lang || !lang.id) throw new Error('Language requires an id');
    var normalized = normalize(lang);
    byId[normalized.id] = normalized;
    list.push(normalized);

    normalized.extensions.forEach(function (ext) {
      byExtension[ext] = normalized;
    });
    normalized.filenames.forEach(function (name) {
      byFilename[name] = normalized;
    });
    rebuildExtensionIndex();
    return normalized;
  }

  function basename(path) {
    return String(path == null ? '' : path).split('/').pop().toLowerCase();
  }

  function forPath(path) {
    var base = basename(path);
    if (!base) return DEFAULT_LANGUAGE;
    if (byFilename[base]) return byFilename[base];

    for (var i = 0; i < extensionKeys.length; i++) {
      var ext = extensionKeys[i];
      if (base.length > ext.length + 1 && base.slice(-(ext.length + 1)) === '.' + ext) {
        return byExtension[ext];
      }
    }
    return DEFAULT_LANGUAGE;
  }

  function get(id) {
    return byId[id] || null;
  }

  function all() {
    return list.slice();
  }

  var languageDefinitions = [
    {
      id: 'javascript',
      name: 'JavaScript / TypeScript',
      extensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'],
      line: ['//'],
      block: [{ open: '/*', close: '*/' }]
    },
    {
      id: 'kotlin',
      name: 'Kotlin',
      extensions: ['kt', 'kts', 'gradle.kts'],
      line: ['//'],
      block: [{ open: '/*', close: '*/' }]
    },
    {
      id: 'java',
      name: 'Java',
      extensions: ['java'],
      line: ['//'],
      block: [{ open: '/*', close: '*/' }]
    },
    {
      id: 'c-family',
      name: 'C-family languages',
      extensions: [
        'c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx',
        'm', 'mm', 'cs', 'swift', 'go', 'rs', 'scala', 'dart',
        'php', 'css', 'scss', 'less', 'sass', 'groovy', 'proto'
      ],
      line: ['//'],
      block: [{ open: '/*', close: '*/' }]
    },
    {
      id: 'gradle',
      name: 'Gradle',
      extensions: ['gradle'],
      line: ['//'],
      block: [{ open: '/*', close: '*/' }]
    },
    {
      id: 'python',
      name: 'Python',
      extensions: ['py', 'pyw', 'pyi'],
      line: ['#'],
      block: [
        { open: '"""', close: '"""' },
        { open: "'''", close: "'''" }
      ]
    },
    {
      id: 'ruby',
      name: 'Ruby',
      extensions: ['rb', 'rake', 'gemspec', 'ru'],
      line: ['#'],
      block: []
    },
    {
      id: 'shell',
      name: 'Shell',
      extensions: ['sh', 'bash', 'zsh', 'ksh', 'fish'],
      line: ['#'],
      block: []
    },
    {
      id: 'yaml',
      name: 'YAML',
      extensions: ['yml', 'yaml'],
      line: ['#'],
      block: []
    },
    {
      id: 'config',
      name: 'Configuration',
      extensions: ['ini', 'cfg', 'conf', 'toml', 'properties', 'pro', 'env', 'editorconfig'],
      filenames: ['.editorconfig'],
      line: ['#'],
      block: []
    },
    {
      id: 'sql',
      name: 'SQL',
      extensions: ['sql'],
      line: ['--'],
      block: [{ open: '/*', close: '*/' }]
    },
    {
      id: 'html',
      name: 'HTML / XML',
      extensions: ['html', 'htm', 'xml', 'xhtml', 'svg', 'vue', 'svelte', 'hbs', 'mustache'],
      line: [],
      block: [{ open: '<!--', close: '-->' }]
    },
    {
      id: 'markdown',
      name: 'Markdown / docs',
      extensions: ['md', 'markdown', 'mdx', 'rst', 'adoc', 'asciidoc', 'textile'],
      line: [],
      block: [{ open: '<!--', close: '-->' }]
    },
    {
      id: 'lua',
      name: 'Lua',
      extensions: ['lua'],
      line: ['--'],
      block: [{ open: '--[[', close: ']]' }]
    },
    {
      id: 'perl',
      name: 'Perl',
      extensions: ['pl', 'pm'],
      line: ['#'],
      block: []
    },
    {
      id: 'r',
      name: 'R',
      extensions: ['r', 'rmd'],
      line: ['#'],
      block: []
    },
    {
      id: 'graphql',
      name: 'GraphQL',
      extensions: ['graphql', 'gql'],
      line: ['#'],
      block: []
    },
    {
      id: 'docker',
      name: 'Dockerfile',
      filenames: ['dockerfile', 'containerfile'],
      line: ['#'],
      block: []
    },
    {
      id: 'make',
      name: 'Makefile',
      extensions: ['mk', 'mak'],
      filenames: ['makefile', 'gnumakefile'],
      line: ['#'],
      block: []
    },
    {
      id: 'plaintext',
      name: 'Plain text',
      extensions: ['txt', 'text'],
      line: [],
      block: []
    }
  ];

  languageDefinitions.forEach(register);

  var api = {
    register: register,
    get: get,
    forPath: forPath,
    all: all,
    defaultLanguage: DEFAULT_LANGUAGE
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Realloc = global.Realloc || {};
  global.Realloc.languages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
