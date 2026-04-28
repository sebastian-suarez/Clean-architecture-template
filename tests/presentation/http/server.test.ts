import { describe, expect, it } from "vitest";
import { OrderNotFoundError } from "#domain/order/errors.js";
import { createServer, type HttpDeps } from "#presentation/http/server.js";

function makeDeps(overrides: Partial<HttpDeps> = {}): HttpDeps {
	return {
		placeOrder: { async execute() {} },
		cancelOrder: {
			async execute() {
				throw new Error("not implemented in fake");
			},
		},
		getOrder: {
			async execute() {
				throw new Error("not implemented in fake");
			},
		},
		listOrders: {
			async execute() {
				return { items: [], nextCursor: undefined };
			},
		},
		...overrides,
	};
}

describe("HTTP server", () => {
	it("maps ORDER_NOT_FOUND to 404", async () => {
		const app = createServer(
			makeDeps({
				getOrder: {
					async execute() {
						throw new OrderNotFoundError("missing");
					},
				},
			}),
		);
		const response = await app.request("/orders/missing");
		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({ error: "ORDER_NOT_FOUND" });
	});

	it("returns 500 INTERNAL_ERROR for unexpected failures", async () => {
		const app = createServer(
			makeDeps({
				listOrders: {
					async execute() {
						throw new Error("boom");
					},
				},
			}),
		);
		const response = await app.request("/orders?customerId=u-1");
		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({ error: "INTERNAL_ERROR" });
	});
});
