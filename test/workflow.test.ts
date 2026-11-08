import { env, introspectWorkflowInstance } from "cloudflare:test";
import { describe, expect, it } from "vitest";

function statusFor(instanceId: string) {
	return env.WORKFLOW_STATUS.get(env.WORKFLOW_STATUS.idFromName(instanceId));
}

describe("MyWorkflow", () => {
	it("runs every step and returns the approval", async () => {
		const instanceId = "test-approved";
		await using instance = await introspectWorkflowInstance(env.MY_WORKFLOW, instanceId);
		await instance.modify(async (m) => {
			await m.disableSleeps();
			await m.mockEvent({
				type: "user-approval",
				payload: { approved: true, comment: "ship it" },
			});
		});

		await env.MY_WORKFLOW.create({ id: instanceId });

		const processed = await instance.waitForStepResult({ name: "process data" });
		expect(processed).toMatchObject({ processed: true });
		expect(processed).toHaveProperty("timestamp");

		expect(await instance.waitForStepResult({ name: "final" })).toMatchObject({
			approved: true,
			comment: "ship it",
		});
		await instance.waitForStatus("complete");

		const state = await statusFor(instanceId).getState();
		expect(state.workflowStatus).toBe("completed");
		expect(Object.values(state.stepStatuses).every((s) => s === "completed")).toBe(true);
		expect(state.events.find((e) => e.step === "wait for approval" && e.status === "completed"))
			.toMatchObject({ detail: "approved" });
	});

	it("records a rejection and still finishes the run", async () => {
		const instanceId = "test-rejected";
		await using instance = await introspectWorkflowInstance(env.MY_WORKFLOW, instanceId);
		await instance.modify(async (m) => {
			await m.disableSleeps();
			await m.mockEvent({ type: "user-approval", payload: { approved: false } });
		});

		await env.MY_WORKFLOW.create({ id: instanceId });
		expect(await instance.waitForStepResult({ name: "final" })).toMatchObject({
			approved: false,
			comment: null,
		});
		await instance.waitForStatus("complete");

		const state = await statusFor(instanceId).getState();
		expect(state.events.some((e) => e.detail === "rejected")).toBe(true);
	});

	it("reports an error when the approval times out", async () => {
		const instanceId = "test-timeout";
		await using instance = await introspectWorkflowInstance(env.MY_WORKFLOW, instanceId);
		await instance.modify(async (m) => {
			await m.disableSleeps();
			await m.forceEventTimeout({ name: "wait for approval" });
		});

		await env.MY_WORKFLOW.create({ id: instanceId });
		await instance.waitForStatus("errored");

		const state = await statusFor(instanceId).getState();
		expect(state.workflowStatus).toBe("error");
		expect(state.stepStatuses["wait for approval"]).toBe("error");
		expect(state.stepStatuses.final).toBe("pending");
		expect(state.error).toBeTruthy();
	});
});
