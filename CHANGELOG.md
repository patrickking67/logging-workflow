# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). There are no tagged releases yet.

## [Unreleased]

### Added

- Run log: the Durable Object keeps a timestamped log of every step change (capped at 100 lines) and sends it with each update.
- Reject button next to Approve. The decision is logged and returned as the run's output.
- Failed runs, such as an approval timeout, are reported to the Durable Object and shown on the page.
- WebSocket reconnect with backoff while a run is in progress.
- Tests for the run state rules, the Durable Object, the Workflow approve, reject and timeout paths, and the HTTP routes.
- `npm run check` (lint, typecheck, tests, build, Wrangler dry run) and a GitHub Actions workflow that runs it.
- AGENTS.md, CLAUDE.md, CONTRIBUTING.md, SECURITY.md, llms.txt, `.editorconfig`, `.gitattributes`, issue and pull request templates, CODEOWNERS and Dependabot config.
- `.claude/launch.json` for the dev server on port 4109.
- LICENSE with the upstream MIT text and Cloudflare's copyright, plus a note for changes made here.

### Changed

- Tailwind CSS 3 to 4, built with `@tailwindcss/vite`. The theme moved from `tailwind.config.js` into `src/index.css`. Tailwind 4 needs Safari 16.4, Chrome 111 or Firefox 128 and later.
- Redesigned the page around the run log and an ordered step list, with light and dark themes, visible focus, reduced motion support and a layout that holds at 375px.
- The dev server runs on port 4109 instead of 5173.
- Rewrote the README for this project, with credit to the upstream template.
- The code view on the page matches the current Workflow source.

### Fixed

- The Worker now validates run IDs and approval bodies, enforces methods, and returns 404 for unknown runs and 409 when an approval cannot be delivered, instead of a generic 500.
- The Durable Object replied to a close without a status code using reserved code 1005, which throws.
- `npm test` failed on a fresh clone until `dist/` existed.
- `npm run check` called `tsc` without `-b`, so it type checked nothing.
- Lint warnings from the generated `worker-configuration.d.ts`.

## 2026-05-20

- Imported Cloudflare's Workflows Starter Template (`cloudflare/templates`, `workflows-starter-template`) as the starting point.
