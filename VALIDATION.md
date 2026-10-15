# Validation

Verified locally on 15 October 2026 using Windows and Node.js v24.20.0:

- `npm run check`: syntax checks and all 36 tests passed.
- `npm run demo`: passed with three required variables.
- The fictional invalid fixture, with `--strict --json`, exited with code 1
  and reported the expected empty, missing, placeholder and unexpected keys.
- Tests verify exit codes 0/1/2, redaction of sentinel values and input paths,
  bounded file reads, UTF-8 rejection, quotes, comments, optional markers,
  duplicates and deterministic output.

The CI workflow defines four combinations: Ubuntu/Windows and Node.js 22/24.
Those remote combinations are not claimed as locally tested. Check the
repository's Actions tab for their actual results.

All example configurations and test credentials are fictional. No external
service credentials or runtime dependencies are required.
