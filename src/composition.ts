import { type AppConfig } from "#src/config.js";

// Shared composition module (§2.5). Imported ONLY by composition roots
// (src/index.ts, src/server.ts, src/worker.ts) — enforced by an
// architecture test (§10.5).
//
// This is a template: no use cases are wired yet. As you add bounded
// contexts under src/domain/, populate the `Composed` shape with the
// fully-wired use cases each delivery mechanism needs.
export type Composed = Record<string, never>;

export function compose(_config: AppConfig): Composed {
	return {};
}
