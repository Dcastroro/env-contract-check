# Env Contract Check

[![CI](https://github.com/Dcastroro/env-contract-check/actions/workflows/ci.yml/badge.svg)](https://github.com/Dcastroro/env-contract-check/actions/workflows/ci.yml)

**Catch missing environment variables before your app starts.**

A local command-line tool that checks an environment file against a committed
`.env.example`. It reports missing variables, empty required values, recognizable
placeholders and duplicate definitions. Strict mode also catches undocumented
variables. Reports contain variable names and line numbers, never their values.

Built for onboarding, repeatable setup and configuration checks in CI.
Node.js 22+ · no dependencies · no network requests · no API keys.

## Try it in a minute

Clone the project and run the included fictional example:

```sh
git clone https://github.com/Dcastroro/env-contract-check.git
cd env-contract-check
npm ci --ignore-scripts
npm run demo
```

```text
PASS: 3 required variables validated.
```

Try the intentionally broken, fictional configuration:

```sh
node bin/env-contract-check.mjs --example examples/.env.example --env examples/.env.invalid --strict
```

```text
FAIL: 4 configuration issue(s).
  empty [env:2] APP_NAME: Required variable is empty.
  missing [env] PORT: Required variable is missing.
  placeholder [env:3] DATABASE_URL: Replace the placeholder with a configured value.
  unexpected [env:4] EXTRA_FLAG: Variable is absent from the contract.
```

The second command deliberately exits with code `1`.

## Check your own project

Keep the contract in version control. Keep real environment files out of it.

```dotenv
# .env.example
APP_NAME=my-app
PORT=3000
DATABASE_URL=<database-url>

# @optional
LOG_LEVEL=info
```

All variables are required by default. `# @optional` applies to the next
assignment, allowing it to be absent or empty. Comments and blank lines may
appear between the marker and the assignment. A provided, non-empty optional
value is still checked for recognizable placeholders.

Example values are documentation: they are never applied as defaults and are
never compared for equality. This tool checks configuration presence, not types
or connectivity; `PORT=not-a-number` passes the presence check.

From this tool's checkout, use explicit paths:

```sh
node bin/env-contract-check.mjs --example /path/to/app/.env.example --env /path/to/app/.env --strict
```

Quote paths that contain spaces. Paths resolve from the current working
directory. With no arguments, the CLI reads `.env.example` and `.env` there.
It does not read or modify `process.env`.

This first release is source-only; it has not been published to npm. Clone or
vendor the tool and invoke its entry point directly. No global install needed.

## Options and exit codes

| Option | Behavior |
| --- | --- |
| `--example <file>` | Contract path; defaults to `.env.example` |
| `--env <file>` | Environment path; defaults to `.env` |
| `--strict` | Report extra variables absent from the contract |
| `--json` | Print a stable, versioned JSON report |
| `--help` | Print usage |
| `--version` | Print the tool version |

| Exit code | Meaning |
| --- | --- |
| `0` | Validation passed |
| `1` | Configuration or contract validation failed |
| `2` | Invalid arguments or unreadable/unsupported input file |

Without `--strict`, extra variables are allowed. Duplicates and syntax errors
are always reported, including for extra variables. If either input has a
structural error, missing/empty/placeholder/extra checks are skipped until it is
fixed, avoiding misleading secondary errors. Empty contracts are rejected.

## Automation-friendly JSON

```sh
node bin/env-contract-check.mjs --example examples/.env.example --env examples/.env.invalid --strict --json
```

Reports use schema version `1`. Each validation issue has a `code` and `source`
(`example` or `env`); `key` and `line` are included when available. Read and usage
errors use an `error` object instead of `summary` and `issues`.
See [the complete examples](docs/report-examples.md).

Consumers should branch on exit codes and issue codes rather than the text
messages. Output is deterministic for identical inputs and options.

## Supported file syntax

- UTF-8, optional BOM, LF or CRLF; regular files up to 1 MiB each.
- One `KEY=value` assignment per line; optional `export` prefix.
- Keys match `[A-Za-z_][A-Za-z0-9_]*` and are case-sensitive.
- Leading/trailing whitespace around keys and values is ignored.
- Blank lines and full-line `#` comments are ignored.
- Unquoted inline comments start at `#` preceded by whitespace, or at the
  beginning of the value. `abc#fragment` remains a literal value.
- Single/double quotes must close on the same line. A closing quote may be
  followed by whitespace and a comment. Quoted hashes remain literal.
- Double-quoted values support `\n`, `\r`, `\t`, `\"` and `\\` escapes;
  other escapes retain their backslash. Single-quoted values are literal.
- Null bytes, malformed assignments and multiline quoted values are rejected.
- `${VARIABLE}` and shell expressions remain literal text. Nothing is expanded
  or executed; this tool is not a shell or a full dotenv implementation.

The placeholder detector deliberately recognizes a small set of whole values:
`changeme`, `change-me`, `change_me`, `replaceme`, `replace-me`, `replace_me`,
`TODO`, `your-…`, `your_…` and `<…>` (case-insensitive). It is a heuristic;
arbitrary fake credentials, embedded placeholders, and expired credentials are
outside its scope. Ordinary values such as `3000`, `false`, `localhost` and
`example` are allowed. Whitespace-only values count as empty.

## Use from JavaScript

```js
import { checkEnv } from './src/check.mjs';

const report = checkEnv({
  exampleText: 'PORT=3000\nDATABASE_URL=<database-url>',
  envText: 'PORT=8080',
  strict: true,
});

console.log(report.issues); // [{ code: 'missing', source: 'env', key: 'DATABASE_URL' }]
```

The text API does not perform file I/O and does not apply the CLI's file size
limit. Callers should bound untrusted input themselves.

## CI integration

After placing a reviewed checkout at `tools/env-contract-check`, run:

```yaml
- name: Validate environment contract
  run: node tools/env-contract-check/bin/env-contract-check.mjs --example .env.example --env .env.ci --strict
```

Prepare `.env.ci` using your existing CI configuration process. Do not commit
real credentials. The project's own workflow checks the parser, CLI and
fictional fixtures on Ubuntu and Windows with Node.js 22 and 24. Local
verification is recorded in [VALIDATION.md](VALIDATION.md).

## Development

### Run the check as a pipeline prerequisite

[Task Relay](https://github.com/Dcastroro/task-relay) can run this checker before
tests or builds and skip dependent work when validation fails. Both tools run
locally from source without runtime dependencies.
See the [integration configuration](https://github.com/Dcastroro/task-relay/blob/main/docs/integrations.md#use-env-contract-check-as-a-prerequisite).

### Check this project

```sh
npm ci --ignore-scripts
npm run check
```

Tests cover contract rules, parser boundaries, CLI exit codes, deterministic
JSON, bounded reads and checks against accidentally logging values.
See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Scope and next steps

Version `0.1.0` is a focused presence checker. It does not verify value types,
validate URLs, detect leaked secrets or prove that services are reachable.
Possible follow-ups are explicit type annotations, a JSON Schema for reports,
and reusable CI packaging, each with compatibility tests.

MIT license. Created by David Castro.
