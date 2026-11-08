/**
 * Run state for one workflow instance, as kept by WorkflowStatusDO and
 * streamed to the browser. Pure functions only, so the same rules are used by
 * the Durable Object and can be unit tested without the runtime.
 */

/** Step names, in run order. They must match the names used in workflow.ts. */
export const STEP_NAMES = [
	"process data",
	"wait 2 seconds",
	"wait for approval",
	"final",
] as const;

export type StepName = (typeof STEP_NAMES)[number];
export type StepStatus = "pending" | "running" | "waiting" | "completed" | "error";
export type RunStatus = "running" | "completed" | "error";

/** Statuses the workflow may report for a step. */
export const REPORTABLE_STEP_STATUSES = ["running", "waiting", "completed"] as const;
export type ReportableStepStatus = (typeof REPORTABLE_STEP_STATUSES)[number];

/** One line in the run log. `step` is null for run-level entries. */
export interface RunEvent {
	at: number;
	step: StepName | null;
	status: StepStatus | RunStatus;
	detail?: string;
}

export interface RunState {
	stepStatuses: Record<StepName, StepStatus>;
	currentStep: StepName | null;
	workflowStatus: RunStatus;
	error: string | null;
	events: RunEvent[];
}

export interface WorkflowUpdateMessage extends RunState {
	type: "workflow_update";
	timestamp: number;
}

/** Oldest log lines are dropped past this many, to bound storage. */
export const MAX_EVENTS = 100;
/** Detail and error text longer than this is cut. */
export const MAX_DETAIL_LENGTH = 200;

export function isStepName(value: unknown): value is StepName {
	return (STEP_NAMES as readonly unknown[]).includes(value);
}

export function isReportableStatus(
	value: unknown,
): value is ReportableStepStatus {
	return (REPORTABLE_STEP_STATUSES as readonly unknown[]).includes(value);
}

export function initialRunState(): RunState {
	const stepStatuses = Object.fromEntries(
		STEP_NAMES.map((name) => [name, "pending"]),
	) as Record<StepName, StepStatus>;
	return {
		stepStatuses,
		currentStep: null,
		workflowStatus: "running",
		error: null,
		events: [],
	};
}

function clip(text: string): string {
	return text.length > MAX_DETAIL_LENGTH
		? `${text.slice(0, MAX_DETAIL_LENGTH - 3)}...`
		: text;
}

function appendEvent(events: RunEvent[], event: RunEvent): RunEvent[] {
	const next = [...events, event];
	return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
}

/**
 * Apply a step status reported by the workflow.
 *
 * Workflow code outside `step.do` can replay after a restart, so the same
 * report may arrive twice. A report that does not change the step is ignored,
 * which keeps the log free of duplicates. Reports after the run has finished
 * are ignored too.
 */
export function applyStepUpdate(
	state: RunState,
	step: StepName,
	status: ReportableStepStatus,
	at: number,
	detail?: string,
): RunState {
	if (state.workflowStatus !== "running") return state;
	if (state.stepStatuses[step] === status) return state;

	const stepStatuses = { ...state.stepStatuses, [step]: status };
	let currentStep = state.currentStep;
	if (status === "running" || status === "waiting") {
		currentStep = step;
	} else if (currentStep === step) {
		currentStep = null;
	}

	let events = appendEvent(state.events, {
		at,
		step,
		status,
		...(detail ? { detail: clip(detail) } : {}),
	});

	let workflowStatus: RunStatus = state.workflowStatus;
	if (STEP_NAMES.every((name) => stepStatuses[name] === "completed")) {
		workflowStatus = "completed";
		currentStep = null;
		events = appendEvent(events, { at, step: null, status: "completed" });
	}

	return { ...state, stepStatuses, currentStep, workflowStatus, events };
}

/** Mark the run as failed. The step in progress, if any, is marked as failed. */
export function applyRunError(
	state: RunState,
	message: string,
	at: number,
): RunState {
	if (state.workflowStatus !== "running") return state;

	const error = clip(message || "Workflow failed");
	const stepStatuses = { ...state.stepStatuses };
	let events = state.events;
	if (state.currentStep) {
		stepStatuses[state.currentStep] = "error";
		events = appendEvent(events, {
			at,
			step: state.currentStep,
			status: "error",
		});
	}
	events = appendEvent(events, {
		at,
		step: null,
		status: "error",
		detail: error,
	});

	return {
		...state,
		stepStatuses,
		currentStep: null,
		workflowStatus: "error",
		error,
		events,
	};
}

export function toUpdateMessage(
	state: RunState,
	timestamp: number,
): WorkflowUpdateMessage {
	return { type: "workflow_update", ...state, timestamp };
}
