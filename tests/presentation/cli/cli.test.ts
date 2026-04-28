import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderNotFoundError } from "#domain/order/errors.js";
import { type CliDeps, runCli } from "#presentation/cli/cli.js";

function makeDeps(overrides: Partial<CliDeps> = {}): CliDeps {
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
		listOrderSummaries: {
			async execute() {
				return { items: [], nextCursor: undefined };
			},
		},
		...overrides,
	};
}

describe("runCli", () => {
	let log: ReturnType<typeof vi.spyOn>;
	let error: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		error = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prints help and returns 0 with no args", async () => {
		const code = await runCli([], makeDeps());
		expect(code).toBe(0);
		const printed = JSON.stringify(log.mock.calls);
		expect(printed).toContain("Commands:");
		expect(printed).toContain("place-order");
	});

	it("returns 1 and prints help for unknown command", async () => {
		const code = await runCli(["bogus"], makeDeps());
		expect(code).toBe(1);
		expect(error).toHaveBeenCalledWith(
			expect.stringContaining("Unknown command"),
		);
	});

	it("translates DomainError into '[code]: message' and returns 1", async () => {
		const code = await runCli(
			["get-order", "missing"],
			makeDeps({
				getOrder: {
					async execute() {
						throw new OrderNotFoundError("missing");
					},
				},
			}),
		);
		expect(code).toBe(1);
		expect(error).toHaveBeenCalledWith(
			expect.stringContaining("[ORDER_NOT_FOUND]"),
		);
	});
});
