import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

import { cloudflare } from "@cloudflare/vite-plugin";

// The repo does not install @types/node; this is the one Node API used here.
declare const process: { cwd(): string };

// Git worktrees live inside the repo. Ignore them relative to the folder the
// dev server runs from, so a server started inside a worktree still watches
// its own files.
const root = process.cwd().replace(/\\/g, "/");
const worktreeDirs = [`${root}/.worktrees/`, `${root}/.claude/worktrees/`];

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), cloudflare()],
	server: {
		// Fixed port so .claude/launch.json and the docs stay correct.
		port: 4109,
		strictPort: true,
		watch: {
			ignored: (path: string) =>
				worktreeDirs.some((dir) => path.replace(/\\/g, "/").startsWith(dir)),
		},
	},
});
