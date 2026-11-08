import { DurableObject } from "cloudflare:workers";
import {
	applyRunError,
	applyStepUpdate,
	initialRunState,
	isReportableStatus,
	isStepName,
	toUpdateMessage,
	type ReportableStepStatus,
	type RunState,
	type StepName,
} from "./status";

const STATE_KEY = "run";
const RESERVED_CLOSE_CODES = new Set([1005, 1006, 1015]);

/**
 * WorkflowStatusDO keeps the live state and run log for one workflow instance
 * (one object per instance ID) and pushes every change to the browsers
 * watching it.
 *
 * - The workflow reports progress through the `updateStep` and `markError`
 *   RPC methods.
 * - Browsers connect over a hibernatable WebSocket and get the full state on
 *   connect and after every change.
 * - State is written to storage so it survives hibernation and eviction.
 */
export class WorkflowStatusDO extends DurableObject<Env> {
	private state: RunState = initialRunState();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			const stored = await ctx.storage.get<RunState>(STATE_KEY);
			if (stored) this.state = stored;
		});
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected WebSocket", { status: 400 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// acceptWebSocket (rather than server.accept) lets the object hibernate
		// while sockets stay open.
		this.ctx.acceptWebSocket(server);
		server.send(this.message());

		return new Response(null, { status: 101, webSocket: client });
	}

	/** Called by the workflow when a step changes status. */
	async updateStep(
		step: StepName,
		status: ReportableStepStatus,
		detail?: string,
	): Promise<void> {
		if (!isStepName(step)) throw new Error(`Unknown step: ${String(step)}`);
		if (!isReportableStatus(status)) {
			throw new Error(`Unknown step status: ${String(status)}`);
		}
		await this.commit(applyStepUpdate(this.state, step, status, Date.now(), detail));
	}

	/** Called by the workflow when the run fails. */
	async markError(message: string): Promise<void> {
		await this.commit(applyRunError(this.state, String(message), Date.now()));
	}

	/** Current state, for tests and debugging. */
	async getState(): Promise<RunState> {
		return this.state;
	}

	/** Any message from a client is treated as a request for the current state. */
	async webSocketMessage(ws: WebSocket): Promise<void> {
		ws.send(this.message());
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
		// The compatibility date is before 2026-04-07, so the runtime does not
		// reply to the close frame by itself. Without this the client sees 1006.
		// 1005, 1006 and 1015 describe how a socket closed and may not be sent
		// back; a browser that closes without a code arrives here as 1005.
		const replyCode = RESERVED_CLOSE_CODES.has(code) ? 1000 : code;
		ws.close(replyCode, reason);
	}

	private async commit(next: RunState): Promise<void> {
		if (next === this.state) return;
		this.state = next;
		await this.ctx.storage.put(STATE_KEY, next);
		this.broadcast();
	}

	private message(): string {
		return JSON.stringify(toUpdateMessage(this.state, Date.now()));
	}

	private broadcast(): void {
		const json = this.message();
		for (const socket of this.ctx.getWebSockets()) {
			try {
				socket.send(json);
			} catch {
				// The socket is closing; it will be dropped by the runtime.
			}
		}
	}
}
