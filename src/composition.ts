import { type CustomerSummaryDto } from "#application/dtos/customer-summary-dto.js";
import { OrderFactory } from "#application/factories/order-factory.js";
import { type CancelOrderUseCase } from "#application/ports/input/cancel-order-use-case.js";
import { type GetOrderUseCase } from "#application/ports/input/get-order-use-case.js";
import { type ListOrderSummariesUseCase } from "#application/ports/input/list-order-summaries-use-case.js";
import { type ListOrdersUseCase } from "#application/ports/input/list-orders-use-case.js";
import { type PlaceOrderUseCase } from "#application/ports/input/place-order-use-case.js";
import { type CustomerLookup } from "#application/ports/output/customer-lookup.js";
import { type Logger } from "#application/ports/output/logger.js";
import { OrderSummaryProjector } from "#application/projections/order-summary-projector.js";
import { OrderConfirmationSaga } from "#application/sagas/order-confirmation-saga.js";
import { AuditedPlaceOrder } from "#application/use-cases/audited-place-order.js";
import { AuthorizedPlaceOrder } from "#application/use-cases/authorized-place-order.js";
import { CancelOrder } from "#application/use-cases/cancel-order.js";
import { CompensateOrderConfirmation } from "#application/use-cases/compensate-order-confirmation.js";
import { ConfirmOrder } from "#application/use-cases/confirm-order.js";
import { GetOrder } from "#application/use-cases/get-order.js";
import { IdempotentPlaceOrder } from "#application/use-cases/idempotent-place-order.js";
import { ListOrderSummaries } from "#application/use-cases/list-order-summaries.js";
import { ListOrders } from "#application/use-cases/list-orders.js";
import { PlaceOrder } from "#application/use-cases/place-order.js";
import { RetriedPlaceOrder } from "#application/use-cases/retried-place-order.js";
import { InMemoryAuditLog } from "#infrastructure/audit/in-memory-audit-log.js";
import { SystemClock } from "#infrastructure/clock/system-clock.js";
import { CryptoIdGenerator } from "#infrastructure/id/crypto-id-generator.js";
import { InMemoryInventoryReservation } from "#infrastructure/inventory/in-memory-inventory-reservation.js";
import { ConsoleLogger } from "#infrastructure/logging/console-logger.js";
import { InMemoryEventPublisher } from "#infrastructure/messaging/in-memory-event-publisher.js";
import { InMemoryIdempotencyStore } from "#infrastructure/persistence/in-memory-idempotency-store.js";
import { InMemoryOrderProcessRepository } from "#infrastructure/persistence/in-memory-order-process-repository.js";
import { InMemoryOrderSummaryReadModel } from "#infrastructure/persistence/in-memory-order-summary-read-model.js";
import { JsonFileOrderRepository } from "#infrastructure/persistence/json-file-order-repository.js";
import { RetryingOrderRepository } from "#infrastructure/persistence/retrying-order-repository.js";
import { InMemoryUnitOfWork } from "#infrastructure/transaction/in-memory-unit-of-work.js";
import { type CustomerId } from "#domain/order/customer-id.js";
import { type AppConfig } from "#src/config.js";

// Shared composition module (§2.5). Imported ONLY by composition roots
// (src/index.ts, src/server.ts, src/worker.ts) — enforced by an
// architecture test (§10.5). Never re-exposes individual adapters; only
// fully-wired use cases.
export type Composed = {
	readonly logger: Logger;
	readonly placeOrder: PlaceOrderUseCase;
	readonly placeOrderForHttp: PlaceOrderUseCase;
	readonly cancelOrder: CancelOrderUseCase;
	readonly getOrder: GetOrderUseCase;
	readonly listOrders: ListOrdersUseCase;
	readonly listOrderSummaries: ListOrderSummariesUseCase;
};

// Transitional stub for the CustomerLookup port. The real
// `InProcessCustomerLookup` ACL was removed when the User context was
// stripped; the Order context is removed in the next commit, taking
// this stub with it.
class StubCustomerLookup implements CustomerLookup {
	async find(id: CustomerId): Promise<CustomerSummaryDto | undefined> {
		return { id, displayName: "stub-customer", status: "active" };
	}
}

export function compose(config: AppConfig): Composed {
	// --- Driven adapters ----------------------------------------------------
	const baseOrderRepo = new JsonFileOrderRepository(config.ordersDataFile);
	const orderRepo = new RetryingOrderRepository(baseOrderRepo, 3);

	const ids = new CryptoIdGenerator();
	const clock = new SystemClock();
	const events = new InMemoryEventPublisher();
	const logger = new ConsoleLogger();
	const audit = new InMemoryAuditLog();
	const idempotency = new InMemoryIdempotencyStore();
	const unitOfWork = new InMemoryUnitOfWork();
	const customers = new StubCustomerLookup();

	// Saga state + workflow side-effects (§6.6).
	const orderProcesses = new InMemoryOrderProcessRepository();
	const inventory = new InMemoryInventoryReservation(ids, {
		"BOOK-1": 100,
		"BOOK-2": 100,
		"WIDGET-1": 100,
	});

	// Read-side projection store (§4.1, full CQRS). Implements both the
	// read port (consumed by `ListOrderSummaries`) and the writer port
	// (consumed by `OrderSummaryProjector`).
	const orderSummaries = new InMemoryOrderSummaryReadModel();

	// --- Application factory ------------------------------------------------
	const orderFactory = new OrderFactory(ids, clock);

	// --- Bare use cases -----------------------------------------------------
	const placeOrderBare = new PlaceOrder(
		orderRepo,
		customers,
		orderFactory,
		events,
		unitOfWork,
	);
	const cancelOrder = new CancelOrder(orderRepo, clock, events);
	const getOrder = new GetOrder(orderRepo);
	const listOrders = new ListOrders(orderRepo);
	const listOrderSummaries = new ListOrderSummaries(orderSummaries);

	// Saga-only entry points — driven by `OrderConfirmationSaga`, never
	// exposed at any presentation boundary.
	const confirmOrder = new ConfirmOrder(orderRepo, clock, events);
	const compensateOrder = new CompensateOrderConfirmation(
		orderRepo,
		clock,
		events,
	);

	// --- Decorator stacks (order matters — §4.5) ---------------------------
	// PlaceOrder (shared): Idempotent → Audited → Retried → Inner
	const placeOrderShared = new IdempotentPlaceOrder(
		new AuditedPlaceOrder(
			new RetriedPlaceOrder(placeOrderBare, {
				attempts: 3,
				baseDelayMs: 25,
			}),
			audit,
			clock,
		),
		idempotency,
	);

	// HTTP further wraps with Authorized so anonymous principals fail fast.
	const placeOrderForHttp = new AuthorizedPlaceOrder(placeOrderShared);

	// --- Sagas + projections (subscribe before the system serves traffic) --
	new OrderConfirmationSaga(
		events,
		orderRepo,
		orderProcesses,
		inventory,
		confirmOrder,
		compensateOrder,
		clock,
		ids,
		logger,
	).start();
	new OrderSummaryProjector(events, orderSummaries, logger).start();

	return {
		logger,
		placeOrder: placeOrderShared,
		placeOrderForHttp,
		cancelOrder,
		getOrder,
		listOrders,
		listOrderSummaries,
	};
}
