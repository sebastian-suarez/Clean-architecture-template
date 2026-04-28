import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC, importsOf, listFiles } from "./_walker.js";

// Bounded-context isolation (§6.5). Each direct subfolder of
// src/domain/ is one context; a context never imports from a sibling
// context. `shared/` is the only cross-cutting domain folder allowed.
//
// Template form: when only `domain/shared/` exists (no business
// contexts yet), the assertion is vacuously true. We skip explicitly
// rather than asserting on an empty set so the test's intent stays
// readable.

describe("No cross-bounded-context imports in domain (§6.5)", () => {
	it("each domain/<context>/ does not import from sibling contexts", async () => {
		const domainDir = resolve(SRC, "domain");
		const entries = await readdir(domainDir, { withFileTypes: true });
		const contexts = entries
			.filter((e) => e.isDirectory() && e.name !== "shared")
			.map((e) => e.name);

		if (contexts.length === 0) {
			// Template state: no business contexts yet. The rule still holds
			// trivially — there are no siblings to cross.
			return;
		}

		const violations: string[] = [];

		for (const context of contexts) {
			const files = await listFiles(resolve(domainDir, context));
			for (const file of files) {
				const imports = await importsOf(file);
				const offending = imports.filter((imp) =>
					contexts.some(
						(other) => other !== context && imp.startsWith(`#domain/${other}/`),
					),
				);
				for (const imp of offending) {
					violations.push(`${file} → ${imp}`);
				}
			}
		}

		expect(violations).toStrictEqual([]);
	});
});
