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
