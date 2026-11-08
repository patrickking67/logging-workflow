# Contributing

Thanks for taking a look. This is a small personal project, so keep changes focused.

## Setup

```bash
npm ci
npm run dev    # http://localhost:4109
```

Node.js 20.19 or later. No Cloudflare account is needed for local work.

## Branches

Branch from `main` with one of these prefixes:

- `feat/` new behavior
- `fix/` bug fixes
- `docs/` documentation only
- `chore/` tooling, dependencies, housekeeping

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `build:`, `ci:`, `test:`, `refactor:`. One logical change per commit, and each commit should pass the checks.

## Checks

```bash
npm run check
```

Runs lint, typecheck, tests, the production build and a Wrangler dry run. CI runs the same command on every pull request.

## Pull request checklist

- [ ] `npm run check` passes
- [ ] Tests added or updated for changed behavior
- [ ] UI changes checked at desktop width and 375px, in light and dark mode
- [ ] README.md, AGENTS.md and CHANGELOG.md updated if behavior or commands changed
- [ ] No secrets, account IDs or personal data

## Security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).
