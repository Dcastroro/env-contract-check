import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEnv } from '../src/check.mjs';

const run = (exampleText, envText, strict = false) => checkEnv({ exampleText, envText, strict });
const codes = report => report.issues.map(issue => issue.code);

test('validates required variables without comparing example defaults', () => {
  const report = run('PORT=3000\nNAME=example', 'PORT=8080\nNAME=production');
  assert.equal(report.ok, true);
  assert.deepEqual(report.summary, { expected: 2, required: 2, provided: 2, issues: 0 });
});

test('reports missing, empty, placeholder and unexpected keys in contract order', () => {
  const report = run('A=\nB=\nC=\nD=', 'B=\nC="change-me"\nD=ready\nEXTRA=true', true);
  assert.deepEqual(report.issues, [
    { code: 'missing', source: 'env', key: 'A' },
    { code: 'empty', source: 'env', key: 'B', line: 1 },
    { code: 'placeholder', source: 'env', key: 'C', line: 2 },
    { code: 'unexpected', source: 'env', key: 'EXTRA', line: 4 },
  ]);
});

test('allows extra variables unless strict mode is enabled', () => {
  assert.equal(run('A=', 'A=ready\nEXTRA=yes').ok, true);
  assert.deepEqual(codes(run('A=', 'A=ready\nEXTRA=yes', true)), ['unexpected']);
});

test('optional markers apply to the next assignment only, through comments', () => {
  const contract = '# @optional\n# Description\n\nOPTIONAL=\nREQUIRED=';
  assert.equal(run(contract, 'REQUIRED=ready').ok, true);
  assert.equal(run(contract, 'OPTIONAL="  "\nREQUIRED=ready').ok, true);
  assert.deepEqual(codes(run(contract, 'OPTIONAL=ready')), ['missing']);
  assert.deepEqual(codes(run(contract, 'OPTIONAL=TODO\nREQUIRED=ready')), ['placeholder']);
});

test('a marker in the environment cannot bypass required fields', () => {
  assert.deepEqual(codes(run('A=', '# @optional\nA=')), ['empty']);
});

test('supports BOM, CRLF, export, whitespace and comments', () => {
  assert.equal(run('\uFEFFexport A = x\r\nB=\r\n', 'export A = ready # comment\r\nB=abc#fragment').ok, true);
  assert.deepEqual(codes(run('A=', 'A=# comment')), ['empty']);
});

test('preserves hashes inside quoted values', () => {
  assert.equal(run('A=\nB=', 'A="hello # world" # comment\nB=\'hello # world\'').ok, true);
});

test('handles escaped double quotes and whitespace escapes', () => {
  assert.equal(run('A=', 'A="escaped \\" quote"').ok, true);
  assert.deepEqual(codes(run('A=', 'A="\\n\\t\\r"')), ['empty']);
  assert.equal(run('A=', 'A="C:\\users\\demo"').ok, true);
});

test('does not evaluate variable interpolation or shell expressions', () => {
  assert.equal(run('A=\nB=', 'A=${MISSING}\nB=$(do-not-execute)').ok, true);
});

test('detects duplicates in either input and suppresses cascading errors', () => {
  const report = run('A=\nA=', 'B=one\nB=two', true);
  assert.deepEqual(report.issues, [
    { code: 'duplicate', source: 'example', key: 'A', line: 2 },
    { code: 'duplicate', source: 'env', key: 'B', line: 2 },
  ]);
});

for (const input of ['NO_EQUALS', 'BAD-KEY=hidden', 'A="unterminated', "A='unterminated", 'A="closed"junk', 'A="closed"#comment', 'A="multi\nline"']) {
  test(`rejects malformed input case ${JSON.stringify(input.split('=')[0])} (${input.length})`, () => {
    const report = run('A=', input);
    assert.equal(report.ok, false);
    assert.ok(codes(report).every(code => code === 'syntax'));
  });
}

test('rejects empty contracts and orphan optional markers', () => {
  assert.deepEqual(codes(run('# comment\n', '')), ['empty-contract']);
  assert.deepEqual(codes(run('A=\n# @optional', 'A=ready')), ['orphan-optional']);
});

test('rejects null bytes in any line without returning raw text', () => {
  assert.deepEqual(codes(run('A=', 'A=hidden\0value')), ['syntax']);
  assert.deepEqual(codes(run('A=', '# comment\0value\nA=ready')), ['syntax']);
});

for (const value of ['changeme', 'CHANGE_ME', 'replace-me', 'TODO', 'your-api-key', '<token>']) {
  test(`recognizes placeholder ${value}`, () => {
    assert.deepEqual(codes(run('A=', `A=${value}`)), ['placeholder']);
  });
}

test('does not misclassify ordinary defaults as placeholders', () => {
  assert.equal(run('A=\nB=\nC=\nD=', 'A=3000\nB=false\nC=localhost\nD=example').ok, true);
});

test('reports never contain raw input or values, including syntax errors', () => {
  const secret = 'SENTINEL_SECRET_98a712';
  for (const env of [`A=${secret}\nA=${secret}`, `A="${secret}`, `${secret}!`, `A=${secret}\nX=${secret}`]) {
    const report = run('A=\nREQUIRED=', env, true);
    assert.equal(JSON.stringify(report).includes(secret), false);
  }
});

test('rejects invalid API input without including it in errors', () => {
  assert.throws(() => checkEnv({ exampleText: null, envText: '' }), TypeError);
});
