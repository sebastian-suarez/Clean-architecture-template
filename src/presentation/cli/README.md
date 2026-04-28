# src/presentation/cli/

CLI delivery mechanism. Translates argv → input-port call → DTO /
domain error → exit code. Commands live in `commands/<verb>-<noun>.ts`
and depend only on input ports + DTOs (and `DomainError` for the
exit-code mapping table).

→ Rules: [../../../docs/architecture/layer-responsibilities.md#24-presentation-srcpresentation](../../../docs/architecture/layer-responsibilities.md#24-presentation-srcpresentation)
