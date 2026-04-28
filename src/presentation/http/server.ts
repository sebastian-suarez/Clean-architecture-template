import { Hono } from "hono";
import { type ContentfulStatusCode } from "hono/utils/http-status";
import { DomainError } from "#domain/shared/domain-error.js";
import {
	registerOrderRoutes,
	type OrderRoutesDeps,
} from "#presentation/http/routes/orders.js";

export type HttpDeps = OrderRoutesDeps;

const statusByCode = new Map<string, ContentfulStatusCode>([
	// Order context
	["INVALID_ORDER_ID", 400],
	["INVALID_CUSTOMER_ID", 400],
	["INVALID_MONEY", 400],
	["CURRENCY_MISMATCH", 400],
	["INVALID_QUANTITY", 400],
	["INVALID_SKU", 400],
	["EMPTY_ORDER", 400],
	["ORDER_NOT_FOUND", 404],
	["ORDER_ALREADY_CANCELLED", 409],
	["ORDER_ALREADY_SHIPPED", 409],
	["ORDER_NOT_MUTABLE", 409],
	["CUSTOMER_NOT_FOUND", 404],
	["CUSTOMER_INACTIVE", 409],
	// Cross-cutting
	["FORBIDDEN", 403],
	["RATE_LIMIT_EXCEEDED", 429],
	["CONCURRENT_UPDATE", 409],
]);

export function createServer(deps: HttpDeps): Hono {
	const app = new Hono();

	registerOrderRoutes(app, deps);

	app.onError((error, c) => {
		if (error instanceof DomainError) {
			return c.json(
				{ error: error.code, message: error.message },
				statusByCode.get(error.code) ?? 422,
			);
		}

		console.error(error);
		return c.json({ error: "INTERNAL_ERROR", message: "Internal error" }, 500);
	});

	return app;
}
