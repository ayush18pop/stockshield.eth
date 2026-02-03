# Contributing to StockShield Frontend

## Branching Strategy: Trunk-Based Development

1. **Main Branch (`main`)**: Production-ready code. Protected.
2. **Feature Branches**: `feature/<ticket-id>-<short-description>`
3. **Fix Branches**: `fix/<ticket-id>-<short-description>`

## Workflow

1. Create a branch from `main`
2. Make small, focused commits following Conventional Commits
3. Open a PR — CI runs automatically (lint, typecheck, test, build)
4. Squash merge to `main` after approval

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
- `feat(simulation): add VPIN calculation function`
- `fix(demo): correct circuit breaker level display`
- `chore(deps): update React Three Fiber to v9`

## Code Quality

- ESLint + Prettier run on pre-commit via Husky
- TypeScript strict mode enabled
- 80%+ test coverage required for `lib/simulation/`

## Before Submitting

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] No console errors in dev
