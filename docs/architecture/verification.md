# Verification

The exact set of commands to run before declaring a change complete. The kernel `AGENTS.md` lists these in its "Before declaring done" section; this file is the canonical reference.

```bash
npm run lint                   # XO + Prettier
npm test -- --run              # Vitest, including architecture tests
npm start -- list-users        # CLI smoke
PORT=3000 npm run serve        # HTTP smoke (separately)
```

When in doubt about a boundary, re-read [dependency-rule.md](./dependency-rule.md). If you still have doubt, write an architecture test (see [testing.md](./testing.md#105-architectural-fitness-function-tests)) that fails when the boundary is crossed.

---

**See also:** [testing.md](./testing.md) · [adr-process.md](./adr-process.md)
