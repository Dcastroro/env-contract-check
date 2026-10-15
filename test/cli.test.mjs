import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../bin/env-contract-check.mjs', import.meta.url));
function fixture(t, contract = 'A=', env = 'A=ready') {
  const cwd = mkdtempSync(join(tmpdir(), 'env-contract-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(join(cwd, '.env.example'), contract);
  writeFileSync(join(cwd, '.env'), env);
  return cwd;
}
function exec(cwd, args = []) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  return result;
}

test('default invocation succeeds without dependencies', t => {
  const result = exec(fixture(t));
  assert.equal(result.status, 0);
  assert.match(result.stdout, /PASS: 1 required/);
  assert.equal(result.stderr, '');
});

test('JSON report fails validation with exit code 1 and deterministic contents', t => {
  const cwd = fixture(t, 'A=\nB=', 'A=change-me\nEXTRA=true');
  const result = exec(cwd, ['--json', '--strict']);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.issues.map(issue => issue.code), ['placeholder', 'missing', 'unexpected']);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, exec(cwd, ['--json', '--strict']).stdout);
});

test('accepts explicit input paths including spaces', t => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, 'contract file'), 'CUSTOM=');
  writeFileSync(join(cwd, 'env file'), 'CUSTOM=ready');
  assert.equal(exec(cwd, ['--example', 'contract file', '--env', 'env file']).status, 0);
});

test('file errors produce safe structured diagnostics and exit code 2', t => {
  const cwd = fixture(t);
  const result = exec(cwd, ['--env', 'SENTINEL_PRIVATE_PATH', '--json']);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).error.code, 'read-env');
  assert.equal((result.stdout + result.stderr).includes('SENTINEL_PRIVATE_PATH'), false);
  assert.equal(exec(cwd, ['--example', 'missing', '--json']).status, 2);
});

test('rejects files over 1 MiB, directories and invalid UTF-8', t => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, '.env'), Buffer.alloc(1024 * 1024 + 1, 65));
  assert.equal(exec(cwd, ['--json']).status, 2);
  assert.equal(exec(cwd, ['--env', '.', '--json']).status, 2);
  writeFileSync(join(cwd, '.env'), Buffer.from([0xc3, 0x28]));
  assert.equal(exec(cwd, ['--json']).status, 2);
});

test('invalid arguments never echo supplied text', t => {
  const cwd = fixture(t);
  for (const args of [ ['--SENTINEL_SECRET'], ['--env'], ['--env', '--strict'], ['--strict', '--strict'], ['--json', '--json'], ['SENTINEL_SECRET'] ]) {
    const result = exec(cwd, [...args, '--json']);
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'usage');
    assert.equal((result.stdout + result.stderr).includes('SENTINEL_SECRET'), false);
  }
});

test('help and version work without any configuration files', t => {
  const cwd = fixture(t);
  rmSync(join(cwd, '.env'));
  assert.match(exec(cwd, ['--help']).stdout, /Usage:/);
  const result = exec(cwd, ['--version']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '0.1.0');
});

test('human and JSON errors do not disclose configuration values', t => {
  const secret = 'SENTINEL_SECRET_746a';
  const cwd = fixture(t, 'A=', `A="${secret}`);
  for (const args of [[], ['--json']]) {
    const result = exec(cwd, args);
    assert.equal(result.status, 1);
    assert.equal((result.stdout + result.stderr).includes(secret), false);
  }
});
