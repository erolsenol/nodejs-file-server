# Contributing

## Local workflow

```bash
pnpm install --frozen-lockfile
pnpm check
```

Keep domain contracts in `packages/core`, implementations in adapter packages, and process wiring in `apps/server`. New behavior should include focused unit tests and an HTTP integration test when it changes the public API.

## Pull requests

- Explain the behavior and security impact.
- Add or update documentation for public configuration and API changes.
- Keep unrelated formatting or dependency changes out of the PR.
- Do not commit secrets, local data, generated `dist`, or `.env` files.

The CI quality gate must pass before merge.
