# src/presentation/queue/

Queue / message-driven delivery mechanism. Handlers translate a
message envelope → input-port call → DTO / ack / nack. Same rules as
the other presentation folders: depend on input ports, never on
use-case classes; consume DTOs, never domain entities.

→ Rules: [../../../docs/architecture/layer-responsibilities.md#24-presentation-srcpresentation](../../../docs/architecture/layer-responsibilities.md#24-presentation-srcpresentation)
