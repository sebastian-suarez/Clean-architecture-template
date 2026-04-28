import process from "node:process";
import { compose } from "#src/composition.js";
import { loadConfig } from "#src/config.js";

// Queue worker composition root (§2.5). Loads config, calls compose(),
// dispatches messages to handlers. The template ships with no handlers
// — add a presentation/queue/ worker and pass the wired use cases in
// once you have them.
const config = loadConfig();
compose(config);

console.log("Queue worker composition root — no handlers wired yet.");
console.log(`(NODE_ENV=${config.nodeEnv})`);
process.exit(0);
