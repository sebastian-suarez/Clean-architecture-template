# src/infrastructure/

Adapters. Each class implements a driven (output) port from
`#application/ports/output/*` using a concrete technology. One folder
per concern (`persistence/`, `clock/`, `id/`, `logging/`, …); one
port per adapter file. For every output port, an in-memory adapter
must exist alongside any production adapter.

→ Rules: [../../docs/architecture/layer-responsibilities.md#23-infrastructure-srcinfrastructure](../../docs/architecture/layer-responsibilities.md#23-infrastructure-srcinfrastructure)
→ Recipe: [../../docs/architecture/recipes.md#87-add-a-new-infrastructure-adapter-eg-postgres](../../docs/architecture/recipes.md#87-add-a-new-infrastructure-adapter-eg-postgres)
