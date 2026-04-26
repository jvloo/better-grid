# Security Policy

## Supported versions

Only the latest published `1.x` minor receives security patches.

## Reporting a vulnerability

**Do not open a public GitHub issue.** Use one of:

1. **GitHub private vulnerability reporting** — [Security → Advisories → Report a vulnerability](https://github.com/jvloo/better-grid/security/advisories/new). Preferred.
2. **Email** — **projects@xavierloo.com**, subject `[security] better-grid`. PGP available on request.

Include: where you found it (file + line), a minimal reproduction (code, browser, OS, version), the impact you believe it has, and whether you'd like to be credited.

## What counts as a vulnerability

In scope: XSS via untrusted data through any built-in renderer / formatter / editor; prototype pollution; DoS triggered by realistic end-user input (e.g. a clipboard payload that locks the tab); validation-rule bypass that lets invalid data persist downstream.

Out of scope: behavior controlled by user-authored renderers (`column.cellRenderer` runs your code by design), extreme-input perf issues (regular issue), upstream dependency CVEs we're tracking via dependabot.

## Response timeline

- Within 3 business days — acknowledgement.
- Within 14 days — initial assessment + target fix window.
- At fix release — coordinated disclosure with credit (unless you opt out).

CVEs issued via GitHub Advisories when applicable.
