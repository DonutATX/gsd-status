# Pitfalls Research

**Domain:** VS Code Extension — file-watching, Markdown parsing, status bar + TreeView UI
**Researched:** 2026-05-20
**Confidence:** HIGH (most items verified against official VS Code docs and tracked GitHub issues)

---

## Critical Pitfalls

### Pitfall 1: Activation Event Blocks Editor Startup

**What goes wrong:**
Using `"*"` or `"onStartupFinished"` with heavy synchronous work in `activate()` freezes the editor
on every startup. Using `"workspaceContains:.planning/ROADMAP.md"` triggers a recursive glob scan
with a 7-second hard timeout; in large repos the scan times out, which pre-emptively activates the
extension before the file is found — or never activates it at all.

**Why it happens:**
Developers default to `"*"` for "always-on" extensions without knowing `onStartupFinished` exists,
or they use `workspaceContains` with a path that requires deep scanning. Synchronous I/O (reading
files, constructing watchers) is placed directly in `activate()` with no deferral.

**How to avoid:**
- Use `"onStartupFinished"` as the activation event. It fires after VS Code startup is complete and
  does not affect startup time.
- Keep `activate()` lightweight: register disposables, then kick off async initialization. Never
  read files synchronously in `activate()`.
- `workspaceContains` for a shallow path like `.planning/ROADMAP.md` (no glob, root-level check) is
  safe; avoid patterns like `**/.planning/**` which force full-tree scanning.

**Warning signs:**
- `Developer: Startup Performance` shows your extension in the slow-activation list.
- Users report VS Code feeling sluggish immediately after opening a project.
- Extension takes >200 ms to activate in the Extension Host startup log.

**Phase to address:** Phase 1 (scaffolding / extension anatomy) — set the activation event correctly
before any other code is written.

---

### Pitfall 2: FileSystemWatcher and StatusBarItem Not Disposed — Memory Leaks

**What goes wrong:**
`FileSystemWatcher` instances created with `vscode.workspace.createFileSystemWatcher` and
`StatusBarItem` instances created with `vscode.window.createStatusBarItem` continue running after
the extension is deactivated or after the workspace changes. Each leaked watcher holds a file
handle (Linux) or OS-level notification slot (Windows). Multiple watcher leaks accumulate across
workspace switches.

**Why it happens:**
Developers create watchers in a helper class and forget to wire the helper's `.dispose()` into
`context.subscriptions`. Or a watcher is recreated (e.g., on workspace folder change) without
disposing the previous instance first.

**How to avoid:**
- Push every created disposable into `context.subscriptions` in `activate()`:
  ```typescript
  context.subscriptions.push(watcher);
  context.subscriptions.push(statusBarItem);
  ```
- For watchers recreated dynamically (e.g., workspace folder change), hold a reference and call
  `.dispose()` explicitly before reassigning.
- Wrap watcher + event subscriptions in a single class that implements `Disposable`; push the
  class instance to subscriptions.
- Implement `deactivate()` as a final safety net, though `context.subscriptions` is the primary
  mechanism.

**Warning signs:**
- Process memory grows across workspace switches without returning to baseline.
- File handles (Linux `ulimit`) approaching the system maximum.
- `onDidChange` callbacks firing for files in previously-closed workspaces.

**Phase to address:** Phase 1–2 (watcher wiring). Establish the disposal pattern at the time
watchers are first introduced; retrofitting is error-prone.

---

### Pitfall 3: Rapid File-Change Events Without Debouncing — UI Thrash

**What goes wrong:**
A single file save in VS Code can fire 4–12 filesystem events (write, rename, temp-file create/
delete). Without debouncing, `onDidChange` triggers a full ROADMAP.md re-parse and status bar + tree
refresh on every event. When GSD writes multiple files in sequence, the extension re-parses and
re-renders continuously, pinning the extension host CPU and causing visible status bar flicker.

**Why it happens:**
The naive implementation wires `onDidChange` directly to the parse-and-render function. It works
fine in manual testing (single save) but degrades badly when GSD writes files programmatically.

**How to avoid:**
- Wrap the parse-and-render function in a debounce (300–500 ms is suitable for this use case):
  ```typescript
  let debounceTimer: NodeJS.Timeout | undefined;
  watcher.onDidChange(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => refresh(), 400);
  });
  ```
- The `debounceTimer` reference must be captured in the class/module scope so it can be cleared on
  deactivation too (prevents a stale timer firing after deactivation).
- Apply the same debounce to `onDidCreate` and `onDidDelete` handlers.

**Warning signs:**
- Status bar text flickers visibly on save.
- CPU usage spikes in the extension host process on every file save.
- Multiple sequential parse calls logged within <100 ms of each other.

**Phase to address:** Phase 2 (watcher wiring + status bar update loop). The debounce wrapper
should be in place before any watcher event handler is connected.

---

### Pitfall 4: Polling Timer Not Disposed on Deactivation

**What goes wrong:**
The periodic-refresh fallback (required per PROJECT.md) uses `setInterval`. If the interval handle
is not cleared in `deactivate()` (or via `context.subscriptions`), the callback continues firing
after the extension is disabled or the workspace is closed. This causes phantom parse calls and
potential "extension context disposed" errors.

**Why it happens:**
`setInterval` returns a `NodeJS.Timeout`, not a VS Code `Disposable`, so it cannot be pushed
directly into `context.subscriptions`. Developers forget to bridge the gap.

**How to avoid:**
- Wrap the interval in a `Disposable` shim:
  ```typescript
  const handle = setInterval(() => refresh(), intervalMs);
  context.subscriptions.push({ dispose: () => clearInterval(handle) });
  ```
- Store `handle` in module scope so it can also be cleared when the interval config changes.
- Never recreate the interval without clearing the previous handle.

**Warning signs:**
- Log output from the refresh function continues appearing after the extension is disabled.
- `ExtensionContext has been disposed` errors in the Output pane.

**Phase to address:** Phase 2 (watcher wiring / fallback polling). Must be addressed at the time
the polling feature is implemented, not added later.

---

### Pitfall 5: `workspaceFolders` Undefined Crashes Extension

**What goes wrong:**
`vscode.workspace.workspaceFolders` is `undefined` when VS Code is opened with no folder (e.g.,
opening a single file). Passing `workspaceFolders[0]` to `RelativePattern` without a null-check
throws a runtime TypeError that crashes the extension host for that extension. Because the project
requires showing "No GSD project" gracefully, this case must be handled, not crashed.

**Why it happens:**
Tutorials and snippets index `workspaceFolders[0]` directly. It looks safe until a user opens VS
Code from a file double-click or with no folder argument.

**How to avoid:**
- Always guard:
  ```typescript
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    statusBarItem.text = "$(circle-slash) No GSD project";
    return; // do not create watcher
  }
  const pattern = new vscode.RelativePattern(folder, '.planning/{ROADMAP,STATE}.md');
  ```
- Handle `onDidChangeWorkspaceFolders` to re-initialize or tear down watchers when the workspace
  changes at runtime.
- Show the "No GSD project" state as the default before any folder check completes.

**Warning signs:**
- `TypeError: Cannot read properties of undefined (reading '0')` in the extension host log.
- Extension silently stops working when a second workspace root is added or removed.

**Phase to address:** Phase 1 (extension anatomy / activation). The guard must exist before any
watcher creation code is written.

---

### Pitfall 6: Windows Path Separator Bugs in Glob Patterns

**What goes wrong:**
On Windows, `path.join()` produces backslash-separated paths (`C:\Users\...\\.planning`).
Passing a backslash path to `createFileSystemWatcher` as a string glob, or building glob patterns
with `\\**\\`, causes the watcher to silently match no files. VS Code's glob engine requires forward
slashes. The bug is invisible in testing because the watcher registers without error.

**Why it happens:**
Node.js `path` module uses backslashes on Windows. Developers use `path.join(folder.uri.fsPath,
'.planning/**')` which produces a backslash path and breaks the glob matcher silently.

**How to avoid:**
- Always use `vscode.Uri`-based APIs or `RelativePattern` for watchers; never construct glob
  strings from `path.join` on Windows paths.
- When you must build a string path, normalize slashes:
  ```typescript
  const globPath = folder.uri.fsPath.replace(/\\/g, '/') + '/.planning/**';
  ```
- Prefer `new vscode.RelativePattern(folder, '.planning/**')` — VS Code handles the path
  normalization internally.
- Test watcher registration on Windows by verifying `onDidChange` fires after a known file edit.

**Warning signs:**
- File watcher registers without error but `onDidChange` never fires on Windows.
- Watcher works on macOS/Linux CI but fails on the Windows primary dev environment.
- Glob passed to `createFileSystemWatcher` contains `\` characters.

**Phase to address:** Phase 2 (watcher wiring). Add a Windows-specific integration test that
mutates `.planning/STATE.md` and asserts the watcher callback fires.

---

### Pitfall 7: TreeDataProvider Full-Tree Refresh on Every Change

**What goes wrong:**
Firing `_onDidChangeTreeData.fire(undefined)` (full-tree refresh) on every file-change event
forces VS Code to re-call `getChildren` for every tree node, collapsing expanded nodes and causing
visible flicker in the side panel. For a tree with many phases, this also forces re-parsing the
full ROADMAP.md on each event.

**Why it happens:**
The full-tree refresh is the simplest implementation and is shown in most tutorials. Developers
don't differentiate between "a phase status changed" (partial update needed) vs. "the entire
roadmap changed" (full refresh warranted).

**How to avoid:**
- Parse ROADMAP.md into an in-memory model and diff against the previous model before firing.
- Fire with `undefined` (full refresh) only when the phase list itself changes (phases added,
  removed, or reordered). Fire with a specific node reference when only a phase's status changes.
- Always combine with debounce (see Pitfall 3) so refreshes are coalesced.
- Note the VS Code API quirk: firing with a specific item updates that item's *children*, not the
  item itself. To update an item's label/icon, fire with the item's *parent* (or `undefined` for
  root-level items).

**Warning signs:**
- Tree panel collapses all expanded nodes on every GSD state update.
- `getTreeItem` called far more times than the number of changed phases.
- Visible flicker in the Explorer side panel on file save.

**Phase to address:** Phase 3 (TreeView / side panel). Establish the parse-and-diff model before
wiring tree refresh events.

---

### Pitfall 8: Markdown Regex Catastrophic Backtracking

**What goes wrong:**
Hand-rolled regexes for parsing ROADMAP.md headers and STATE.md entries can exhibit catastrophic
backtracking on malformed or adversarial input. A pattern like `/#{1,6}\s+(.+?)\s*$/` is safe;
nested quantifiers like `/(.*)+/` or `/(a+)+/` can pin the extension host CPU at 100% on a
sufficiently unusual (but valid) Markdown line.

The VS Code core team has fixed this class of bug at least twice in its own Markdown tokenizer
(PRs #109964 and #307447). Third-party parsers like `marked` have had ReDoS CVEs for the same
reason.

**Why it happens:**
ROADMAP.md parsing is "simple enough to do with regex" and developers write patterns without
considering catastrophic backtracking. The input is user-controlled (any valid Markdown), making
ReDoS a real failure mode.

**How to avoid:**
- Keep patterns simple and linear. Prefer anchored, non-nested quantifiers.
- Do NOT use `(.*)+`, `(\s+)+`, or similar nested quantifiers.
- For the specific ROADMAP.md format (`### Phase N: <name>`, `**Goal:**`, etc.), one-pass line
  splitting + `startsWith` checks are safer and faster than regex matching entire multi-line blocks.
- If regex is used, test against lines with repeated special characters (e.g., `### Phase 1: ` +
  `()`.repeat(50)`).
- Consider a minimal line-oriented parser over a full regex or third-party Markdown AST library —
  avoids both backtracking and a heavy dependency.

**Warning signs:**
- Extension host CPU spikes to 100% and stays there after opening a specific ROADMAP.md.
- Parse function does not return within the <100 ms budget (PROJECT.md constraint).
- Crash or timeout reported against a ROADMAP.md with unusual formatting.

**Phase to address:** Phase 2 (parser implementation). Write the parser with regression tests
against pathological inputs before wiring it to the watcher.

---

### Pitfall 9: Oversized VSIX from Missing `.vscodeignore`

**What goes wrong:**
Without a correct `.vscodeignore`, `vsce package` bundles the entire `node_modules/` tree and
TypeScript source `out/` directory into the `.vsix`. A typical extension ballooms from ~100 KB to
>10 MB. Local `.vsix` installs are slow; marketplace installs would be throttled or rejected. The
`node_modules` included may differ from what the bundler tree-shook, leading to version conflicts
at runtime.

**Why it happens:**
The default `yo code` scaffold creates a minimal `.vscodeignore` that excludes `.vscode/` and
`src/` but does not account for a bundled output structure. When a bundler (esbuild/webpack) is
added later, the ignore file is not updated.

**How to avoid:**
- If bundling to `dist/extension.js`: add `node_modules/` and `out/` to `.vscodeignore`.
- If using the default unbundled compile-to-`out/` approach: add `src/` and `node_modules/` to
  `.vscodeignore`.
- After any packaging change, run `vsce ls` to inspect what files would be included before running
  `vsce package`.
- Verify final VSIX size — for this extension, <500 KB is reasonable; >2 MB signals a problem.

**Warning signs:**
- `vsce package` takes more than a few seconds.
- `.vsix` file is larger than 1 MB.
- `vsce ls` output includes `node_modules/` entries.

**Phase to address:** Phase 4 (packaging / distribution). Create the `.vscodeignore` and run
`vsce ls` as part of the first packaging task.

---

### Pitfall 10: `engines.vscode` Version Mismatch

**What goes wrong:**
Setting `"engines": { "vscode": "^1.90.0" }` (a recent version) silently prevents installation on
VS Code stable releases older than that version. Users on the current stable who haven't updated
see the extension greyed out with no clear error message. Setting the version without the `^` caret
(`"1.90.0"`) restricts to exactly that version, breaking installs on anything newer or older.

**Why it happens:**
Generators scaffold a recent version; developers copy API usage from newer docs and bump the
engines version to match without testing on an older stable build.

**How to avoid:**
- Use the minimum version that provides the APIs you actually call. For this extension, the stable
  APIs used (`StatusBarItem`, `TreeDataProvider`, `FileSystemWatcher`, `RelativePattern`) have been
  present since VS Code ~1.50.
- Use the `^` caret range: `"engines": { "vscode": "^1.74.0" }`. (1.74 introduced automatic command
  activation, a useful baseline.)
- Verify the minimum version with the `@vscode/vsce` pre-publish check.
- Do not use proposed APIs (unstable, Insiders-only) unless the feature is explicitly gated.

**Warning signs:**
- Extension install fails with no actionable error for users on VS Code stable.
- Extension works in dev but fails for testers on slightly older VS Code.
- `package.json` `engines.vscode` is higher than the lowest VS Code version in the target audience.

**Phase to address:** Phase 4 (packaging / distribution). Validate `engines.vscode` before the
first `.vsix` is distributed.

---

### Pitfall 11: File Watcher Events Unreliable in WSL2 / Network Paths

**What goes wrong:**
When VS Code is run with a workspace on a WSL2 Windows mount (`/mnt/c/...`) or a network drive,
`FileSystemWatcher` events are silently dropped. The OS does not guarantee event delivery for these
paths. The extension will appear to stop updating after a GSD write.

The project uses a "periodic refresh fallback" specifically to handle this case (PROJECT.md), but
if the fallback is not implemented, the extension silently stalls.

**Why it happens:**
WSL2 uses a polling fallback (`remote.WSL.fileWatcher.polling`) by default for Windows mounts, but
the polling interval is user-configurable and may be set to a long interval. Network drives
(SMB/CIFS) may produce no events at all.

**How to avoid:**
- Implement the periodic refresh fallback (configurable interval, defaulting to 5–10 s) as a
  first-class feature, not an afterthought.
- Log a debug message when watcher events fire vs. when the fallback fires, to help diagnose
  silent-miss environments.
- In documentation, note that the primary watcher is event-driven but a fallback poll ensures
  correctness on WSL2 Windows mounts.
- Do not rely solely on `onDidChange` — always have the fallback running.

**Warning signs:**
- Extension stops updating on save when VS Code is opened via WSL2 remote.
- No `onDidChange` events in the extension log despite confirmed file changes.
- Watcher works in native Windows but not in WSL2 remote session.

**Phase to address:** Phase 2 (watcher wiring). The fallback timer must be implemented in the same
phase as the primary watcher, not deferred.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Regex line parsing for ROADMAP.md instead of an AST library | No extra dependency | Breaks on edge-case Markdown; must be maintained alongside GSD format changes | Acceptable if patterns are simple, anchored, and tested against pathological inputs |
| `onDidChangeTreeData.fire(undefined)` (full refresh) always | One line of code | Tree flicker, collapsed nodes, unnecessary re-parses | Acceptable in Phase 1 scaffolding; refactor to partial refresh in the same phase or next |
| Single `activate()` entry point, no class structure | Faster initial implementation | Hard to unit-test; lifecycle bugs surface late | Never — use a `GsdExtension` class from Phase 1 |
| Skip `.vscodeignore` until packaging phase | Nothing to ship yet | Easy to forget; VSIX balloons | Acceptable — but create the file (even if empty) in Phase 1 scaffolding |
| Hardcoded refresh interval (no config) | No settings UI | Users in WSL2 may need shorter interval; users on SSD may want longer | Acceptable for v1 if interval is a named constant, not a magic number |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `vscode.workspace.createFileSystemWatcher` | Passing `path.join(fsPath, '.planning/**')` with backslashes on Windows | Use `new vscode.RelativePattern(folder, '.planning/**')` — VS Code normalizes paths internally |
| `vscode.window.createTreeView` | Registering `TreeDataProvider` without a `viewId` that matches `package.json` `views` entry | Confirm `viewId` string is identical in both `createTreeView` call and `package.json` contributes.views |
| `vscode.workspace.workspaceFolders` | Indexing `[0]` without null-check | Optional-chain: `workspaceFolders?.[0]` + early return |
| `context.subscriptions` | Pushing disposables from async code after `context` is disposed | Complete all async init within `activate()` promise; do not defer subscription pushes to async callbacks |
| `vscode.workspace.onDidChangeWorkspaceFolders` | Not re-initializing watchers when workspace folders change | Subscribe to this event and recreate watchers, disposing previous ones |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous `fs.readFileSync` in `onDidChange` handler | Editor input lag during file saves | Use `vscode.workspace.fs.readFile` (async) + await | Any file >~50 KB or slow disk |
| Full ROADMAP.md re-parse on every event without diff | CPU spike, tree flicker on every GSD write | Cache the last parse result; only re-render if the parsed model changed | Immediately visible when GSD writes multiple files in sequence |
| `EventEmitter` without `maxListeners` adjustment | Warning: "Possible EventEmitter memory leak detected. 11 listeners added" | Set `emitter.setMaxListeners(20)` or higher for long-lived emitters | When >10 disposable listeners are added to a single emitter |
| Status bar `text` set to a long string with icons | Status bar overflow / truncation varies by theme and window width | Keep status bar text under ~60 characters; put full detail in tooltip | Small monitor / split editor layout |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Status bar shows raw file-read error message | Confusing to users; exposes internal path details | Show "GSD: error reading status" with a hover tooltip containing the error detail |
| Tree panel empty with no explanation when `.planning/` is missing | User thinks extension is broken | Show a placeholder `TreeItem` with text "No GSD project in this workspace" |
| Status bar item disappears when workspace has no `.planning/` | User doesn't know extension is loaded | Keep the item visible at all times; show "No GSD project" state |
| Tooltip shows stale data (not updated after file change) | User glances at tooltip and sees outdated phase info | Tooltip is populated at display time from the same in-memory model as the status bar text |
| Refresh command triggers visible "loading" flicker on every invocation | Distracting | Only re-render if the parsed model actually changed from the previous model |

---

## "Looks Done But Isn't" Checklist

- [ ] **File watcher:** Verify `onDidChange` fires on Windows (backslash path bug is silent — the
  watcher registers without error).
- [ ] **Disposal:** Confirm that disabling the extension in VS Code and re-enabling it does not
  leave orphaned `onDidChange` listeners (check with `context.subscriptions.length` in a test).
- [ ] **No-folder state:** Open VS Code with `code --new-window` (no folder) — verify "No GSD
  project" appears and no TypeError is thrown.
- [ ] **Fallback timer:** Manually kill the file watcher (e.g., move the folder away) and confirm
  the periodic refresh still fires.
- [ ] **Debounce:** Save the file 5 times in quick succession — confirm only one parse + render
  cycle is logged.
- [ ] **Tree collapse:** Expand a tree node, trigger a file change — confirm the node stays
  expanded (partial refresh, not full-tree refresh).
- [ ] **VSIX size:** Run `vsce ls` and confirm `node_modules/` is excluded; check `.vsix` < 500 KB.
- [ ] **engines version:** Install the `.vsix` on the minimum declared VS Code version and confirm
  it activates without error.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Leaked watchers discovered post-ship | MEDIUM | Add `dispose()` calls to deactivation path; ship patch release |
| Oversized VSIX shipped | LOW | Fix `.vscodeignore`, re-package, redistribute `.vsix` |
| Catastrophic backtracking in parser discovered | HIGH | Rewrite parser as line-oriented; all ROADMAP.md test cases must pass |
| `engines.vscode` too restrictive | LOW | Lower the version floor, re-package |
| Windows path backslash bug discovered after watcher wiring | MEDIUM | Switch to `RelativePattern`, add Windows integration test |
| No-folder crash reported | LOW | Add `workspaceFolders?.[0]` guard, ship patch |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Activation event slows startup | Phase 1 — Extension Scaffolding | Measure activation time with `Developer: Startup Performance` |
| Watcher / StatusBarItem not disposed | Phase 1–2 — Scaffolding + Watcher Wiring | Disable/re-enable extension; confirm no orphaned callbacks |
| No debounce on rapid file changes | Phase 2 — Watcher Wiring | Save file 5x in <1 s; confirm single parse logged |
| Polling timer not disposed | Phase 2 — Watcher Wiring | Deactivate extension; confirm no further timer callbacks |
| `workspaceFolders` undefined crash | Phase 1 — Extension Scaffolding | Open VS Code with no folder; confirm graceful "No GSD project" state |
| Windows path separator bug | Phase 2 — Watcher Wiring | Run integration test on Windows that mutates `.planning/STATE.md` |
| Tree full-refresh flicker | Phase 3 — TreeView / Side Panel | Expand a node, trigger change, verify node stays expanded |
| Markdown regex backtracking | Phase 2 — Parser Implementation | Run parser against pathological inputs; assert <100 ms per parse |
| Oversized VSIX | Phase 4 — Packaging | Run `vsce ls`; verify `node_modules/` absent; check size <500 KB |
| `engines.vscode` version mismatch | Phase 4 — Packaging | Install `.vsix` on oldest supported VS Code version |
| WSL2 / network path missed events | Phase 2 — Watcher Wiring + Fallback | Test with polling-only mode (disable watcher) to confirm fallback works |

---

## Sources

- [VS Code Activation Events Reference](https://code.visualstudio.com/api/references/activation-events) — `onStartupFinished` vs `*`; `workspaceContains` behavior
- [VS Code Bundling Extensions Guide](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) — `.vscodeignore`, minification pitfalls
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) — `onDidChangeTreeData` patterns
- [VS Code File Watcher Issues Wiki](https://github.com/microsoft/vscode/wiki/File-Watcher-Issues) — reliability guarantees, WSL2 caveats
- [GitHub Issue #172939 — createFileSystemWatcher broken with backslash patterns on Windows](https://github.com/microsoft/vscode/issues/172939)
- [GitHub Issue #20184 — FileSystemWatcher glob matched against full fs path](https://github.com/Microsoft/vscode/issues/20184)
- [GitHub Issue #26852 — FileSystemWatcher API oddities](https://github.com/Microsoft/vscode/issues/26852)
- [GitHub Issue #73656 — workspaceContains 7-second timeout behavior](https://github.com/microsoft/vscode/issues/73656)
- [GitHub Issue #102454 — onDidChangeTreeData fire(undefined) behavior](https://github.com/microsoft/vscode/issues/102454)
- [GitHub PR #109964 — Fix catastrophic backtracking in VS Code Markdown parser](https://github.com/microsoft/vscode/pull/109964)
- [GitHub PR #307447 — Fix catastrophic regex backtracking in _extractImagesFromOutput](https://github.com/microsoft/vscode/pull/307447)
- [marked.js ReDoS fix](https://github.com/markedjs/marked/commit/b15e42b67cec9ded8505e9d68bb8741ad7a9590d) — regex backtracking in Markdown parsers
- [Avoiding Memory Leaks in Visual Studio Editor Extensions](https://devblogs.microsoft.com/visualstudio/avoiding-memory-leaks-in-visual-studio-editor-extensions/) — disposal patterns
- [VS Code Extensions — Patterns and Principles](https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/) — `context.subscriptions` dispose pattern
- [File Watchers Lie — debounce and coalescing in build loops](https://medium.com/@impactarchitecture/file-watchers-lie-debounce-throttle-and-coalescing-in-build-loops-8d91cb29f712) — debounce rationale
- [VS Code Adopting Multi-Root Workspace APIs](https://github.com/microsoft/vscode-wiki/blob/main/Adopting-Multi-Root-Workspace-APIs.md) — `workspaceFolders` undefined handling
- [WSL2 file watcher polling issue #870](https://github.com/microsoft/vscode-remote-release/issues/870) — missed events on Windows mounts in WSL2

---
*Pitfalls research for: VS Code Extension — file-watching, Markdown parsing, status bar + TreeView UI*
*Researched: 2026-05-20*
