'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('../src/parser.js');
const languages = require('../src/languages.js');
const bitbucket = require('../src/providers/bitbucket.js');
const github = require('../src/providers/github.js');

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
      isTest: f.isTest,
      isDoc: f.isDoc
    };
  }

  const summaryOk = expected.summary
    ? JSON.stringify(parser.summarize(parsed)) === JSON.stringify(expected.summary)
    : true;

  const expectedFiles = {};
  for (const k of Object.keys(expected)) if (k !== 'summary') expectedFiles[k] = expected[k];
  const ok = JSON.stringify(got) === JSON.stringify(expectedFiles) && summaryOk;
  const expectedPaths = Object.keys(expectedFiles).sort().join(', ');
  const gotPaths = Object.keys(got).sort().join(', ');
  if (ok) {
    console.log('PASS ' + file);
  } else {
    failed++;
    console.log('FAIL ' + file);
    console.log('  expected files: ' + expectedPaths);
    console.log('  got files:      ' + gotPaths);
    if (!summaryOk) {
      console.log('  summary mismatch');
      console.log('    expected ' + JSON.stringify(expected.summary));
      console.log('    got      ' + JSON.stringify(parser.summarize(parsed)));
    }
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

const architectureChecks = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')'));
  architectureChecks.push(name);
}

const bbLoc = bitbucket.parseLocation('https://bitbucket.org/acme/android/pull-requests/7/files');
check('bitbucket location', bbLoc && bbLoc.owner + '/' + bbLoc.repo + '#' + bbLoc.id, 'acme/android#7');
check(
  'bitbucket diff url',
  bitbucket.diffUrl(bbLoc, 'https://bitbucket.org'),
  'https://bitbucket.org/!api/2.0/repositories/acme/android/pullrequests/7/diff'
);

const ghLoc = github.parseLocation('https://github.com/acme/android/pull/7/files');
check('github location', ghLoc && ghLoc.owner + '/' + ghLoc.repo + '#' + ghLoc.id, 'acme/android#7');
check(
  'github diff url',
  github.diffUrl(ghLoc, 'https://github.com'),
  'https://github.com/acme/android/pull/7.diff'
);
check('github files page', github.isDiffPage(ghLoc, 'https://github.com/acme/android/pull/7/files'), true);
check('github conversation page', github.isDiffPage(ghLoc, 'https://github.com/acme/android/pull/7'), true);
check('github commits page', github.isDiffPage(ghLoc, 'https://github.com/acme/android/pull/7/commits'), false);
check('unknown host rejected', bitbucket.parseLocation('https://github.com/acme/android/pull/7'), null);

check('kotlin gradle script language', languages.forPath('app/build.gradle.kts').id, 'kotlin');
check('groovy gradle script language', languages.forPath('app/build.gradle').id, 'gradle');
check('androidTest detected', parser.isTestFile('app/src/androidTest/java/com/example/MainActivityTest.kt'), true);
check('java Test suffix detected', parser.isTestFile('app/src/test/java/com/example/CalculatorTest.java'), true);
check('non-test Test substring rejected', parser.isTestFile('app/src/main/java/com/example/Contest.kt'), false);

if (failed) {
  console.log('\n' + failed + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nAll ' + files.length + ' fixtures and ' + architectureChecks.length + ' architecture checks PASSED');