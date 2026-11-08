import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";
import type { ReportableStepStatus, StepName } from "./status";

export interface ApprovalPayload {
	approved: boolean;
	comment?: string;
}

export interface RunOutput {
	approved: boolean;
	comment: string | null;
	processedAt: number;
}

/**
 * A four step run that shows the main Workflows primitives:
 * - step.do for durable, retried work that returns data
 * - step.sleep for a durable delay
 * - step.waitForEvent to pause until a person approves or rejects
 * - data from earlier steps used in the last step
 *
 * Every step change is reported to WorkflowStatusDO, which logs it and pushes
 * it to the browser.
 *
 * @see https://developers.cloudflare.com/workflows
 */
export class MyWorkflow extends WorkflowEntrypoint<Env, Record<string, unknown>> {
	async run(
		event: WorkflowEvent<Record<string, unknown>>,
		step: WorkflowStep,
	): Promise<RunOutput> {
		const status = this.env.WORKFLOW_STATUS.get(
			this.env.WORKFLOW_STATUS.idFromName(event.instanceId),
		);

		// Reports happen outside step.do, so they can repeat if the instance
		// restarts. That is safe: the Durable Object ignores a report that does
		// not change anything. A failed report must never fail the run.
		// https://developers.cloudflare.com/workflows/build/rules-of-workflows/
		const report = async (
			name: StepName,
			value: ReportableStepStatus,
			detail?: string,
		) => {
			try {
				await status.updateStep(name, value, detail);
			} catch (err) {
				console.warn("Could not report step status", name, value, err);
			}
		};

		try {
			await report("process data", "running");
			const processed = await step.do("process data", async () => {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				return { processed: true, timestamp: Date.now() };
			});
			await report("process data", "completed");

			await report("wait 2 seconds", "running");
			await step.sleep("wait 2 seconds", "2 seconds");
			await report("wait 2 seconds", "completed");

			await report("wait for approval", "waiting");
			const approval = await step.waitForEvent<ApprovalPayload>(
				"wait for approval",
				{ type: "user-approval", timeout: "60 minutes" },
			);
			const approved = approval.payload?.approved === true;
			await report(
				"wait for approval",
				"completed",
				approved ? "approved" : "rejected",
			);

			await report("final", "running");
			const output = await step.do("final", async () => {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				return {
					approved,
					comment: approval.payload?.comment ?? null,
					processedAt: processed.timestamp,
				};
			});
			await report("final", "completed");

			return output;
		} catch (err) {
			// Log the failure for the browser, then rethrow so the instance
			// still ends in the errored state.
			const message = err instanceof Error ? err.message : String(err);
			try {
				await status.markError(message);
			} catch (reportErr) {
				console.warn("Could not report run error", reportErr);
			}
			throw err;
		}
	}
}
