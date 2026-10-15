# Security

The CLI reads two explicitly selected local files, performs no network
requests, does not execute values and does not modify the inputs or
`process.env`. File reads are bounded to 1 MiB each. The JavaScript text API
expects callers to apply their own size limits.

Reports expose variable **names**, line numbers, counts and generic error
codes. Values, raw invalid lines, file paths and operating-system error text
are excluded. If variable names themselves are sensitive, treat reports as
private. Input values exist in process memory during checking; this tool
does not protect against process inspection or host compromise.

This is a configuration presence check, not a secret scanner, authentication
check or proof that configuration is safe. Never commit real `.env` files.
The tracked demonstration files contain fictional local data only.

If you find an issue that could disclose values or execute input, do not post
credentials or an exploit containing private data in a public issue. Contact
the maintainer through the contact channel linked on their GitHub profile and
provide a minimal reproduction using fabricated data.
