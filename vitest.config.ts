import { mkdirSync } from "node:fs";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// wrangler.jsonc points static assets at ./dist. The Workers pool refuses to
// start if that folder is missing, so a fresh clone could not run tests before
// a build. The tests never read the assets, so an empty folder is enough.
mkdirSync("./dist", { recursive: true });

// `npm test` runs test/workflow.test.ts in its own Vitest run. On Linux, once
// another test file has finished in the shared runtime, new Workflow instances
// never start (the engine cannot load worker/index.ts any more), so every test
// that runs a Workflow lives in that one file.
export default defineWorkersConfig({
	test: {
		// Workflow tests run real one second steps; leave room on slow CI runners.
		testTimeout: 20_000,
		exclude: ["**/node_modules/**", "**/dist/**", ".worktrees/**", ".claude/**"],
		poolOptions: {
			workers: {
				// Isolated storage does not support Durable Objects that hold
				// WebSockets. Tests use their own object and run names instead.
				isolatedStorage: false,
				wrangler: { configPath: "./wrangler.jsonc" },
			},
		},
	},
});
