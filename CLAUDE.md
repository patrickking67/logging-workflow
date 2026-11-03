# logging-workflow

Cloudflare Workflows starter: a React + Vite front end and a Worker that runs a multi-step Workflow (`MyWorkflow`) and pushes live status over WebSockets from a Durable Object (`WorkflowStatusDO`). Imported from Cloudflare's `workflows-starter-template`.

## Commands

| Task | Command | Notes |
| --- | --- | --- |
| Install | `npm ci` | |
| Dev server | `npm run dev` | Vite with the Cloudflare plugin, http://localhost:5173. Worker, Workflow and DO run locally |
| Build | `npm run build` | `tsc -b` then `vite build` into `dist/` |
| Lint | `npm run lint` | ESLint. 2 warnings, 0 errors on 2026-11-03 |
| Test | `npm test` | Vitest in the Workers pool. Prints workerd "Instance dispose" noise; check the pass count |
| Type check and bundle | `npm run check` | `tsc` plus `wrangler deploy --dry-run`; uploads nothing |
| Preview build | `npm run preview` | Builds, then `vite preview` |
| Worker types | `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` after a `wrangler.jsonc` change |
| Deploy | `npm run deploy` | **Publishes the Worker** to the Cloudflare account wrangler is logged in to. Only when PK asks |

## Layout

| Path | What it is |
| --- | --- |
| `src/` | React app: `App.tsx`, the workflow diagram and code panels, `hooks/useWorkflowWebSocket.ts` |
| `worker/index.ts` | Routes: `POST /api/workflow/start`, `GET /api/workflow/status/:id`, `POST /api/workflow/event/:id`, `GET /ws` |
| `worker/workflow.ts` | `MyWorkflow` steps, sleeps and the wait-for-event pause |
| `worker/durable-object.ts` | `WorkflowStatusDO`, holds WebSocket clients and broadcasts status |
| `test/workflow.test.ts` | Workflow tests |
| `wrangler.jsonc` | Bindings `MY_WORKFLOW` and `WORKFLOW_STATUS`, assets from `dist/` as a SPA |

## Conventions

- TypeScript and ES modules. JS, TS and JSON use tabs, matching the existing files.
- After changing bindings in `wrangler.jsonc`, run `npm run cf-typegen`.

## Verifying a change

1. `npm run build && npm run lint && npm test`
2. `npm run check`
3. UI or Worker change: `npm run dev`, start a workflow in the page, and watch the steps update.

## Deploys

- `wrangler.jsonc` has no routes or custom domains, so a deploy goes to the account's workers.dev subdomain.
- No CI is configured. Nothing deploys unless someone runs `npm run deploy`.
