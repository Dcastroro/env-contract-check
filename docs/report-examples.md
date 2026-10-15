# Report examples

All data below is fictional. No input values or paths appear in output.

## Successful validation

```json
{
  "version": 1,
  "ok": true,
  "summary": { "expected": 4, "required": 3, "provided": 4, "issues": 0 },
  "issues": []
}
```

## Validation failure

For `examples/.env.invalid` with `--strict` (exit code `1`):

```json
{
  "version": 1,
  "ok": false,
  "summary": { "expected": 4, "required": 3, "provided": 3, "issues": 4 },
  "issues": [
    { "code": "empty", "source": "env", "key": "APP_NAME", "line": 2 },
    { "code": "missing", "source": "env", "key": "PORT" },
    { "code": "placeholder", "source": "env", "key": "DATABASE_URL", "line": 3 },
    { "code": "unexpected", "source": "env", "key": "EXTRA_FLAG", "line": 4 }
  ]
}
```

## File error

Exit code `2`; details such as input paths and operating-system errors are
intentionally omitted.

```json
{
  "version": 1,
  "ok": false,
  "error": {
    "code": "read-env",
    "message": "Cannot read input: use a regular UTF-8 file no larger than 1 MiB."
  }
}
```

`read-example` identifies a contract-file error; `usage` identifies invalid
arguments. `--help` and `--version` always print human-readable text, even when
combined with `--json`.
