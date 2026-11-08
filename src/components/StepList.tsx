import type { RunEvent, StepStatus } from "../types";
import { WORKFLOW_STEPS } from "../types";
import { STATUS_WORDS, formatDuration, stepDurations } from "../format";

interface StepListProps {
	statuses: Record<string, StepStatus> | null;
	events: RunEvent[];
	approval: {
		pending: boolean;
		sending: boolean;
		error: string | null;
		onDecide: (approved: boolean) => void;
	};
}

const MARK_CLASS: Record<StepStatus, string> = {
	pending: "border-rule bg-surface text-muted",
	running: "border-run bg-run text-surface",
	waiting: "border-wait bg-surface text-wait",
	completed: "border-done bg-done text-surface",
	error: "border-fail bg-fail text-surface",
};

const WORD_CLASS: Record<StepStatus, string> = {
	pending: "text-muted",
	running: "text-run",
	waiting: "text-wait",
	completed: "text-done",
	error: "text-fail",
};

export function StepList({ statuses, events, approval }: StepListProps) {
	const durations = stepDurations(events);

	return (
		<ol className="relative">
			{WORKFLOW_STEPS.map((step, index) => {
				const status = statuses?.[step.name] ?? "pending";
				const duration = durations[step.name];
				const isLast = index === WORKFLOW_STEPS.length - 1;
				const showApproval = step.name === "wait for approval" && approval.pending;

				return (
					<li key={step.name} className="relative flex gap-4 pb-7 last:pb-0">
						{!isLast && (
							<span
								aria-hidden="true"
								className={`absolute left-[15px] top-8 bottom-0 w-px ${
									status === "completed" ? "bg-done" : "bg-rule"
								}`}
							/>
						)}
						<span
							aria-hidden="true"
							className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-semibold transition-colors duration-300 ${MARK_CLASS[status]} ${
								status === "running" ? "motion-safe:animate-pulse" : ""
							}`}
						>
							{index + 1}
						</span>

						<div className="min-w-0 flex-1 pt-0.5">
							<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
								<h3 className="font-mono text-[15px] font-medium text-ink">
									{step.name}
								</h3>
								<p className="text-sm">
									<span className={`font-medium ${WORD_CLASS[status]}`}>
										{STATUS_WORDS[status]}
									</span>
									{duration !== undefined && (
										<span className="text-muted"> in {formatDuration(duration)}</span>
									)}
								</p>
							</div>
							<p className="mt-0.5 text-sm text-muted">{step.description}</p>

							{showApproval && (
								<div className="mt-3 rounded-md border border-wait/40 bg-wait/[0.06] p-3">
									<p className="text-sm text-ink">
										The run is paused. Your answer is sent as a{" "}
										<code className="font-mono text-[13px]">user-approval</code> event.
									</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<button
											type="button"
											onClick={() => approval.onDecide(true)}
											disabled={approval.sending}
											className="btn btn-primary"
										>
											Approve
										</button>
										<button
											type="button"
											onClick={() => approval.onDecide(false)}
											disabled={approval.sending}
											className="btn btn-quiet"
										>
											Reject
										</button>
									</div>
									{approval.error && (
										<p role="alert" className="mt-2 text-sm text-fail">
											{approval.error}
										</p>
									)}
								</div>
							)}
						</div>
					</li>
				);
			})}
		</ol>
	);
}
