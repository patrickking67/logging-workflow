import type { RunEvent, StepName, StepStatus } from "./types";

/** "+00:03.214" style offset from the start of the run. */
export function formatOffset(ms: number): string {
	const safe = Math.max(0, Math.round(ms));
	const minutes = Math.floor(safe / 60000);
	const seconds = Math.floor((safe % 60000) / 1000);
	const millis = safe % 1000;
	return `+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/** "1.02 s" or "3 min 4 s". */
export function formatDuration(ms: number): string {
	if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
	const minutes = Math.floor(ms / 60000);
	const seconds = Math.round((ms % 60000) / 1000);
	return `${minutes} min ${seconds} s`;
}

export function formatClock(at: number): string {
	const d = new Date(at);
	return d.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
}

export const STATUS_WORDS: Record<StepStatus, string> = {
	pending: "Not started",
	running: "Running",
	waiting: "Waiting",
	completed: "Done",
	error: "Failed",
};

/** What a log line says for an event. */
export function describeEvent(event: RunEvent): string {
	if (event.step === null) {
		return event.status === "completed"
			? "completed"
			: `failed: ${event.detail ?? "unknown error"}`;
	}
	switch (event.status) {
		case "running":
			return "started";
		case "waiting":
			return "waiting for approval";
		case "completed":
			return event.detail ? `done (${event.detail})` : "done";
		case "error":
			return "failed";
		default:
			return event.status;
	}
}

/** Time each step took, from its first start to its completion. */
export function stepDurations(events: RunEvent[]): Partial<Record<StepName, number>> {
	const started: Partial<Record<StepName, number>> = {};
	const durations: Partial<Record<StepName, number>> = {};
	for (const event of events) {
		if (!event.step) continue;
		if ((event.status === "running" || event.status === "waiting") && started[event.step] === undefined) {
			started[event.step] = event.at;
		}
		if (event.status === "completed" && started[event.step] !== undefined) {
			durations[event.step] = event.at - started[event.step]!;
		}
	}
	return durations;
}
