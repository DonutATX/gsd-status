# Requirements — Milestone v1.0.1

## v1.0.1 Requirements

### Roadmap Parsing

- [ ] **PARSE-12**: A collapsed ROADMAP whose phase names live in a `## Phases` bullet section (`- [x] **Phase N: Name**`) instead of the `## Progress` table renders all its phases in the tree view, grouped under the correct milestones.

## Future Requirements

(none)

## Out of Scope

- Changes to expanded-roadmap parsing (`### Phase N:` detail headers) — not affected by this bug.
- Changes to the `## Progress` table reader itself — the table-based collapsed path already works and must keep working.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PARSE-12 | 8 | Pending |
