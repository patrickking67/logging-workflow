import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { WorkflowUpdateMessage } from "../worker/status";

function statusStub(name: string) {
	return env.WORKFLOW_STATUS.get(env.WORKFLOW_STATUS.idFromName(name));
}

async function connect(name: string) {
	const response = await statusStub(name).fetch("https://example.com/ws", {
		headers: { Upgrade: "websocket" },
	});
	expect(response.status).toBe(101);
	const ws = response.webSocket!;
	const messages: WorkflowUpdateMessage[] = [];
	ws.addEventListener("message", (event) => {
		messages.push(JSON.parse(event.data as string));
	});
	ws.accept();
	return { ws, messages };
}

async function waitFor(check: () => boolean) {
	for (let i = 0; i < 50 && !check(); i++) {
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	expect(check()).toBe(true);
}

describe("WorkflowStatusDO", () => {
	it("records step updates and persists them to storage", async () => {
		const stub = statusStub("do-persist");
		await stub.updateStep("process data", "running");
		await stub.updateStep("process data", "completed");

		const state = await stub.getState();
		expect(state.stepStatuses["process data"]).toBe("completed");
		expect(state.events.map((e) => e.status)).toEqual(["running", "completed"]);

		await runInDurableObject(stub, async (_instance, ctx) => {
			const stored = await ctx.storage.get<{ events: unknown[] }>("run");
			expect(stored?.events).toHaveLength(2);
		});
	});

	it("rejects unknown steps and statuses", async () => {
		const stub = statusStub("do-validate");
		// @ts-expect-error testing a bad value from an untyped caller
		await expect(stub.updateStep("drop tables", "running")).rejects.toThrow(
			"Unknown step",
		);
		// @ts-expect-error testing a bad value from an untyped caller
		await expect(stub.updateStep("final", "pending")).rejects.toThrow(
			"Unknown step status",
		);
		expect((await stub.getState()).events).toEqual([]);
	});

	it("records a run error", async () => {
		const stub = statusStub("do-error");
		await stub.updateStep("wait for approval", "waiting");
		await stub.markError("Execution timed out");

		const state = await stub.getState();
		expect(state.workflowStatus).toBe("error");
		expect(state.stepStatuses["wait for approval"]).toBe("error");
		expect(state.error).toBe("Execution timed out");
	});

	it("sends state on connect and on every change", async () => {
		const { ws, messages } = await connect("do-socket");
		await waitFor(() => messages.length === 1);
		expect(messages[0]).toMatchObject({
			type: "workflow_update",
			workflowStatus: "running",
			events: [],
		});

		await statusStub("do-socket").updateStep("process data", "running");
		await waitFor(() => messages.length === 2);
		expect(messages[1].currentStep).toBe("process data");

		ws.send("refresh");
		await waitFor(() => messages.length === 3);
		ws.close();
	});

	it("replies to a close without a code using 1000", async () => {
		const stub = statusStub("do-close");
		await runInDurableObject(stub, async (instance) => {
			const calls: Array<[number, string]> = [];
			const socket = {
				close: (code: number, reason: string) => calls.push([code, reason]),
			} as unknown as WebSocket;

			await instance.webSocketClose(socket, 1005, "");
			await instance.webSocketClose(socket, 4000, "bye");
			expect(calls).toEqual([
				[1000, ""],
				[4000, "bye"],
			]);
		});
	});

	it("refuses plain HTTP requests", async () => {
		const response = await statusStub("do-http").fetch("https://example.com/");
		expect(response.status).toBe(400);
	});
});
