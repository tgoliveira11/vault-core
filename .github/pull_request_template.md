## Summary

Describe the consumer-visible behavior and why this change is needed.

## Security impact

Describe effects on secrets, AAD, KDF work, persistence, browser sessions, or state that the server
can observe. Write `None` only after checking `SECURITY.md`.

## Checklist

- [ ] Code, comments, errors, tests, and documentation are in English.
- [ ] Public API and runtime schema changes have regression tests.
- [ ] `CHANGELOG.md` includes the consumer-visible change under `Unreleased`.
- [ ] Documentation examples and signatures match the implementation.
- [ ] Breaking changes include an explicit migration path.
- [ ] `npm run validate` passes without lowering coverage thresholds.
- [ ] `npm pack --dry-run` includes all required runtime and documentation files.

