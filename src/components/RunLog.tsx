import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { RunEvent } from "../types";
import { describeEvent, formatClock, formatOffset } from "../format";

interface RunLogProps {
	events: RunEvent[];
	empty: ReactNode;
}

const STATUS_TONE: Record<RunEvent["status"], string> = {
	pending: "text-muted",
	running: "text-run",
	waiting: "text-wait",
	completed: "text-done",
	error: "text-fail",
};

export function RunLog({ events, empty }: RunLogProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const startedAt = events[0]?.at ?? 0;

	// Keep the newest line in view without moving the page itself.
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [events.length]);

	if (events.length === 0) {
		return <div className="flex min-h-32 items-center sm:min-h-48">{empty}</div>;
	}

	return (
		<div ref={scrollRef} className="max-h-[26rem] overflow-y-auto">
			<ol
				role="log"
				aria-live="polite"
				aria-label="Run log"
				className="font-mono text-[13px] leading-6"
			>
				{events.map((event, index) => {
					const isNewest = index === events.length - 1;
					const subject = event.step ?? "run";
					return (
						<li
							key={`${event.at}-${index}`}
							className={`grid grid-cols-[6.25rem_1fr] gap-x-3 rounded-sm px-2 sm:grid-cols-[6.25rem_10.5rem_1fr] ${
								isNewest ? "log-newest" : ""
							} ${event.step === null ? "font-semibold" : ""}`}
						>
							<time
								dateTime={new Date(event.at).toISOString()}
								title={formatClock(event.at)}
								className="text-muted tabular-nums"
							>
								{formatOffset(event.at - startedAt)}
							</time>
							<span className="hidden truncate text-ink sm:block">{subject}</span>
							<span className={`min-w-0 break-words ${STATUS_TONE[event.status]}`}>
								<span className="text-ink sm:hidden">{subject} </span>
								{describeEvent(event)}
							</span>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
