import { describe, expect, it } from "vitest";
import {
	MAX_DETAIL_LENGTH,
	MAX_EVENTS,
	STEP_NAMES,
	applyRunError,
	applyStepUpdate,
	initialRunState,
	isStepName,
	type RunState,
} from "../worker/status";

function runThrough(state: RunState, at = 1): RunState {
	let next = state;
	for (const step of STEP_NAMES) {
		next = applyStepUpdate(next, step, "running", at);
		next = applyStepUpdate(next, step, "completed", at);
	}
	return next;
}

describe("run state", () => {
	it("starts with every step pending and an empty log", () => {
		const state = initialRunState();
		expect(Object.values(state.stepStatuses)).toEqual([
			"pending",
			"pending",
			"pending",
			"pending",
		]);
		expect(state.workflowStatus).toBe("running");
		expect(state.currentStep).toBeNull();
		expect(state.events).toEqual([]);
	});

	it("tracks the current step and logs each change", () => {
		let state = applyStepUpdate(initialRunState(), "process data", "running", 10);
		expect(state.currentStep).toBe("process data");

		state = applyStepUpdate(state, "process data", "completed", 20);
		expect(state.currentStep).toBeNull();
		expect(state.events).toEqual([
			{ at: 10, step: "process data", status: "running" },
			{ at: 20, step: "process data", status: "completed" },
		]);
	});

	it("ignores a repeated report so replays do not duplicate log lines", () => {
		const once = applyStepUpdate(initialRunState(), "process data", "running", 1);
		const twice = applyStepUpdate(once, "process data", "running", 2);
		expect(twice).toBe(once);
	});

	it("completes the run when every step is completed", () => {
		const state = runThrough(initialRunState());
		expect(state.workflowStatus).toBe("completed");
		expect(state.currentStep).toBeNull();
		expect(state.events.at(-1)).toEqual({ at: 1, step: null, status: "completed" });
	});

	it("keeps the approval decision as detail", () => {
		const state = applyStepUpdate(
			initialRunState(),
			"wait for approval",
			"completed",
			5,
			"rejected",
		);
		expect(state.events.at(-1)).toMatchObject({ detail: "rejected" });
	});

	it("marks the step in progress and the run as failed on error", () => {
		let state = applyStepUpdate(initialRunState(), "wait for approval", "waiting", 1);
		state = applyRunError(state, "Execution timed out", 2);

		expect(state.workflowStatus).toBe("error");
		expect(state.error).toBe("Execution timed out");
		expect(state.stepStatuses["wait for approval"]).toBe("error");
		expect(state.currentStep).toBeNull();
		expect(state.events.slice(-2)).toEqual([
			{ at: 2, step: "wait for approval", status: "error" },
			{ at: 2, step: null, status: "error", detail: "Execution timed out" },
		]);
	});

	it("ignores updates once the run has finished", () => {
		const failed = applyRunError(initialRunState(), "boom", 1);
		expect(applyStepUpdate(failed, "final", "running", 2)).toBe(failed);
		expect(applyRunError(failed, "again", 3)).toBe(failed);

		const done = runThrough(initialRunState());
		expect(applyRunError(done, "late", 4)).toBe(done);
	});

	it("caps the log length and clips long text", () => {
		let state = initialRunState();
		for (let i = 0; i < MAX_EVENTS + 20; i++) {
			const status = i % 2 === 0 ? "running" : "waiting";
			state = applyStepUpdate(state, "process data", status, i);
		}
		expect(state.events).toHaveLength(MAX_EVENTS);
		expect(state.events[0].at).toBe(20);

		const failed = applyRunError(initialRunState(), "x".repeat(1000), 1);
		expect(failed.error).toHaveLength(MAX_DETAIL_LENGTH);
	});

	it("recognises only known step names", () => {
		expect(isStepName("final")).toBe(true);
		expect(isStepName("drop tables")).toBe(false);
	});
});
