const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PLACEHOLDER = /^(?:change[-_]?me|replace[-_]?me|todo|your[-_].+|<[^<>]+>)$/i;

function parse(text, source) {
  const entries = new Map();
  const issues = [];
  let optional = false;
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = index + 1;
    const input = lines[index].trim();
    if (input.includes('\0')) {
      issues.push({ code: 'syntax', source, line });
      optional = false;
      continue;
    }
    if (input === '# @optional' && source === 'example') {
      optional = true;
      continue;
    }
    if (!input || input.startsWith('#')) continue;
    const assignment = input.replace(/^export\s+/, '');
    const equals = assignment.indexOf('=');
    const key = equals < 0 ? '' : assignment.slice(0, equals).trim();
    if (!KEY.test(key)) {
      issues.push({ code: 'syntax', source, line });
      optional = false;
      continue;
    }
    const raw = assignment.slice(equals + 1).trim();
    const result = parseValue(raw);
    if (!result.ok) {
      issues.push({ code: 'syntax', source, key, line });
    } else if (entries.has(key)) {
      issues.push({ code: 'duplicate', source, key, line });
    } else {
      entries.set(key, { value: result.value, optional, line });
    }
    optional = false;
  }
  if (optional) issues.push({ code: 'orphan-optional', source, line: lines.length });
  return { entries, issues };
}

function parseValue(raw) {
  if (raw[0] !== '"' && raw[0] !== "'") {
    return { ok: true, value: raw.replace(/(?:^|\s+)#.*$/, '').trim() };
  }
  const quote = raw[0];
  let value = '';
  for (let index = 1; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === quote) {
      const tail = raw.slice(index + 1);
      if (tail.trim() && !/^\s+#/.test(tail)) return { ok: false };
      return { ok: true, value };
    }
    if (quote === '"' && char === '\\' && index + 1 < raw.length) {
      const next = raw[++index];
      const escapes = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };
      value += Object.hasOwn(escapes, next) ? escapes[next] : `\\${next}`;
    } else {
      value += char;
    }
  }
  return { ok: false };
}

/** Check text without returning raw input or environment values. */
export function checkEnv({ exampleText, envText, strict = false }) {
  if (typeof exampleText !== 'string' || typeof envText !== 'string') {
    throw new TypeError('exampleText and envText must be strings.');
  }
  const example = parse(exampleText, 'example');
  const env = parse(envText, 'env');
  const issues = [...example.issues, ...env.issues];
  if (example.entries.size === 0 && example.issues.length === 0) {
    issues.push({ code: 'empty-contract', source: 'example' });
  }
  // Avoid misleading missing/extra errors when either input is malformed.
  if (issues.length === 0) {
    for (const [key, expected] of example.entries) {
      const actual = env.entries.get(key);
      if (!actual) {
        if (!expected.optional) issues.push({ code: 'missing', source: 'env', key });
      } else if (!actual.value.trim()) {
        if (!expected.optional) {
          issues.push({ code: 'empty', source: 'env', key, line: actual.line });
        }
      } else if (PLACEHOLDER.test(actual.value.trim())) {
        issues.push({ code: 'placeholder', source: 'env', key, line: actual.line });
      }
    }
    if (strict) {
      for (const [key, actual] of env.entries) {
        if (!example.entries.has(key)) {
          issues.push({ code: 'unexpected', source: 'env', key, line: actual.line });
        }
      }
    }
  }
  return {
    version: 1,
    ok: issues.length === 0,
    summary: {
      expected: example.entries.size,
      required: [...example.entries.values()].filter(entry => !entry.optional).length,
      provided: env.entries.size,
      issues: issues.length,
    },
    issues,
  };
}
