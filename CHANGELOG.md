# Change Log

All notable changes to the `gsd-status` extension will be documented in this file.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0] - 2026-05-21

### Added

- Status bar item showing the active GSD milestone and phase in the format `$(icon) Milestone › Phase` — always visible in the editor footer.
- Hover tooltip on the status bar item displaying: milestone name, active phase name + goal, and the most recent `STATE.md` activity entry.
- Activity Bar side panel (GSD container) with a TreeView (`gsd.treeView`) listing all phases from `ROADMAP.md`, with the active phase highlighted and a Recent Activity section showing the latest `STATE.md` entries.
- Welcome view shown in the side panel when no GSD project is detected in the workspace (`!gsd.hasProject` context key).
- Four commands available from the Command Palette:
  - `GSD: Refresh` (`gsd.refresh`) — manually re-read `.planning/` files and update the status bar.
  - `GSD: Open Roadmap` (`gsd.openRoadmap`) — open `.planning/ROADMAP.md` in the editor.
  - `GSD: Open State` (`gsd.openState`) — open `.planning/STATE.md` in the editor.
  - `GSD: Refresh GSD tree` (`gsd.refreshTree`) — refresh the Activity Bar TreeView (also available as a tree title button).
- Two user-configurable settings:
  - `gsd.refreshIntervalSeconds` (default: `30`, minimum: `5`) — interval in seconds between automatic file refreshes.
  - `gsd.recentActivityCount` (default: `5`, minimum: `1`) — number of recent `STATE.md` entries to surface in the side panel.
- File watcher on `.planning/ROADMAP.md` and `.planning/STATE.md` using `vscode.workspace.createFileSystemWatcher` with a 300 ms debounce — the UI updates automatically on file change without polling.
- Read-only operation — the extension never writes to `.planning/` files.
