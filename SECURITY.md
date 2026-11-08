# Security policy

## Supported versions

Only the latest commit on `main` is supported. There are no releases or public deployments.

## Reporting a vulnerability

Report privately through GitHub: https://github.com/patrickking67/logging-workflow/security/advisories/new

Please include what you found, how to reproduce it, and the impact you expect. Do not open a public issue for security problems.

## What to expect

This is a personal project maintained in spare time. I aim to acknowledge a report within 7 days and to share a plan or a fix within 30 days. I will credit you in the fix unless you ask me not to.

## Scope

In scope: the code in this repository (the Worker, Workflow, Durable Object and front end) and its configuration.

Out of scope: Cloudflare's platform itself, and the upstream template (report those to Cloudflare).

## Known limits

This is a demo, and its trust model is simple. Keep these in mind before deploying it:

- No authentication. Anyone who can reach the Worker can start runs, and anyone who knows a run ID can watch its log or approve or reject it.
- Run IDs are random UUIDs, which makes them hard to guess but not secret once shared.
- Input is validated (run ID format, approval body shape and size), but there is no rate limiting. Each started run creates a Workflow instance and a Durable Object.

If you deploy it publicly, put it behind Cloudflare Access or add your own auth first.
