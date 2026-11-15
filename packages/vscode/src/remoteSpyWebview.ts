/**
 * Remote Spy WebView Panel
 * Advanced remote spy UI with call list, code view, ignore/block management
 */

import { randomBytes } from 'crypto';

import { ViewColumn, window } from 'vscode';

import type { Disposable, ExtensionContext, WebviewPanel } from 'vscode';
import type {
  FromWebviewMessage,
  RemoteSpyCallEntry,
  RemoteSpyMessageHandler,
  RemoteSpyState,
} from '@typings/remoteSpy';
import { isBoolean, isListEntry, isNumber, isObject, isRemoteSpySource, isString } from '#extension/utils/guards';

/** Message kinds the remote spy webview posts to the extension host. */
const MESSAGE_TYPES: ReadonlyArray<FromWebviewMessage['type']> = [
  'ready',
  'setCaptureSource',
  'selectCall',
  'copyCode',
  'copyPath',
  'copyReturns',
  'copyArgs',
  'ignoreByPath',
  'ignoreByName',
  'blockByPath',
  'blockByName',
  'clearIgnores',
  'clearBlocks',
  'pause',
  'resume',
  'toggleSpy',
  'search',
  'clear',
  'removeIgnore',
  'removeBlock',
];

/**
 * Checks that a decoded value names a remote spy webview message kind.
 */
const isMessageType = (value: unknown): value is FromWebviewMessage['type'] =>
  MESSAGE_TYPES.some(type => type === value);

/**
 * Checks that a message posted by the remote spy webview matches its message contract.
 */
const isFromWebviewMessage = (value: unknown): value is FromWebviewMessage =>
  isObject(value) &&
  'type' in value &&
  isMessageType(value.type) &&
  ('index' in value === false || isNumber(value.index)) &&
  ('query' in value === false || isString(value.query)) &&
  ('enabled' in value === false || isBoolean(value.enabled)) &&
  ('source' in value === false || isRemoteSpySource(value.source)) &&
  ('entry' in value === false || isListEntry(value.entry));

/**
 * Manages the Remote Spy WebView panel lifecycle
 */
export class RemoteSpyPanel {
  /** WebView panel type identifier registered with VS Code. */
  public static readonly viewType = 'rbxdev-remoteSpy';

  private panel: WebviewPanel | undefined;
  private disposables: Disposable[] = [];
  private messageHandler: RemoteSpyMessageHandler | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingCalls: Array<RemoteSpyCallEntry & { readonly index: number }> = [];

  constructor(private readonly context: Pick<ExtensionContext, 'extensionUri'>) {}

  /**
   * Registers the callback for messages from the WebView
   */
  onMessage = (handler: RemoteSpyMessageHandler): void => void (this.messageHandler = handler);

  /**
   * Creates or reveals the WebView panel
   */
  show = (state: RemoteSpyState, spyEnabled: boolean): void => {
    if (this.panel !== undefined) {
      this.panel.reveal(ViewColumn.One);
      this.sendFullState(state, spyEnabled);
      return;
    }

    this.panel = window.createWebviewPanel(RemoteSpyPanel.viewType, 'Remote Spy', ViewColumn.One, {
      'enableScripts': true,
      'retainContextWhenHidden': true,
      'localResourceRoots': [this.context.extensionUri],
    });

    this.panel.iconPath = undefined;
    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(
      message => {
        if (this.messageHandler !== undefined && isFromWebviewMessage(message)) this.messageHandler(message);
      },
      undefined,
      this.disposables,
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.resetPending();
      },
      undefined,
      this.disposables,
    );
  };

  /**
   * Returns whether the panel is currently visible
   */
  get isVisible(): boolean {
    return this.panel !== undefined;
  }

  /**
   * Sends a new call to the WebView with debouncing for high-frequency updates
   */
  addCall = (call: RemoteSpyCallEntry, index: number): void => {
    if (this.panel === undefined) return;

    this.pendingCalls.push({ ...call, index });

    if (this.debounceTimer !== undefined) return;

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      const batch = this.pendingCalls.splice(0);
      for (const entry of batch) this.panel?.webview.postMessage({ 'type': 'addCall', 'call': entry });
    }, 50);
  };

  /**
   * Sends the full state snapshot to the WebView
   */
  sendFullState = (state: RemoteSpyState, spyEnabled: boolean, controlSettled = false): void => {
    if (this.panel === undefined) return;
    this.resetPending();

    this.panel.webview.postMessage({
      'type': 'updateState',
      controlSettled,
      'state': {
        'calls': state.calls,
        'selectedIndex': state.selectedIndex,
        'paused': state.paused,
        'captureSource': state.captureSource,
        'ignoreCount': state.ignoreList.length,
        'blockCount': state.blockList.length,
        spyEnabled,
        'ignoreList': state.ignoreList,
        'blockList': state.blockList,
      },
    });
  };

  /**
   * Clears the WebView display
   */
  clear = (): void => {
    this.resetPending();
    this.panel?.webview.postMessage({ 'type': 'clear' });
  };

  /**
   * Disposes the panel
   */
  dispose = (): void => void this.panel?.dispose();

  private resetPending = (): void => {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    this.pendingCalls = [];
  };

  private getHtml = (): string => {
    const nonce = this.getNonce();
    const cspSource = this.panel?.webview.cspSource ?? '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">

  <style>
    * { box-sizing: border-box; }
    :root {
      color-scheme: light dark;
      --border: var(--vscode-panel-border, var(--vscode-widget-border, #454545));
      --muted: var(--vscode-descriptionForeground, #999);
      --surface: var(--vscode-editor-background, #1f1f1f);
    }
    body {
      margin: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: var(--vscode-foreground, #ccc);
      background: var(--surface);
      font: var(--vscode-font-size, 13px) var(--vscode-font-family, sans-serif);
    }
    button, input, select, summary { font: inherit; }
    button, summary { cursor: pointer; }
    .source-control { display: flex; align-items: center; gap: 8px; margin-left: 8px; font-size: 12px; }
    .source-control span { color: var(--muted); }
    .source-control select { min-height: 28px; padding: 3px 24px 3px 8px; border: 1px solid var(--vscode-dropdown-border, var(--border)); border-radius: 2px; background: var(--vscode-dropdown-background, var(--surface)); color: var(--vscode-dropdown-foreground, inherit); }
    button:disabled { opacity: .5; cursor: default; }
    button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
      outline: 1px solid var(--vscode-focusBorder, #007fd4);
      outline-offset: -1px;
    }
    .btn {
      min-height: 28px;
      padding: 4px 10px;
      border: 1px solid transparent;
      border-radius: 2px;
      background: transparent;
      color: inherit;
      white-space: nowrap;
    }
    .btn:hover:not(:disabled), summary:hover { background: var(--vscode-toolbar-hoverBackground, #ffffff14); }
    .btn.primary {
      color: var(--vscode-button-foreground, #fff);
      background: var(--vscode-button-background, #0078d4);
    }
    .btn.primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground, #026ec1); }
    .btn.secondary { border-color: var(--border); }
    .btn.danger { color: var(--vscode-errorForeground, #f48771); }
    .btn[aria-pressed="true"] { background: var(--vscode-toolbar-activeBackground, #ffffff20); }
    .toolbar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
    }
    .toolbar-group { display: flex; align-items: center; gap: 4px; }
    .toolbar-end { margin-left: auto; display: flex; align-items: center; gap: 4px; }
    .count { color: var(--muted); font-variant-numeric: tabular-nums; margin-left: 4px; }
    .main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(290px, 40%) minmax(0, 1fr); }
    .capture-pane { min-height: 0; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--border); }
    .pane-heading { min-height: 38px; display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
    .pane-heading h2 { margin: 0; font-size: 12px; font-weight: 600; }
    .pane-heading .count { margin-left: auto; font-size: 11px; }
    .search-box {
      width: calc(100% - 24px);
      min-height: 28px;
      margin: 0 12px 10px;
      padding: 5px 8px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      color: var(--vscode-input-foreground, inherit);
      background: var(--vscode-input-background, #313131);
    }
    .search-box::placeholder { color: var(--vscode-input-placeholderForeground, var(--muted)); }
    .column-head, .call-item { display: grid; grid-template-columns: minmax(0, 1fr) 88px 72px; column-gap: 8px; align-items: center; }
    .column-head { padding: 6px 12px; border-block: 1px solid var(--border); font-size: 11px; color: var(--muted); }
    .column-head span:last-child { text-align: right; }
    .call-list { flex: 1; min-height: 0; overflow: auto; scrollbar-width: thin; }
    .call-item {
      width: 100%;
      text-align: left;
      padding: 8px 12px;
      border: 0;
      border-bottom: 1px solid var(--vscode-tree-tableColumnsBorder, #ffffff08);
      border-radius: 0;
      color: inherit;
      background: transparent;
    }
    .call-item:hover { background: var(--vscode-list-hoverBackground, #ffffff0a); }
    .call-item.selected {
      color: var(--vscode-list-activeSelectionForeground, #fff);
      background: var(--vscode-list-activeSelectionBackground, #04395e);
    }
    .call-info { min-width: 0; }
    .call-name, .call-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .call-name { font-size: 12px; line-height: 18px; }
    .call-path { color: var(--muted); font-size: 11px; line-height: 17px; }
    .selected .call-path, .selected .call-time { color: inherit; opacity: .8; }
    .call-method, .call-time { font-size: 11px; font-variant-numeric: tabular-nums; }
    .call-time { text-align: right; color: var(--muted); }
    .blocked-label { color: var(--vscode-errorForeground, #f48771); font-size: 10px; margin-left: 6px; }
    .empty-state, .code-empty { padding: 28px 20px; color: var(--muted); line-height: 1.6; }
    .empty-title { display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: var(--vscode-foreground, #ccc); }
    .empty-text { margin: 0; max-width: 44ch; font-size: 12px; }
    .code-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
    .code-header { padding: 16px 16px 12px; border-bottom: 1px solid var(--border); }
    .detail-title { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; }
    .detail-title h2 { font-size: 15px; font-weight: 500; margin: 0; overflow-wrap: anywhere; }
    .detail-type { color: var(--muted); font-size: 11px; }
    .detail-path { font: 11px/1.6 var(--vscode-editor-font-family, monospace); overflow-wrap: anywhere; margin: 8px 0; }
    .detail-meta { display: flex; flex-wrap: wrap; gap: 16px; color: var(--muted); font-size: 11px; }
    .code-actions { min-height: 38px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 4px 10px; border-bottom: 1px solid var(--border); }
    .view-tabs { display: flex; align-self: stretch; }
    .view-tab { border-bottom: 2px solid transparent; border-radius: 0; }
    .view-tab[aria-selected="true"] { border-bottom-color: var(--vscode-focusBorder, #007fd4); }
    .detail-actions { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; }
    .remote-actions { position: relative; }
    .remote-actions summary { list-style: none; min-height: 28px; padding: 5px 10px; border-radius: 2px; }
    .remote-actions summary::-webkit-details-marker { display: none; }
    .remote-actions[open] summary { background: var(--vscode-toolbar-activeBackground, #ffffff20); }
    .action-menu { position: absolute; top: 32px; right: 0; z-index: 2; width: 230px; max-height: calc(100vh - 24px); overflow-y: auto; border: 1px solid var(--border); background: var(--vscode-menu-background, var(--surface)); box-shadow: 0 2px 8px var(--vscode-widget-shadow, #0005); padding: 4px; }
    .action-menu .btn { display: block; width: 100%; text-align: left; }
    .action-menu hr { border: 0; border-top: 1px solid var(--border); margin: 4px; }
    .action-label { display: block; padding: 6px 10px 3px; color: var(--muted); font-size: 11px; }
    .code-view { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 16px; font: var(--vscode-editor-font-size, 13px)/1.6 var(--vscode-editor-font-family, monospace); white-space: pre; tab-size: 2; scrollbar-width: thin; }
    .kw { color: var(--vscode-debugTokenExpression-keyword, var(--vscode-foreground)); }
    .str { color: var(--vscode-debugTokenExpression-string, var(--vscode-foreground)); }
    .num { color: var(--vscode-debugTokenExpression-number, var(--vscode-foreground)); }
    .cm { color: var(--muted); }
    .gl, .fn { color: var(--vscode-debugTokenExpression-name, var(--vscode-foreground)); }
    .lists-panel { border-top: 1px solid var(--border); max-height: 220px; overflow: auto; background: var(--vscode-sideBar-background, var(--surface)); }
    .list-header { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; }
    .list-header .btn { margin-left: auto; }
    .list-description { margin: 0; padding: 0 12px 10px; color: var(--muted); font-size: 12px; }
    .list-entry { display: flex; align-items: center; gap: 12px; padding: 4px 12px; border-top: 1px solid var(--border); }
    .entry-type { width: 36px; color: var(--muted); font-size: 11px; }
    .entry-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
    .status-bar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; }
    .status-dot { width: 6px; height: 6px; border: 1px solid currentColor; border-radius: 50%; flex-shrink: 0; }
    .status-dot.active { background: var(--vscode-testing-iconPassed, #73c991); border-color: transparent; }
    .status-dot.paused { background: var(--vscode-editorWarning-foreground, #cca700); border-color: transparent; }
    .status-bar .spacer { flex: 1; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    @media (max-width: 760px) {
      .main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(170px, 42%) minmax(0, 1fr); }
      .capture-pane { border-right: 0; border-bottom: 1px solid var(--border); }
      .code-header { padding: 10px 12px; }
      .detail-meta { gap: 8px; }
      .detail-path { margin: 4px 0; }
      .toolbar { padding: 6px 8px; }
      .toolbar-end { margin-left: 0; }
    }
    @media (forced-colors: active) {
      .btn, .call-item.selected { border: 1px solid ButtonText; }
      .status-dot.active, .status-dot.paused { background: Highlight; }
    }
  </style>
</head>
<body>
  <header class="toolbar" aria-label="Capture controls">
    <div class="toolbar-group">
      <button class="btn primary" id="btn-toggle" data-action="toggleSpy">Start capture</button>
      <button class="btn secondary" id="btn-pause" data-action="togglePause" title="Pause the displayed log, not outgoing remote calls" disabled>Pause display</button>
      <button class="btn" id="btn-clear" data-action="clearCalls">Clear log</button>
    </div>
    <label class="source-control" title="Filters new capture and the visible list. Existing log entries are retained.">
      <span>Capture source</span>
      <select id="capture-source" aria-label="Capture source">
        <option value="game">Game</option>
        <option value="executor">Executor</option>
        <option value="both">Both</option>
      </select>
    </label>
    <div class="toolbar-end">
      <button class="btn" id="btn-ignores" data-action="toggleListsPanel" data-list-mode="ignores" aria-pressed="false">Ignored <span class="count" id="ignore-count">0</span></button>
      <button class="btn" id="btn-blocks" data-action="toggleListsPanel" data-list-mode="blocks" aria-pressed="false">Blocked <span class="count" id="block-count">0</span></button>
    </div>
  </header>

  <main class="main">
    <section class="capture-pane" aria-labelledby="calls-heading">
      <div class="pane-heading">
        <h2 id="calls-heading">Captured calls</h2>
        <span class="count" id="shown-count">0 / 0</span>
      </div>
      <label class="sr-only" for="search">Filter captured calls by name, path, or method</label>
      <input type="search" class="search-box" id="search" placeholder="Filter by name, path, or method" autocomplete="off" spellcheck="false">
      <div class="column-head" aria-hidden="true"><span>Remote / path</span><span>Method</span><span>Time</span></div>
      <div class="call-list" id="call-list" role="group" aria-label="Captured remote calls">
        <div class="empty-state" id="empty-state">
          <span class="empty-title" id="empty-title">No calls captured</span>
          <p class="empty-text" id="empty-text">Start capture, then use an in-game action that sends a remote call.</p>
        </div>
      </div>
    </section>
    <section class="code-panel" aria-label="Selected call details">
      <div class="code-header" id="code-header" style="display:none;">
        <div class="detail-title"><h2 id="code-header-text"></h2><span class="detail-type" id="detail-type"></span></div>
        <div class="detail-path" id="detail-path"></div>
        <div class="detail-meta"><span id="detail-method"></span><span id="detail-time"></span><span id="detail-blocked"></span></div>
        <div class="detail-meta"><span id="detail-source"></span></div>
      </div>
      <div class="code-actions" id="code-actions" style="display:none;">
        <div class="view-tabs" role="tablist" aria-label="Call content">
          <button class="btn view-tab" id="tab-code" data-action="showCode" role="tab" aria-selected="true" aria-controls="code-view">Replay code</button>
          <button class="btn view-tab" id="tab-args" data-action="showArgs" role="tab" aria-selected="false" aria-controls="code-view">Arguments</button>
          <button class="btn view-tab" id="tab-returns" data-action="showReturns" role="tab" aria-selected="false" aria-controls="code-view">Returns</button>
        </div>
        <div class="detail-actions">
          <button class="btn" id="copy-content" data-action="copyCode">Copy code</button>
          <details class="remote-actions" id="remote-actions">
            <summary aria-label="Actions for this remote">Remote actions</summary>
            <div class="action-menu">
              <button class="btn" data-action="copyPath">Copy instance path</button>
              <hr>
              <span class="action-label">Ignore future calls in this log</span>
              <button class="btn" data-action="ignoreByPath">Ignore this path</button>
              <button class="btn" data-action="ignoreByName">Ignore matching names</button>
              <hr>
              <span class="action-label">Prevent outgoing calls</span>
              <button class="btn danger" data-action="blockByPath">Block this path</button>
              <button class="btn danger" data-action="blockByName">Block matching names</button>
            </div>
          </details>
        </div>
      </div>
      <div class="code-empty" id="code-empty">
        <span class="empty-title">Select a captured call</span>
        <p class="empty-text">Inspect its destination, arguments, and replay code. Ignore or block rules apply to future calls.</p>
      </div>
      <pre class="code-view" id="code-view" role="tabpanel" aria-labelledby="tab-code" tabindex="0" style="display:none;"></pre>
    </section>
  </main>

  <section class="lists-panel" id="lists-panel" aria-label="Remote rules" style="display:none;"></section>

  <footer class="status-bar">
    <span class="status-dot" id="status-dot" aria-hidden="true"></span>
    <span id="status-text" role="status">Capture stopped</span>
    <span class="spacer"></span>
    <span id="call-count">0 calls · latest 1,000 retained</span>
  </footer>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const state = {
      calls: [],
      selectedIndex: -1,
      paused: false,
      spyEnabled: false,
      ignoreList: [],
      blockList: [],
      searchQuery: '',
      listsMode: null,
      viewMode: 'code',
      capturePending: false,
      captureSource: 'game',
      sourcePending: false,
    };

    const LUAU_KEYWORDS = new Set([
      'and', 'break', 'continue', 'do', 'else', 'elseif', 'end', 'false',
      'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or',
      'repeat', 'return', 'then', 'true', 'until', 'while', 'type', 'export',
    ]);

    const LUAU_GLOBALS = new Set([
      'game', 'workspace', 'script', 'Instance', 'Vector3', 'Vector2',
      'CFrame', 'Color3', 'UDim2', 'UDim', 'BrickColor', 'Enum',
      'math', 'string', 'table', 'task', 'coroutine', 'debug', 'os',
      'pcall', 'xpcall', 'select', 'unpack', 'require', 'typeof', 'type',
      'tostring', 'tonumber', 'print', 'warn', 'error', 'pairs', 'ipairs', 'next',
      'setmetatable', 'getmetatable', 'rawget', 'rawset', 'rawlen', 'rawequal',
      'tick', 'time', 'wait', 'delay', 'spawn',
    ]);

    const highlightLuau = (code) => {
      let result = '';
      let i = 0;
      const len = code.length;

      const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      while (i < len) {
        if (code[i] === '-' && code[i + 1] === '-') {
          let end = code.indexOf('\\n', i);
          if (end === -1) end = len;
          result += '<span class="cm">' + escape(code.slice(i, end)) + '</span>';
          i = end;
          continue;
        }

        if (code[i] === '"' || code[i] === "'") {
          const q = code[i];
          let j = i + 1;
          while (j < len && code[j] !== q) {
            if (code[j] === '\\\\') j++;
            j++;
          }
          j = Math.min(j + 1, len);
          result += '<span class="str">' + escape(code.slice(i, j)) + '</span>';
          i = j;
          continue;
        }

        if (code[i] >= '0' && code[i] <= '9') {
          let j = i;
          while (j < len && /[0-9.xXa-fA-Fe]/.test(code[j])) j++;
          result += '<span class="num">' + escape(code.slice(i, j)) + '</span>';
          i = j;
          continue;
        }

        if (/[a-zA-Z_]/.test(code[i])) {
          let j = i;
          while (j < len && /[a-zA-Z0-9_]/.test(code[j])) j++;
          const word = code.slice(i, j);
          if (LUAU_KEYWORDS.has(word)) result += '<span class="kw">' + escape(word) + '</span>';
          else if (LUAU_GLOBALS.has(word)) result += '<span class="gl">' + escape(word) + '</span>';
          else if (j < len && code[j] === '(') result += '<span class="fn">' + escape(word) + '</span>';
          else result += escape(word);
          i = j;
          continue;
        }

        result += escape(code[i]);
        i++;
      }
      return result;
    };

    const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString();

    const matchesSearch = (call) => {
      if (state.captureSource !== 'both' && call.source !== undefined && call.source !== state.captureSource)
        return false;

      if (state.searchQuery === '') return true;
      const q = state.searchQuery.toLowerCase();
      return call.remoteName.toLowerCase().includes(q)
        || call.method.toLowerCase().includes(q)
        || call.remotePath.join('.').toLowerCase().includes(q);
    };

    const renderCallList = () => {
      const list = document.getElementById('call-list');
      const empty = document.getElementById('empty-state');
      const filtered = state.calls.map((call, index) => ({ call, index })).filter(entry => matchesSearch(entry.call));
      const focused = document.activeElement?.closest('.call-item')?.getAttribute('data-index');
      document.getElementById('shown-count').textContent = filtered.length + ' / ' + state.calls.length;
      document.getElementById('empty-title').textContent = state.searchQuery !== ''
        ? 'No matching calls'
        : state.calls.length > 0 ? 'No calls from this source' : 'No calls captured';
      document.getElementById('empty-text').textContent = state.searchQuery !== ''
        ? 'Try a different name, path, or method. Filtering does not change capture.'
        : state.paused
          ? 'The display is paused. Resume it to add new calls to this log.'
          : state.spyEnabled
            ? (state.captureSource === 'game'
              ? 'Waiting for a game-origin remote call. Executor calls are excluded; choose Both to include them.'
              : state.captureSource === 'executor'
                ? 'Waiting for a remote call from your executor. Game-origin calls are excluded.'
                : 'Waiting for a remote call from the game or your executor.')
            : 'Start capture, then trigger a remote call from the selected source.';
      empty.style.display = filtered.length === 0 ? 'block' : 'none';
      list.querySelectorAll('.call-item').forEach(item => item.remove());
      let html = '';
      for (const { call, index } of filtered) {
        const selected = index === state.selectedIndex;
        const path = call.remotePath.join('.');
        html += '<button type="button" class="call-item' + (selected ? ' selected' : '') + '" data-index="' + index + '" aria-pressed="' + selected + '" title="' + escapeAttr(path) + '">'
          + '<span class="call-info"><span class="call-name" style="display:block;">' + escapeHtml(call.remoteName)
          + (call._blocked === true ? '<span class="blocked-label">Blocked</span>' : '') + '</span>'
          + '<span class="call-path" style="display:block;">' + escapeHtml(path) + '</span></span>'
          + '<span class="call-method">' + escapeHtml(call.method) + '</span>'
          + '<span class="call-time">' + escapeHtml(formatTime(call.timestamp)) + '</span></button>';
      }
      empty.insertAdjacentHTML('afterend', html);
      if (focused !== undefined && focused !== null)
        list.querySelector('[data-index="' + Number(focused) + '"]')?.focus({ preventScroll: true });
    };

    const renderCodeView = () => {
      const codeView = document.getElementById('code-view');
      const codeEmpty = document.getElementById('code-empty');
      const codeActions = document.getElementById('code-actions');
      const codeHeader = document.getElementById('code-header');
      const call = state.calls[state.selectedIndex];
      const hasCall = call !== undefined;
      codeView.style.display = hasCall ? 'block' : 'none';
      codeEmpty.style.display = hasCall ? 'none' : 'block';
      codeActions.style.display = hasCall ? 'flex' : 'none';
      codeHeader.style.display = hasCall ? 'block' : 'none';
      if (hasCall === false) return;

      document.getElementById('code-header-text').textContent = call.remoteName;
      document.getElementById('detail-type').textContent = call.remoteType;
      document.getElementById('detail-path').textContent = call.remotePath.join('.');
      document.getElementById('detail-method').textContent = call.method;
      document.getElementById('detail-source').textContent = 'Caller: ' + (call.source ?? 'unknown');
      document.getElementById('detail-time').textContent = 'Captured ' + formatTime(call.timestamp);
      document.getElementById('detail-blocked').textContent = call._blocked === true ? 'Blocked before dispatch' : 'Not blocked by this spy';
      const tabs = ['code', 'arguments', 'returns'];
      const buttons = ['tab-code', 'tab-args', 'tab-returns'];

      for (let index = 0; index < tabs.length; index++) {
        const selected = state.viewMode === tabs[index];
        const button = document.getElementById(buttons[index]);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      }

      codeView.setAttribute('aria-labelledby', buttons[tabs.indexOf(state.viewMode)]);
      const copy = document.getElementById('copy-content');
      copy.disabled = false;

      if (state.viewMode === 'returns') {
        copy.textContent = 'Copy return values';
        copy.setAttribute('data-action', 'copyReturns');
        copy.disabled = call.returnStatus !== 'returned';
        codeView.innerHTML = highlightLuau(call.returns ?? '');

        if (call.method !== 'InvokeServer')
          codeView.textContent = 'RemoteEvents are one-way. FireServer does not return a server response.';
        else if (call.returnStatus === 'blocked')
          codeView.textContent = 'This call was blocked. The server was not invoked.';
        else if (call.returnStatus === 'pending')
          codeView.textContent = 'No response captured yet. The invocation may still be waiting, or may have failed.';
        else if (call.returnStatus === 'unavailable')
          codeView.textContent = 'The call returned, but its values could not be serialized.';
        else if (call.returnStatus !== 'returned')
          codeView.textContent = 'Return values were not recorded by this bridge version.';
        else if (call.returnCount === 0)
          codeView.textContent = 'The call completed with no return values (zero values, not a returned nil).';
        return;
      }

      const isCode = state.viewMode === 'code';
      copy.textContent = isCode ? 'Copy code' : 'Copy arguments';
      copy.setAttribute('data-action', isCode ? 'copyCode' : 'copyArgs');
      codeView.innerHTML = highlightLuau(isCode ? call.code : call.arguments);
      if (isCode === false && call.arguments === '') codeView.textContent = 'No arguments';
    };

    const renderListsPanel = () => {
      const panel = document.getElementById('lists-panel');
      document.getElementById('btn-ignores').setAttribute('aria-pressed', String(state.listsMode === 'ignores'));
      document.getElementById('btn-blocks').setAttribute('aria-pressed', String(state.listsMode === 'blocks'));
      panel.style.display = state.listsMode === null ? 'none' : 'block';
      if (state.listsMode === null) return;
      const ignored = state.listsMode === 'ignores';
      const entries = ignored ? state.ignoreList : state.blockList;
      let html = '<div class="list-header">' + (ignored ? 'Ignored remotes' : 'Blocked remotes')
        + '<button class="btn" data-action="' + (ignored ? 'clearIgnores' : 'clearBlocks') + '"' + (entries.length === 0 ? ' disabled' : '') + '>Clear rules</button></div>'
        + '<p class="list-description">' + (ignored
          ? 'Matching future calls are omitted from this log. They still reach the game server.'
          : 'Matching outgoing calls are stopped by the active spy hook. Stopping capture removes these hooks.')
        + '</p>';
      if (entries.length === 0) html += '<p class="list-description">No rules. Select a call and use Remote actions to add one.</p>';
      for (const entry of entries)
        html += '<div class="list-entry"><span class="entry-type">' + escapeHtml(entry.type) + '</span>'
          + '<span class="entry-value" title="' + escapeAttr(entry.value) + '">' + escapeHtml(entry.value) + '</span>'
          + '<button class="btn" aria-label="Remove rule for ' + escapeAttr(entry.value) + '" data-action="'
          + (ignored ? 'removeIgnore' : 'removeBlock') + '" data-entry-type="' + escapeAttr(entry.type) + '" data-entry-value="' + escapeAttr(entry.value) + '">Remove</button></div>';
      panel.innerHTML = html;
    };

    const updateStatusBar = () => {
      const statusText = document.getElementById('status-text');
      const statusDot = document.getElementById('status-dot');
      const callCount = document.getElementById('call-count');
      const pauseButton = document.getElementById('btn-pause');
      const toggleButton = document.getElementById('btn-toggle');

      callCount.textContent = state.calls.length + ' calls · latest 1,000 retained';
      const enabled = state.spyEnabled;
      const origin = state.captureSource === 'both' ? 'game and executor' : state.captureSource;
      statusText.textContent = enabled === false ? 'Capture stopped' : state.paused ? 'Display paused · outgoing capture remains active' : 'Capturing ' + origin + ' calls';
      statusDot.className = 'status-dot' + (enabled ? state.paused ? ' paused' : ' active' : '');
      toggleButton.disabled = state.capturePending || state.sourcePending;
      toggleButton.textContent = state.sourcePending
        ? 'Updating source…'
        : state.capturePending
          ? (enabled ? 'Stopping…' : 'Starting…')
          : (enabled ? 'Stop capture' : 'Start capture');

      const source = document.getElementById('capture-source');
      source.disabled = state.capturePending || state.sourcePending;
      if (state.sourcePending === false) source.value = state.captureSource;
      toggleButton.className = enabled ? 'btn secondary' : 'btn primary';
      toggleButton.setAttribute('aria-pressed', String(enabled));
      pauseButton.textContent = state.paused ? 'Resume display' : 'Pause display';
      pauseButton.disabled = enabled === false;
      document.getElementById('btn-clear').disabled = state.calls.length === 0;

      document.getElementById('ignore-count').textContent = state.ignoreList.length.toString();
      document.getElementById('block-count').textContent = state.blockList.length.toString();
    };

    const escapeHtml = (s) => {
      if (typeof s !== 'string') return '';
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    const escapeAttr = (s) => {
      if (typeof s !== 'string') return '';
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const selectCall = (index) => {
      state.selectedIndex = index;
      renderCallList();
      renderCodeView();
      document.querySelector('.call-item[data-index="' + index + '"]')?.focus({ preventScroll: true });
      vscode.postMessage({ type: 'selectCall', index });
    };

    const toggleSpy = () => {
      if (state.capturePending || state.sourcePending) return;
      state.capturePending = true;
      updateStatusBar();
      vscode.postMessage({ type: 'toggleSpy', enabled: state.spyEnabled === false });
    };

    const togglePause = () => vscode.postMessage({ type: state.paused ? 'resume' : 'pause' });

    const clearCalls = () => vscode.postMessage({ type: 'clear' });

    const copyCode = () => {
      if (state.selectedIndex >= 0) vscode.postMessage({ type: 'copyCode', index: state.selectedIndex });
    };
    const copyPath = () => {
      if (state.selectedIndex >= 0) vscode.postMessage({ type: 'copyPath', index: state.selectedIndex });
    };
    const copyArgs = () => {
      if (state.selectedIndex >= 0) vscode.postMessage({ type: 'copyArgs', index: state.selectedIndex });
    };

    const ignoreByPath = () => {
      if (state.selectedIndex >= 0) vscode.postMessage({ type: 'ignoreByPath', index: state.selectedIndex });
    };
    const ignoreByName = () => {
      if (state.selectedIndex >= 0) vscode.postMessage({ type: 'ignoreByName', index: state.selectedIndex });
    };
    const blockByPath = () => {
      if (state.selectedIndex >= 0) vscode.postMessage({ type: 'blockByPath', index: state.selectedIndex });
    };
    const blockByName = () => {
      if (state.selectedIndex >= 0) vscode.postMessage({ type: 'blockByName', index: state.selectedIndex });
    };

    const toggleListsPanel = (mode) => {
      state.listsMode = state.listsMode === mode ? null : mode;
      renderListsPanel();
    };

    const onSearch = (query) => {
      state.searchQuery = query;
      renderCallList();
    };

    let shouldAutoScroll = true;
    const callList = document.getElementById('call-list');
    callList.addEventListener(
      'scroll',
      () => (shouldAutoScroll = callList.scrollHeight - callList.scrollTop - callList.clientHeight < 40),
    );

    document.addEventListener('click', (event) => {
      const eventTarget = event.target;
      const eventElement =
        eventTarget instanceof Element ? eventTarget : eventTarget instanceof Node ? eventTarget.parentElement : null;
      const target = eventElement?.closest('[data-action], .call-item') ?? null;
      if (target === null) return;

      if (target.classList.contains('call-item')) {
        const index = Number(target.getAttribute('data-index'));
        if (Number.isInteger(index)) selectCall(index);
        return;
      }

      const action = target.getAttribute('data-action');
      if (action === null) return;

      switch (action) {
        case 'showCode':
        case 'showArgs':
        case 'showReturns':
          state.viewMode = action === 'showCode' ? 'code' : action === 'showArgs' ? 'arguments' : 'returns';
          renderCodeView();
          break;
        case 'copyReturns':
          if (state.selectedIndex >= 0) vscode.postMessage({ type: 'copyReturns', index: state.selectedIndex });
          break;
        case 'toggleSpy':
          toggleSpy();
          break;
        case 'togglePause':
          togglePause();
          break;
        case 'clearCalls':
          clearCalls();
          break;
        case 'toggleListsPanel': {
          const mode = target.getAttribute('data-list-mode');
          if (mode === 'ignores' || mode === 'blocks') toggleListsPanel(mode);
          break;
        }
        case 'copyCode':
          copyCode();
          break;
        case 'copyPath':
          copyPath();
          break;
        case 'copyArgs':
          copyArgs();
          break;
        case 'ignoreByPath':
          ignoreByPath();
          break;
        case 'ignoreByName':
          ignoreByName();
          break;
        case 'blockByPath':
          blockByPath();
          break;
        case 'blockByName':
          blockByName();
          break;
        case 'clearIgnores':
          vscode.postMessage({ 'type': 'clearIgnores' });
          break;
        case 'clearBlocks':
          vscode.postMessage({ 'type': 'clearBlocks' });
          break;
        case 'removeIgnore':
        case 'removeBlock': {
          const type = target.getAttribute('data-entry-type');
          const value = target.getAttribute('data-entry-value');
          if ((type === 'name' || type === 'path') && value !== null)
            vscode.postMessage({
              'type': action === 'removeIgnore' ? 'removeIgnore' : 'removeBlock',
              'entry': { type, value },
            });
          break;
        }
      }
      if (target.closest('.action-menu') !== null) document.getElementById('remote-actions').open = false;
    });

    document.addEventListener('keydown', event => {
      const target = event.target;
      if (target instanceof HTMLElement === false) return;
      if (event.key === 'Escape') {
        const menu = document.getElementById('remote-actions');
        if (menu.open) {
          menu.open = false;
          menu.querySelector('summary').focus();
        }
        return;
      }
      if (target.classList.contains('view-tab') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const modes = ['code', 'arguments', 'returns'];
        const buttons = ['tab-code', 'tab-args', 'tab-returns'];
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const index = (modes.indexOf(state.viewMode) + direction + modes.length) % modes.length;
        state.viewMode = modes[index];
        renderCodeView();
        document.getElementById(buttons[index]).focus();
        return;
      }
      if (target.classList.contains('call-item') === false) return;
      const rows = [...document.querySelectorAll('.call-item')];
      const position = rows.indexOf(target);
      let next = position;
      if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, position + 1);
      else if (event.key === 'ArrowUp') next = Math.max(0, position - 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = rows.length - 1;
      else return;
      event.preventDefault();
      selectCall(Number(rows[next].getAttribute('data-index')));
    });

    document.getElementById('capture-source').addEventListener('change', event => {
      const source = event.target.value;

      if (source !== 'game' && source !== 'executor' && source !== 'both') return;
      if (state.capturePending || state.sourcePending) return;

      state.sourcePending = true;
      updateStatusBar();
      vscode.postMessage({ type: 'setCaptureSource', source });
    });

    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) onSearch(target.value);
    });

    document.getElementById('remote-actions').addEventListener('toggle', event => {
      if (event.currentTarget.open === false) return;
      const menu = event.currentTarget.querySelector('.action-menu');
      menu.style.top = '32px';
      menu.style.bottom = 'auto';
      if (menu.getBoundingClientRect().bottom > window.innerHeight - 8) {
        menu.style.top = 'auto';
        menu.style.bottom = '32px';
      }
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'addCall') {
        state.calls.push(message.call);
        if (state.calls.length > 1000) {
          state.calls.shift();
          state.selectedIndex = Math.max(-1, state.selectedIndex - 1);
        }
        renderCallList();
        renderCodeView();
        updateStatusBar();
        if (shouldAutoScroll) requestAnimationFrame(() => (callList.scrollTop = callList.scrollHeight));
        return;
      }

      if (message.type === 'clear') {
        state.calls = [];
        state.selectedIndex = -1;
        renderCallList();
        renderCodeView();
        updateStatusBar();
        return;
      }

      if (message.type === 'updateState') {
        const snapshot = message.state;
        if (message.controlSettled === true) {
          state.capturePending = false;
          state.sourcePending = false;
        }
        state.captureSource = snapshot.captureSource ?? 'game';
        state.calls = snapshot.calls ?? [];
        state.selectedIndex = snapshot.selectedIndex;
        state.paused = snapshot.paused;
        state.spyEnabled = snapshot.spyEnabled;
        state.ignoreList = snapshot.ignoreList ?? [];
        state.blockList = snapshot.blockList ?? [];
        renderCallList();
        renderCodeView();
        renderListsPanel();
        updateStatusBar();
        return;
      }
    });

    renderCallList();
    renderCodeView();
    updateStatusBar();
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  };

  private getNonce = (): string => randomBytes(16).toString('base64url');
}
