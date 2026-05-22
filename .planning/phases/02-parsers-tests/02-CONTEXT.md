# Phase 2: Parsers + Tests - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart discuss classified as infra-only)

<domain>
## Phase Boundary

Pure parser modules for ROADMAP.md and STATE.md with full unit test coverage runnable without a VS Code Extension Development Host. Output is typed data (RoadmapData, StateData) plus a Mocha test suite invokable via `npm test`. No VS Code API usage in parser modules — they must be importable in plain Node.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Guidance:
- Hand-rolled regex / line scanner per PROJECT.md tech stack (no markdown-it, no remark).
- Parser modules live under `src/parsers/` (roadmap.ts, state.ts) with shared types in `src/parsers/types.ts`.
- Tests use Mocha (the `@vscode/test-cli` test framework) but run as pure Node — no extension host needed for parser tests. Place under `src/test/parsers/` or `test/parsers/`; whichever fits existing scaffolding.
- Both parsers must tolerate missing fields, partial files, CRLF/LF endings.
- Include a stress test with pathological regex input asserting <100ms — guards against catastrophic backtracking.

</decisions>

<code_context>
## Existing Code Insights

Phase 1 scaffolded the extension with a minimal status bar. Codebase context will be confirmed during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

- RoadmapData fields: project name, phases (number, name, goal, mode, success criteria, line numbers).
- StateData fields: milestone, phase id/name, last entry text + timestamp.
- Stress test target: <100ms for pathological input.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
