'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('../parser.js');

const fixtureDir = path.join(__dirname, '..', 'fixtures');
const files = fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.diff')).sort();

let failed = 0;

for (const file of files) {
  const name = file.slice(0, -'.diff'.length);
  const diff = fs.readFileSync(path.join(fixtureDir, file), 'utf8');
  const expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, name + '.json'), 'utf8'));

  const parsed = parser.parseDiff(diff);
  const got = {};
  for (const f of parsed) {
    got[f.path] = {
      added: f.added,
      removed: f.removed,
      commentsAdded: f.commentsAdded,
      commentsRemoved: f.commentsRemoved,
      isTest: f.isTest
    };
  }

  const ok = JSON.stringify(got) === JSON.stringify(expected);
  const expectedPaths = Object.keys(expected).sort().join(', ');
  const gotPaths = Object.keys(got).sort().join(', ');
  if (ok) {
    console.log('PASS ' + file);
  } else {
    failed++;
    console.log('FAIL ' + file);
    console.log('  expected files: ' + expectedPaths);
    console.log('  got files:      ' + gotPaths);
    for (const p of Object.keys(expected)) {
      const e = expected[p];
      const g = got[p];
      if (JSON.stringify(e) !== JSON.stringify(g)) {
        console.log('  mismatch ' + p);
        console.log('    expected ' + JSON.stringify(e));
        console.log('    got      ' + JSON.stringify(g));
      }
    }
    for (const p of Object.keys(got)) {
      if (!expected[p]) console.log('  unexpected ' + JSON.stringify(got[p]));
    }
  }
}

if (failed) {
  console.log('\n' + failed + ' fixture(s) FAILED');
  process.exit(1);
}
console.log('\nAll ' + files.length + ' fixtures PASSED');