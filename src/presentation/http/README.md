# src/presentation/http/

HTTP delivery mechanism. Routes translate request → input-port call →
DTO / domain error → status + body. The route file does only transport
translation; business logic lives in the use case. Maintains a
centralized `code` → status table.

→ Rules: [../../../docs/architecture/layer-responsibilities.md#24-presentation-srcpresentation](../../../docs/architecture/layer-responsibilities.md#24-presentation-srcpresentation)
