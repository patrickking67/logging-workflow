export { MyWorkflow } from "./workflow";
export { WorkflowStatusDO } from "./durable-object";

/**
 * Routes:
 * - POST /api/workflow/start         start a run, returns { instanceId }
 * - GET  /api/workflow/status/:id    Workflows status for a run
 * - POST /api/workflow/event/:id     send { approved, comment? } to a waiting run
 * - GET  /ws?instanceId=:id          WebSocket with live state and run log
 *
 * Anything else falls through to the static assets (the React app).
 */

// Workflow instance IDs are at most 100 characters. The app only ever uses
// generated IDs, so anything outside this set is rejected before it reaches a
// binding or creates a Durable Object.
const INSTANCE_ID = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,99}$/;
const MAX_COMMENT_LENGTH = 500;
const MAX_BODY_CHARS = 4096;

export function isValidInstanceId(value: string | null | undefined): value is string {
	return typeof value === "string" && INSTANCE_ID.test(value);
}

export type ApprovalInput = { approved: boolean; comment?: string };

/** Validate the approval body. Returns the clean payload or an error message. */
export function parseApproval(
	body: unknown,
): { ok: true; value: ApprovalInput } | { ok: false; error: string } {
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		return { ok: false, error: "Body must be a JSON object" };
	}
	const { approved, comment } = body as Record<string, unknown>;
	if (typeof approved !== "boolean") {
		return { ok: false, error: "approved must be true or false" };
	}
	if (comment !== undefined) {
		if (typeof comment !== "string") {
			return { ok: false, error: "comment must be a string" };
		}
		if (comment.length > MAX_COMMENT_LENGTH) {
			return {
				ok: false,
				error: `comment must be at most ${MAX_COMMENT_LENGTH} characters`,
			};
		}
		return { ok: true, value: { approved, comment } };
	}
	return { ok: true, value: { approved } };
}

function error(message: string, status: number): Response {
	return Response.json({ error: message }, { status });
}

function idFromPath(pathname: string, prefix: string): string | null {
	const rest = pathname.slice(prefix.length);
	return isValidInstanceId(rest) ? rest : null;
}

async function readJson(request: Request): Promise<unknown> {
	const text = await request.text();
	if (text.length > MAX_BODY_CHARS) throw new Error("Body too large");
	return JSON.parse(text);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;

		if (pathname === "/api/workflow/start") {
			if (request.method !== "POST") return error("Use POST", 405);
			try {
				const instance = await env.MY_WORKFLOW.create({
					params: { startedAt: Date.now() },
				});
				return Response.json({ instanceId: instance.id });
			} catch (err) {
				console.error("Failed to start workflow", err);
				return error("Could not start the workflow", 500);
			}
		}

		if (pathname.startsWith("/api/workflow/status/")) {
			if (request.method !== "GET") return error("Use GET", 405);
			const id = idFromPath(pathname, "/api/workflow/status/");
			if (!id) return error("Invalid instance ID", 400);
			try {
				const instance = await env.MY_WORKFLOW.get(id);
				return Response.json(await instance.status());
			} catch {
				return error("No workflow run with that ID", 404);
			}
		}

		if (pathname.startsWith("/api/workflow/event/")) {
			if (request.method !== "POST") return error("Use POST", 405);
			const id = idFromPath(pathname, "/api/workflow/event/");
			if (!id) return error("Invalid instance ID", 400);

			let body: unknown;
			try {
				body = await readJson(request);
			} catch {
				return error("Body must be JSON under 4 KB", 400);
			}
			const parsed = parseApproval(body);
			if (!parsed.ok) return error(parsed.error, 400);

			let instance: WorkflowInstance;
			try {
				instance = await env.MY_WORKFLOW.get(id);
			} catch {
				return error("No workflow run with that ID", 404);
			}
			try {
				await instance.sendEvent({ type: "user-approval", payload: parsed.value });
				return Response.json({ ok: true });
			} catch (err) {
				console.error("Failed to send approval", err);
				return error("Could not deliver the approval. The run may have finished or timed out.", 409);
			}
		}

		if (pathname === "/ws") {
			const id = url.searchParams.get("instanceId");
			if (!isValidInstanceId(id)) return error("Invalid instance ID", 400);
			if (request.headers.get("Upgrade") !== "websocket") {
				return error("Expected Upgrade: websocket", 426);
			}
			const stub = env.WORKFLOW_STATUS.get(env.WORKFLOW_STATUS.idFromName(id));
			return stub.fetch(request);
		}

		return error("Not found", 404);
	},
} satisfies ExportedHandler<Env>;
