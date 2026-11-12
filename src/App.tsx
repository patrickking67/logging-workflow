import { useState } from "react";
import { CodeDisplay } from "./components/CodeDisplay";
import { RunLog } from "./components/RunLog";
import { StepList } from "./components/StepList";
import { useWorkflowWebSocket } from "./hooks/useWorkflowWebSocket";
import type { Connection } from "./hooks/useWorkflowWebSocket";

const REPO_URL = "https://github.com/patrickking67/logging-workflow";
const TEMPLATE_URL =
	"https://github.com/cloudflare/templates/tree/main/workflows-starter-template";

const CONNECTION_WORDS: Record<Connection, string> = {
	idle: "Not connected",
	connecting: "Connecting",
	open: "Live",
	reconnecting: "Reconnecting",
};

async function readError(response: Response, fallback: string): Promise<string> {
	try {
		const body = (await response.json()) as { error?: unknown };
		return typeof body.error === "string" ? body.error : fallback;
	} catch {
		return fallback;
	}
}

function App() {
	const [instanceId, setInstanceId] = useState<string | null>(null);
	const [starting, setStarting] = useState(false);
	const [startError, setStartError] = useState<string | null>(null);
	const [sendingApproval, setSendingApproval] = useState(false);
	const [approvalError, setApprovalError] = useState<string | null>(null);

	const { connection, run } = useWorkflowWebSocket(instanceId);
	const runStatus = run?.workflowStatus ?? null;
	const isActive = instanceId !== null && (runStatus === null || runStatus === "running");
	const events = run?.events ?? [];

	const startRun = async () => {
		setStarting(true);
		setStartError(null);
		setApprovalError(null);
		try {
			const response = await fetch("/api/workflow/start", { method: "POST" });
			if (!response.ok) {
				throw new Error(await readError(response, "The Worker did not start the run."));
			}
			const data = (await response.json()) as { instanceId: string };
			setInstanceId(data.instanceId);
		} catch (err) {
			setStartError(
				`${err instanceof Error ? err.message : "The run did not start."} Check that the dev server is running, then try again.`,
			);
		} finally {
			setStarting(false);
		}
	};

	const decide = async (approved: boolean) => {
		if (!instanceId) return;
		setSendingApproval(true);
		setApprovalError(null);
		try {
			const response = await fetch(
				`/api/workflow/event/${encodeURIComponent(instanceId)}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						approved,
						comment: approved ? "Approved in the browser" : "Rejected in the browser",
					}),
				},
			);
			if (!response.ok) {
				setApprovalError(await readError(response, "The answer was not delivered."));
			}
		} catch {
			setApprovalError("The answer was not delivered. Check your connection and try again.");
		} finally {
			setSendingApproval(false);
		}
	};

	const startLabel = starting
		? "Starting"
		: runStatus === "completed" || runStatus === "error"
			? "Start another run"
			: "Start a run";

	return (
		<div className="min-h-screen bg-paper text-ink">
			<a href="#log" className="skip-link">
				Skip to the run log
			</a>

			<div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-8 sm:pt-12">
				<header className="flex flex-col gap-6 border-b border-rule pb-8 sm:flex-row sm:items-end sm:justify-between">
					<div className="max-w-xl">
						<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
							Workflow run log
						</h1>
						<p className="mt-3 text-base leading-7 text-muted">
							Start a Cloudflare Workflow and watch each step get logged as it
							happens. The run pauses for your approval before its last step.
						</p>
					</div>
					<button
						type="button"
						onClick={startRun}
						disabled={starting || isActive}
						className="btn btn-primary btn-lg self-start sm:self-auto"
					>
						{startLabel}
					</button>
				</header>

				{startError && (
					<p role="alert" className="mt-6 rounded-md border border-fail/40 bg-fail/6 p-3 text-sm text-fail">
						{startError}
					</p>
				)}

				<main className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-0">
					<section aria-labelledby="steps-heading" className="lg:border-r lg:border-rule lg:pr-10">
						<h2 id="steps-heading" className="mb-5 text-lg font-semibold">
							Steps
						</h2>
						<StepList
							statuses={run?.stepStatuses ?? null}
							events={events}
							approval={{
								pending: run?.stepStatuses["wait for approval"] === "waiting",
								sending: sendingApproval,
								error: approvalError,
								onDecide: decide,
							}}
						/>
					</section>

					<section id="log" aria-labelledby="log-heading" className="min-w-0 lg:pl-10">
						<div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
							<h2 id="log-heading" className="text-lg font-semibold">
								Run log
							</h2>
							{instanceId && (
								<p className="text-sm text-muted">
									<span
										aria-hidden="true"
										className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
											isActive && connection === "open" ? "bg-done" : "bg-rule"
										}`}
									/>
									{runStatus === "completed"
										? "Finished"
										: runStatus === "error"
											? "Stopped"
											: CONNECTION_WORDS[connection]}
								</p>
							)}
						</div>

						<div className="rounded-md border border-rule bg-surface py-3">
							<RunLog
								events={events}
								empty={
									<p className="px-4 text-sm text-muted">
										{instanceId
											? "Waiting for the first step."
											: "No run yet. Start a run and each step will be logged here with its time."}
									</p>
								}
							/>
						</div>

						{instanceId && (
							<p className="mt-3 break-all font-mono text-xs text-muted">
								Run ID {instanceId}
							</p>
						)}
					</section>
				</main>

				<details className="mt-12 border-t border-rule pt-6">
					<summary className="cursor-pointer text-lg font-semibold">
						The workflow code
					</summary>
					<p className="mt-2 mb-4 text-sm text-muted">
						A shortened copy of <code className="font-mono">worker/workflow.ts</code>. The
						step that is running is highlighted.
					</p>
					<CodeDisplay currentStep={run?.currentStep ?? null} />
				</details>

				<footer className="mt-12 border-t border-rule pt-6 text-sm leading-6 text-muted">
					<p>
						Runs on Cloudflare Workers, Workflows and Durable Objects.{" "}
						<a className="link" href={REPO_URL}>
							Source on GitHub
						</a>
						. Started from Cloudflare&apos;s{" "}
						<a className="link" href={TEMPLATE_URL}>
							Workflows starter template
						</a>{" "}
						(MIT).
					</p>
				</footer>
			</div>
		</div>
	);
}

export default App;
