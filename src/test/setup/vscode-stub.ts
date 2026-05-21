/**
 * Minimal vscode API stub for bare Mocha test environment.
 *
 * Provides just enough of the vscode module surface for StateController
 * to instantiate without a real Extension Development Host. All vscode
 * APIs that the test path actually exercises are implemented; everything
 * else is a no-op stub.
 *
 * Used exclusively by .mocharc.cjs require hook — never imported directly
 * by production code.
 */

// EventEmitter<T>: minimal implementation that mirrors vscode.EventEmitter.
class EventEmitter<T> {
  private _listeners: Array<(e: T) => void> = [];

  get event(): (listener: (e: T) => void) => { dispose(): void } {
    return (listener: (e: T) => void) => {
      this._listeners.push(listener);
      return {
        dispose: () => {
          const idx = this._listeners.indexOf(listener);
          if (idx !== -1) this._listeners.splice(idx, 1);
        },
      };
    };
  }

  fire(data: T): void {
    for (const l of this._listeners) {
      l(data);
    }
  }

  dispose(): void {
    this._listeners = [];
  }
}

// Minimal FileSystemWatcher stub — does nothing in test environment.
class FileSystemWatcher {
  onDidChange(_listener: () => void): { dispose(): void } { return { dispose: () => undefined }; }
  onDidCreate(_listener: () => void): { dispose(): void } { return { dispose: () => undefined }; }
  onDidDelete(_listener: () => void): { dispose(): void } { return { dispose: () => undefined }; }
  dispose(): void { /* no-op */ }
}

// Minimal RelativePattern stub.
class RelativePattern {
  constructor(
    public readonly base: { uri: { fsPath: string } } | string,
    public readonly pattern: string,
  ) {}
}

// Minimal MarkdownString stub — stores appended markdown text.
class MarkdownString {
  private _value = '';
  appendMarkdown(value: string): this { this._value += value; return this; }
  appendText(value: string): this {
    // VS Code escapes markdown control chars in appendText.
    this._value += value.replace(/[\\`*_{}[\]()#+\-.!>~|]/g, '\\$&');
    return this;
  }
  get value(): string { return this._value; }
}

// Minimal TreeItem stub for tree provider tests.
class TreeItem {
  id?: string;
  label?: string;
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  collapsibleState?: number;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;
  constructor(labelOrUri: string, collapsibleState?: number) {
    this.label = labelOrUri;
    this.collapsibleState = collapsibleState ?? 0;
  }
}

// Minimal ThemeIcon stub.
class ThemeIcon {
  constructor(public readonly id: string) {}
}

// TreeItemCollapsibleState constants.
const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };

module.exports = {
  EventEmitter,
  RelativePattern,
  MarkdownString,
  TreeItem,
  ThemeIcon,
  TreeItemCollapsibleState,
  workspace: {
    createFileSystemWatcher: (_pattern: RelativePattern) => new FileSystemWatcher(),
    workspaceFolders: undefined,
    getConfiguration: (_section?: string) => ({
      get: <T>(_key: string, defaultValue: T): T => defaultValue,
    }),
    onDidChangeConfiguration: (_listener: () => void): { dispose(): void } => {
      return { dispose: () => undefined };
    },
    openTextDocument: async (_uri: unknown): Promise<unknown> => ({}),
  },
  window: {
    createStatusBarItem: () => ({
      text: '',
      tooltip: undefined as unknown,
      command: undefined as string | undefined,
      show: () => undefined,
      dispose: () => undefined,
    }),
    showTextDocument: async (_doc: unknown): Promise<void> => undefined,
    showInformationMessage: (_msg: string): void => undefined,
    createTreeView: (_id: string, _opts: unknown): { dispose(): void } => ({ dispose: () => undefined }),
    registerTreeDataProvider: (_id: string, _p: unknown): { dispose(): void } => ({ dispose: () => undefined }),
  },
  commands: {
    registerCommand: (_id: string, _cb: () => void): { dispose(): void } => {
      return { dispose: () => undefined };
    },
    executeCommand: async (_id: string, ..._args: unknown[]): Promise<unknown> => undefined,
  },
  Uri: {
    file: (p: string): { fsPath: string } => ({ fsPath: p }),
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  Disposable: { from: (..._d: Array<{ dispose(): void }>) => ({ dispose: () => undefined }) },
};
