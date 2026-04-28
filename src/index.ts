import process from "node:process";
import { compose } from "#src/composition.js";
import { loadConfig } from "#src/config.js";

// CLI composition root (§2.5). Loads config, calls compose(), dispatches
// argv to a CLI runner. The template ships with no commands — add a
// presentation/cli/ runner and pass the wired use cases in once you
// have them.
const config = loadConfig();
compose(config);

console.log("CLI composition root — no commands wired yet.");
console.log(`(NODE_ENV=${config.nodeEnv})`);
process.exit(0);
