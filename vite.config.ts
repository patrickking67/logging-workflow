import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), cloudflare()],
	server: {
		watch: {
			// Git worktrees live inside the repo; do not watch their files.
			ignored: ["**/.worktrees/**", "**/.claude/worktrees/**"],
		},
	},
});
