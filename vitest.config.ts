import { mkdirSync } from "node:fs";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// wrangler.jsonc points static assets at ./dist. The Workers pool refuses to
// start if that folder is missing, so a fresh clone could not run tests before
// a build. The tests never read the assets, so an empty folder is enough.
mkdirSync("./dist", { recursive: true });

export default defineConfig({
	plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
	test: {
		// Workflow tests run real one second steps; leave room on slow CI runners.
		testTimeout: 20_000,
		exclude: ["**/node_modules/**", "**/dist/**", ".worktrees/**", ".claude/**"],
	},
});
