import { useEffect, useState } from "react";
import type { WorkflowUpdateMessage } from "../types";

export type Connection = "idle" | "connecting" | "open" | "reconnecting";

export interface LiveRun {
	connection: Connection;
	run: WorkflowUpdateMessage | null;
}

const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

function isUpdate(value: unknown): value is WorkflowUpdateMessage {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { type?: unknown }).type === "workflow_update" &&
		Array.isArray((value as { events?: unknown }).events)
	);
}

function initialState(instanceId: string | null): LiveRun {
	return { connection: instanceId ? "connecting" : "idle", run: null };
}

/**
 * Subscribe to the live state of one run. Reconnects with backoff if the
 * socket drops before the run has finished.
 */
export function useWorkflowWebSocket(instanceId: string | null): LiveRun {
	const [live, setLive] = useState<LiveRun>(() => initialState(instanceId));

	// Reset while rendering when the run changes, instead of from the effect.
	// https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
	const [trackedId, setTrackedId] = useState(instanceId);
	if (trackedId !== instanceId) {
		setTrackedId(instanceId);
		setLive(initialState(instanceId));
	}

	useEffect(() => {
		if (!instanceId) return;

		let socket: WebSocket | null = null;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let attempt = 0;
		let finished = false;
		let disposed = false;

		const connect = () => {
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const url = `${protocol}//${window.location.host}/ws?instanceId=${encodeURIComponent(instanceId)}`;
			socket = new WebSocket(url);

			socket.onopen = () => {
				attempt = 0;
				setLive((prev) => ({ ...prev, connection: "open" }));
			};

			socket.onmessage = (event) => {
				try {
					const data: unknown = JSON.parse(event.data);
					if (!isUpdate(data)) return;
					finished = data.workflowStatus !== "running";
					setLive({ connection: "open", run: data });
				} catch {
					// Ignore anything that is not a state message.
				}
			};

			socket.onclose = () => {
				if (disposed || finished || attempt >= RETRY_DELAYS_MS.length) {
					setLive((prev) => ({ ...prev, connection: "idle" }));
					return;
				}
				setLive((prev) => ({ ...prev, connection: "reconnecting" }));
				retryTimer = setTimeout(connect, RETRY_DELAYS_MS[attempt++]);
			};
		};

		connect();

		return () => {
			disposed = true;
			clearTimeout(retryTimer);
			socket?.close(1000, "Page closed the run");
		};
	}, [instanceId]);

	return live;
}
