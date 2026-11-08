import type { JSX } from "react";
import { WORKFLOW_STEPS } from "../types";

interface CodeDisplayProps {
	currentStep: string | null;
}

// A shortened copy of worker/workflow.ts. Status reporting and error handling
// are left out so the four steps are easy to read. Line ranges for each step
// are in src/types.ts.
const WORKFLOW_CODE = `export class MyWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent, step: WorkflowStep) {
    const processed = await step.do("process data", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { processed: true, timestamp: Date.now() };
    });

    await step.sleep("wait 2 seconds", "2 seconds");

    const approval = await step.waitForEvent("wait for approval", {
      type: "user-approval",
      timeout: "60 minutes",
    });

    return step.do("final", async () => ({
      approved: approval.payload.approved,
      processedAt: processed.timestamp,
    }));
  }
}`;

const KEYWORDS = /^(export|class|extends|async|await|const|return|new)$/;

function highlight(line: string): JSX.Element {
	const tokens = line.split(
		/(\b(?:export|class|extends|async|await|const|return|new)\b|"[^"]*"|\b\d+\b)/g,
	);
	return (
		<>
			{tokens.map((token, i) => {
				if (!token) return null;
				if (KEYWORDS.test(token)) {
					return (
						<span key={i} className="text-run">
							{token}
						</span>
					);
				}
				if (token.startsWith('"')) {
					return (
						<span key={i} className="text-done">
							{token}
						</span>
					);
				}
				if (/^\d+$/.test(token)) {
					return (
						<span key={i} className="text-wait">
							{token}
						</span>
					);
				}
				return <span key={i}>{token}</span>;
			})}
		</>
	);
}

export function CodeDisplay({ currentStep }: CodeDisplayProps) {
	const lines = WORKFLOW_CODE.split("\n");
	const range = WORKFLOW_STEPS.find((s) => s.name === currentStep)?.lineRange;

	return (
		<pre className="overflow-x-auto rounded-md border border-rule bg-paper p-4 text-[13px] leading-6">
			<code className="block min-w-max font-mono text-ink">
				{lines.map((line, idx) => {
					const n = idx + 1;
					const active = range !== undefined && n >= range[0] && n <= range[1];
					return (
						<span
							key={idx}
							className={`grid grid-cols-[2rem_1fr] ${active ? "bg-run/10" : ""}`}
						>
							<span aria-hidden="true" className="select-none pr-3 text-right text-muted">
								{n}
							</span>
							<span className="whitespace-pre">{highlight(line || " ")}</span>
						</span>
					);
				})}
			</code>
		</pre>
	);
}
