/**
 * Front-end types. Run state shapes come from the Worker so both sides agree.
 */
import type { StepName } from "../worker/status";

export type {
	RunEvent,
	RunStatus,
	StepName,
	StepStatus,
	WorkflowUpdateMessage,
} from "../worker/status";

export interface StepDefinition {
	name: StepName;
	description: string;
	/** Lines in the source shown by CodeDisplay, 1-based and inclusive. */
	lineRange: [number, number];
}

export const WORKFLOW_STEPS: StepDefinition[] = [
	{
		name: "process data",
		description: "Durable work that returns data",
		lineRange: [3, 6],
	},
	{
		name: "wait 2 seconds",
		description: "A durable sleep",
		lineRange: [8, 8],
	},
	{
		name: "wait for approval",
		description: "Pauses until you approve or reject",
		lineRange: [10, 13],
	},
	{
		name: "final",
		description: "Uses results from earlier steps",
		lineRange: [15, 18],
	},
];
