#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { TextDecoder } from 'node:util';
import { checkEnv } from '../src/check.mjs';

const VERSION = '0.1.0';
const MAX_BYTES = 1024 * 1024;
const HELP = `Env Contract Check ${VERSION}

Usage: node bin/env-contract-check.mjs [options]

  --example <file>  Contract file (default: .env.example)
  --env <file>      Environment file (default: .env)
  --strict          Reject variables absent from the contract
  --json            Print a machine-readable report
  --help            Show help
  --version         Show version

Exit codes: 0 valid, 1 validation failed, 2 usage or file error.
Values and input file paths are never included in reports.
`;

const messages = {
  syntax: 'Invalid assignment or unsupported quoted value.',
  duplicate: 'Variable is defined more than once.',
  'orphan-optional': 'Optional marker has no following assignment.',
  'empty-contract': 'Contract must declare at least one variable.',
  missing: 'Required variable is missing.',
  empty: 'Required variable is empty.',
  placeholder: 'Replace the placeholder with a configured value.',
  unexpected: 'Variable is absent from the contract.',
};

function options(args) {
  const parsed = { example: '.env.example', env: '.env', strict: false, json: args.includes('--json') };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error('usage');
    seen.add(flag);
    if (flag === '--json' || flag === '--strict') parsed[flag.slice(2)] = true;
    else if (flag === '--help' || flag === '--version') parsed[flag.slice(2)] = true;
    else if (flag === '--example' || flag === '--env') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('usage');
      parsed[flag.slice(2)] = value;
    } else throw new Error('usage');
  }
  return parsed;
}

async function readBounded(path) {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('file');
    // Bound the actual read too, even if a file grows after stat().
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > MAX_BYTES) throw new Error('file');
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
  } finally {
    await handle.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let config;
  try {
    config = options(args);
  } catch {
    fail('usage', args.includes('--json'));
    return;
  }
  if (config.help) { console.log(HELP); return; }
  if (config.version) { console.log(VERSION); return; }
  let exampleText;
  let envText;
  try {
    exampleText = await readBounded(config.example);
  } catch { fail('read-example', config.json); return; }
  try {
    envText = await readBounded(config.env);
  } catch { fail('read-env', config.json); return; }
  const report = checkEnv({ exampleText, envText, strict: config.strict });
  if (config.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(report.ok
      ? `PASS: ${report.summary.required} required variables validated.`
      : `FAIL: ${report.summary.issues} configuration issue(s).`);
    for (const issue of report.issues) {
      const location = `${issue.source}${issue.line ? `:${issue.line}` : ''}`;
      console.log(`  ${issue.code} [${location}]${issue.key ? ` ${issue.key}` : ''}: ${messages[issue.code]}`);
    }
  }
  process.exitCode = report.ok ? 0 : 1;
}

function fail(code, json) {
  const message = code === 'usage'
    ? 'Invalid arguments. Run with --help for usage.'
    : 'Cannot read input: use a regular UTF-8 file no larger than 1 MiB.';
  const report = { version: 1, ok: false, error: { code, message } };
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.error(`ERROR [${code}]: ${message}`);
  process.exitCode = 2;
}

await main();
