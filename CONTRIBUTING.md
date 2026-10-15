# Contributing

Use Node.js 22 or newer. Run `npm ci --ignore-scripts` and `npm run check`.
There are no third-party dependencies or build steps.

For behavior changes, add a focused parser or CLI regression test and update
the documented syntax/report contract. Keep diagnostics deterministic. Never
include raw input values or file paths in diagnostics. Use fictional fixtures
only, never real environment files or credentials.

Keep changes small and state the problem, expected behavior and verification
in a pull request. Parser compatibility and privacy checks matter more than
supporting every dotenv dialect. Discuss syntax or report schema changes
before depending on them in another project.
