import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compose } from "#src/composition.js";
import { loadConfig } from "#src/config.js";

// HTTP composition root (§2.5). Loads config, calls compose(),
// constructs the Hono app, and serves it. The template ships with no
// routes — add a presentation/http/ server and register routes by
// passing in the wired use cases.
const config = loadConfig();
compose(config);

const app = new Hono();
app.get("/", (c) =>
	c.text("Clean Architecture Template — no routes wired yet."),
);

serve({ fetch: app.fetch, port: config.port }, (info) => {
	console.log(`HTTP server listening on http://localhost:${info.port}`);
});
