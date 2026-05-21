import * as vscode from 'vscode';
import { relativeTime } from './relativeTime.js';
import type { RoadmapData, StateData } from '../parsers/types.js';

/**
 * Builds a MarkdownString tooltip for the ok state.
 *
 * Shows milestone, active phase + goal, and the most recent STATE.md entry.
 * isTrusted is left false (default) to prevent command URI injection from
 * user-controlled file contents (T-04-01).
 */
export function buildOkTooltip(roadmap: RoadmapData, state: StateData): vscode.MarkdownString {
  const ms = new vscode.MarkdownString();
  const milestone = roadmap.milestoneLabel ?? roadmap.projectName ?? 'GSD';
  const active = roadmap.phases.find(p => !p.done);

  ms.appendMarkdown(`**GSD**\n\n`);
  ms.appendMarkdown(`**Milestone:** ${milestone}\n`);

  if (active) {
    ms.appendMarkdown(`**Phase:** ${active.number}: ${active.name}\n`);
    ms.appendMarkdown(`**Goal:** ${active.goal ?? '(no goal defined)'}\n`);
  } else {
    ms.appendMarkdown(`**Phase:** All phases complete\n`);
  }

  if (state.lastEntry) {
    const rel = relativeTime(state.lastEntry.timestamp ?? state.lastUpdated ?? '');
    const abs = state.lastEntry.timestamp ?? state.lastUpdated ?? '';
    ms.appendMarkdown(`\n---\n\n`);
    ms.appendMarkdown(`**Last Entry**\n`);
    ms.appendMarkdown(`_${rel}_ — \`${abs}\`\n`);
    ms.appendMarkdown(state.lastEntry.text);
  }

  return ms;
}

/**
 * Builds a MarkdownString tooltip for the error state.
 *
 * Shows the actual parse error message. isTrusted is left false (default)
 * so path strings in error messages cannot inject command URIs (T-04-01).
 */
export function buildErrorTooltip(message: string): vscode.MarkdownString {
  const ms = new vscode.MarkdownString();
  ms.appendMarkdown(`**GSD — Parse Error**\n\n${message}`);
  return ms;
}
