# Security Policy

## Supported versions

Better Grid is on `1.x`. Until a `2.x` ships, only the latest published `1.x` minor receives security patches.

| Version | Supported          |
| ------- | ------------------ |
| `1.x`   | ✓ (latest minor)   |
| `0.x`   | No (pre-release)   |

## Reporting a vulnerability

**Do not open a public GitHub issue for security findings.**

Please use one of:

1. **GitHub private vulnerability reporting** — go to the repo's [Security → Advisories → Report a vulnerability](https://github.com/jvloo/better-grid/security/advisories/new) tab. Preferred channel.
2. **Email** the maintainer at **projects@xavierloo.com** with `[security] better-grid` in the subject. Encrypt with PGP if you prefer (request key via the same address).

Please include:

- A description of the issue and where you found it (file path + line number, if possible).
- A reproduction (minimal code, browser, OS, Better Grid version).
- The impact you believe it has (e.g. XSS via a cell renderer that doesn't escape, prototype pollution via filter input, etc.).
- Whether you'd like to be credited in the advisory.

## What we treat as a vulnerability

- Cross-site scripting (XSS) via untrusted data flowing through any built-in cell renderer, formatter, or editor.
- Prototype pollution in any `@better-grid/*` package.
- Denial-of-service that can be triggered by a payload an end-user could realistically send (e.g. a pasted clipboard payload that locks the browser tab).
- Bypass of any documented validation rule that allows persisting invalid data downstream.

## What we do NOT treat as a vulnerability

- Behavior controlled entirely by user-authored renderers (`column.cellRenderer`) — those run user code by design and are the user's responsibility to escape.
- Performance issues with extreme inputs (e.g. 10M cells on a 4-year-old phone). Open a regular issue.
- Issues in dependencies that are tracked upstream. We'll update; please link the upstream advisory instead.

## Response timeline

- **Within 3 business days** — acknowledgement of the report.
- **Within 14 days** — initial assessment and a target fix window.
- **At fix release** — coordinated disclosure with credit (unless you opt out).

We use GitHub's coordinated-disclosure flow for advisories. CVEs are issued via GitHub when applicable.

## Hall of fame

A list of researchers who have responsibly disclosed issues to Better Grid. Contributions welcome — be the first.
