import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { isValidInstanceId, parseApproval } from "../worker/index";

const BASE = "https://example.com";

describe("input validation", () => {
	it("accepts generated IDs and rejects odd ones", () => {
		expect(isValidInstanceId("3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b")).toBe(true);
		expect(isValidInstanceId("")).toBe(false);
		expect(isValidInstanceId("-leading-dash")).toBe(false);
		expect(isValidInstanceId("a/b")).toBe(false);
		expect(isValidInstanceId("x".repeat(101))).toBe(false);
		expect(isValidInstanceId(null)).toBe(false);
	});

	it("parses approval bodies", () => {
		expect(parseApproval({ approved: true })).toEqual({
			ok: true,
			value: { approved: true },
		});
		expect(parseApproval({ approved: false, comment: "no" })).toEqual({
			ok: true,
			value: { approved: false, comment: "no" },
		});
		expect(parseApproval({ approved: "yes" }).ok).toBe(false);
		expect(parseApproval({ approved: true, comment: 5 }).ok).toBe(false);
		expect(parseApproval({ approved: true, comment: "x".repeat(501) }).ok).toBe(false);
		expect(parseApproval([]).ok).toBe(false);
		expect(parseApproval(null).ok).toBe(false);
	});
});

describe("routes", () => {
	it("starts a run, accepts an approval and reports the finished run", async () => {
		const start = await SELF.fetch(`${BASE}/api/workflow/start`, { method: "POST" });
		expect(start.status).toBe(200);
		const { instanceId } = await start.json<{ instanceId: string }>();
		expect(isValidInstanceId(instanceId)).toBe(true);

		// Workflows keeps an event sent before the run reaches waitForEvent.
		const approve = await SELF.fetch(`${BASE}/api/workflow/event/${instanceId}`, {
			method: "POST",
			body: JSON.stringify({ approved: true, comment: "from the API test" }),
		});
		expect(approve.status).toBe(200);

		let status = "";
		for (let i = 0; i < 100 && status !== "complete"; i++) {
			await new Promise((resolve) => setTimeout(resolve, 200));
			const response = await SELF.fetch(`${BASE}/api/workflow/status/${instanceId}`);
			expect(response.status).toBe(200);
			status = (await response.json<{ status: string }>()).status;
		}
		expect(status).toBe("complete");
	}, 30_000);

	it("rejects the wrong method", async () => {
		const response = await SELF.fetch(`${BASE}/api/workflow/start`);
		expect(response.status).toBe(405);
	});

	it("rejects a bad instance ID", async () => {
		const response = await SELF.fetch(`${BASE}/api/workflow/status/a%2Fb`);
		expect(response.status).toBe(400);
	});

	it("returns 404 for an unknown run", async () => {
		const response = await SELF.fetch(`${BASE}/api/workflow/status/no-such-run`);
		expect(response.status).toBe(404);
	});

	it("rejects an approval that is not valid JSON", async () => {
		const response = await SELF.fetch(`${BASE}/api/workflow/event/some-run`, {
			method: "POST",
			body: "not json",
		});
		expect(response.status).toBe(400);
	});

	it("rejects an approval without a boolean", async () => {
		const response = await SELF.fetch(`${BASE}/api/workflow/event/some-run`, {
			method: "POST",
			body: JSON.stringify({ approved: "yes" }),
		});
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "approved must be true or false" });
	});

	it("needs a valid instance ID and an upgrade for the socket", async () => {
		expect((await SELF.fetch(`${BASE}/ws`)).status).toBe(400);
		expect((await SELF.fetch(`${BASE}/ws?instanceId=run-1`)).status).toBe(426);
	});
});
