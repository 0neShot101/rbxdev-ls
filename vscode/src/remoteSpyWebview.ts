/**
 * Remote Spy WebView Panel
 * Advanced remote spy UI with call list, code view, ignore/block management
 */

import { randomBytes } from 'crypto';

import { Disposable, ExtensionContext, ViewColumn, WebviewPanel, window } from 'vscode';

import type { BlockEntry, IgnoreEntry, RemoteSpyCallEntry, RemoteSpyState } from './remoteSpyState';

/**
 * Messages sent from the extension host to the WebView
 */
export interface ToWebviewMessage {
  readonly type: 'addCall' | 'clear' | 'updateState' | 'selectResult';
  readonly call?: RemoteSpyCallEntry & { readonly index: number };
  readonly state?: WebviewStateSnapshot;
  readonly success?: boolean;
}

/**
 * Messages sent from the WebView to the extension host
 */
export interface FromWebviewMessage {
  readonly type:
    | 'selectCall'
    | 'copyCode'
    | 'copyPath'
    | 'copyArgs'
    | 'ignoreByPath'
    | 'ignoreByName'
    | 'blockByPath'
    | 'blockByName'
    | 'clearIgnores'
    | 'clearBlocks'
    | 'pause'
    | 'resume'
    | 'toggleSpy'
    | 'search'
    | 'clear'
    | 'removeIgnore'
    | 'removeBlock';
  readonly index?: number;
  readonly query?: string;
  readonly enabled?: boolean;
  readonly entry?: IgnoreEntry | BlockEntry;
}

interface WebviewStateSnapshot {
  readonly calls: ReadonlyArray<RemoteSpyCallEntry>;
  readonly selectedIndex: number;
  readonly paused: boolean;
  readonly ignoreCount: number;
  readonly blockCount: number;
  readonly spyEnabled: boolean;
  readonly ignoreList: ReadonlyArray<IgnoreEntry>;
  readonly blockList: ReadonlyArray<BlockEntry>;
}

export type RemoteSpyMessageHandler = (message: FromWebviewMessage) => void;

/**
 * Manages the Remote Spy WebView panel lifecycle
 */
export class RemoteSpyPanel {
  public static readonly viewType = 'rbxdev-remoteSpy';

  private panel: WebviewPanel | undefined;
  private disposables: Disposable[] = [];
  private messageHandler: RemoteSpyMessageHandler | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingCalls: Array<RemoteSpyCallEntry & { readonly index: number }> = [];

  constructor(private readonly context: ExtensionContext) {}

  /**
   * Registers the callback for messages from the WebView
   */
  onMessage = (handler: RemoteSpyMessageHandler): void => {
    this.messageHandler = handler;
  };

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
      (message: FromWebviewMessage) => {
        if (this.messageHandler !== undefined) this.messageHandler(message);
      },
      undefined,
      this.disposables,
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
      },
      undefined,
      this.disposables,
    );

    setTimeout(() => this.sendFullState(state, spyEnabled), 100);
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
      for (const c of batch) {
        this.panel?.webview.postMessage({ 'type': 'addCall', 'call': c });
      }
    }, 50);
  };

  /**
   * Sends the full state snapshot to the WebView
   */
  sendFullState = (state: RemoteSpyState, spyEnabled: boolean): void => {
    if (this.panel === undefined) return;

    this.panel.webview.postMessage({
      'type': 'updateState',
      'state': {
        'calls': state.calls,
        'selectedIndex': state.selectedIndex,
        'paused': state.paused,
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
    if (this.panel === undefined) return;
    this.panel.webview.postMessage({ 'type': 'clear' });
  };

  /**
   * Disposes the panel
   */
  dispose = (): void => {
    if (this.panel !== undefined) this.panel.dispose();
  };

  private escapeHtml = (text: string): string =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

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
    :root {
      --accent-event: #f0c340;
      --accent-event-dim: rgba(240, 195, 64, 0.12);
      --accent-event-glow: rgba(240, 195, 64, 0.25);
      --accent-func: #c084fc;
      --accent-func-dim: rgba(192, 132, 252, 0.12);
      --accent-func-glow: rgba(192, 132, 252, 0.25);
      --accent-danger: #f87171;
      --accent-danger-dim: rgba(248, 113, 113, 0.12);
      --accent-success: #4ade80;
      --radius: 6px;
      --radius-sm: 4px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /*  Toolbar  */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-wrap: wrap;
    }
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .toolbar-sep {
      width: 1px;
      height: 22px;
      background: var(--vscode-panel-border);
      margin: 0 4px;
      opacity: 0.6;
    }

    /*  Buttons  */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid transparent;
      border-radius: var(--radius);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      font-family: var(--vscode-font-family);
      transition: all 0.15s ease;
      letter-spacing: 0.01em;
    }
    .btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      border-color: var(--vscode-panel-border);
    }
    .btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: transparent;
    }
    .btn.primary:hover {
      background: var(--vscode-button-hoverBackground);
      box-shadow: 0 0 8px rgba(0,120,212,0.3);
    }
    .btn.danger {
      color: var(--accent-danger);
      border-color: var(--accent-danger-dim);
    }
    .btn.danger:hover {
      background: var(--accent-danger-dim);
      border-color: var(--accent-danger);
    }
    .btn:disabled { opacity: 0.4; cursor: default; pointer-events: none; }

    .search-box {
      flex: 1;
      min-width: 140px;
      max-width: 280px;
      padding: 5px 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: var(--radius);
      font-size: 12px;
      font-family: var(--vscode-font-family);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .search-box:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }
    .search-box::placeholder { opacity: 0.5; }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 9px;
      font-size: 10px;
      font-weight: 600;
    }

    /*  Main Layout  */
    .main {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    /*  Call List  */
    .call-list {
      width: 38%;
      min-width: 220px;
      border-right: 1px solid var(--vscode-panel-border);
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
    }
    .call-list::-webkit-scrollbar { width: 6px; }
    .call-list::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 3px;
    }
    .call-list::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-hoverBackground);
    }

    .call-item {
      display: flex;
      align-items: flex-start;
      padding: 8px 12px;
      cursor: pointer;
      gap: 10px;
      border-left: 3px solid transparent;
      transition: background 0.1s ease;
      position: relative;
    }
    .call-item + .call-item { border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 40%, transparent); }
    .call-item:hover { background: var(--vscode-list-hoverBackground); }
    .call-item.selected {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .call-item.event { border-left-color: var(--accent-event); }
    .call-item.event:hover { background: var(--accent-event-dim); }
    .call-item.function { border-left-color: var(--accent-func); }
    .call-item.function:hover { background: var(--accent-func-dim); }
    .call-item.blocked { opacity: 0.35; border-left-color: var(--accent-danger); }

    .call-info { flex: 1; min-width: 0; }
    .call-name {
      font-weight: 600;
      font-size: 12.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      letter-spacing: 0.01em;
    }
    .call-meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
    }
    .call-time {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      padding-top: 2px;
      opacity: 0.7;
      font-variant-numeric: tabular-nums;
    }
    .call-type-badge {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .call-type-badge.event {
      background: var(--accent-event-dim);
      color: var(--accent-event);
      border: 1px solid var(--accent-event-glow);
    }
    .call-type-badge.function {
      background: var(--accent-func-dim);
      color: var(--accent-func);
      border: 1px solid var(--accent-func-glow);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-descriptionForeground);
      padding: 32px;
      text-align: center;
      gap: 8px;
    }
    .empty-state .empty-icon { font-size: 32px; opacity: 0.3; }
    .empty-state .empty-text { font-size: 13px; opacity: 0.6; line-height: 1.5; }

    /*  Code Panel  */
    .code-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .code-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .code-header .header-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--accent-event);
    }
    .code-header .header-dot.fn { background: var(--accent-func); }
    .code-actions {
      display: flex;
      gap: 5px;
      padding: 8px 14px;
      background: color-mix(in srgb, var(--vscode-sideBar-background) 80%, var(--vscode-editor-background));
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-wrap: wrap;
    }
    .code-view {
      flex: 1;
      overflow: auto;
      padding: 16px 18px;
      font-family: var(--vscode-editor-font-family, 'Consolas, Courier New, monospace');
      font-size: var(--vscode-editor-font-size, 13px);
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
      tab-size: 2;
      scrollbar-width: thin;
    }
    .code-view::-webkit-scrollbar { width: 6px; }
    .code-view::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 3px;
    }
    .code-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--vscode-descriptionForeground);
      gap: 6px;
      opacity: 0.5;
    }
    .code-empty .code-empty-icon { font-size: 28px; }

    /*  Luau Syntax  */
    .kw { color: #c586c0; }
    .str { color: #ce9178; }
    .num { color: #b5cea8; }
    .cm { color: #6a9955; font-style: italic; }
    .fn { color: #dcdcaa; }
    .op { color: var(--vscode-foreground); }
    .gl { color: #4ec9b0; font-weight: 500; }

    /*  Lists Panel  */
    .lists-panel {
      border-top: 1px solid var(--vscode-panel-border);
      max-height: 160px;
      overflow-y: auto;
      background: var(--vscode-sideBar-background);
      scrollbar-width: thin;
    }
    .lists-panel .list-header {
      padding: 6px 14px;
      font-size: 10px;
      font-weight: 700;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: var(--vscode-sideBar-background);
      position: sticky;
      top: 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .list-entry {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 14px;
      font-size: 12px;
      transition: background 0.1s ease;
    }
    .list-entry:hover { background: var(--vscode-list-hoverBackground); }
    .list-entry .entry-type {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .list-entry .entry-value {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11.5px;
    }
    .list-entry .entry-remove {
      cursor: pointer;
      color: var(--vscode-descriptionForeground);
      font-size: 16px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      transition: all 0.1s ease;
      opacity: 0.5;
    }
    .list-entry:hover .entry-remove { opacity: 1; }
    .list-entry .entry-remove:hover {
      color: var(--accent-danger);
      background: var(--accent-danger-dim);
    }

    /*  Status Bar  */
    .status-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 14px;
      background: var(--vscode-statusBar-background);
      color: var(--vscode-statusBar-foreground);
      font-size: 11px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .status-bar .spacer { flex: 1; }
    .status-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--vscode-descriptionForeground);
    }
    .status-dot.active {
      background: var(--accent-success);
      box-shadow: 0 0 6px var(--accent-success);
      animation: pulse 2s ease-in-out infinite;
    }
    .status-dot.paused {
      background: var(--accent-event);
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-group">
      <button class="btn primary" id="btn-toggle" onclick="toggleSpy()">Enable Spy</button>
      <button class="btn" id="btn-pause" onclick="togglePause()" disabled>Pause</button>
      <button class="btn" id="btn-clear" onclick="clearCalls()">Clear</button>
    </div>
    <div class="toolbar-sep"></div>
    <div class="toolbar-group">
      <button class="btn" id="btn-ignores" onclick="toggleListsPanel('ignores')">Ignores <span class="badge" id="ignore-count">0</span></button>
      <button class="btn" id="btn-blocks" onclick="toggleListsPanel('blocks')">Blocks <span class="badge" id="block-count">0</span></button>
    </div>
    <input type="text" class="search-box" id="search" placeholder="Search remotes..." oninput="onSearch(this.value)">
  </div>

  <div class="main">
    <div class="call-list" id="call-list">
      <div class="empty-state" id="empty-state">
        <div class="empty-icon">&#128225;</div>
        <div class="empty-text">Enable the spy and trigger remotes<br>in-game to see calls here</div>
      </div>
    </div>
    <div class="code-panel">
      <div class="code-header" id="code-header" style="display:none;">
        <span class="header-dot" id="header-dot"></span>
        <span id="code-header-text">Code</span>
      </div>
      <div class="code-actions" id="code-actions" style="display:none;">
        <button class="btn" onclick="copyCode()">Copy Code</button>
        <button class="btn" onclick="copyPath()">Copy Path</button>
        <button class="btn" onclick="copyArgs()">Copy Args</button>
        <div class="toolbar-sep"></div>
        <button class="btn" onclick="ignoreByPath()">Ignore Path</button>
        <button class="btn" onclick="ignoreByName()">Ignore Name</button>
        <div class="toolbar-sep"></div>
        <button class="btn danger" onclick="blockByPath()">Block Path</button>
        <button class="btn danger" onclick="blockByName()">Block Name</button>
      </div>
      <div class="code-empty" id="code-empty">
        <div class="code-empty-icon">{ }</div>
        <span>Select a remote call to view its code</span>
      </div>
      <div class="code-view" id="code-view" style="display:none;"></div>
    </div>
  </div>

  <div class="lists-panel" id="lists-panel" style="display:none;"></div>

  <div class="status-bar">
    <span class="status-dot" id="status-dot"></span>
    <span id="status-text">Spy disabled</span>
    <span class="spacer"></span>
    <span id="call-count">0 calls</span>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let state = {
      calls: [],
      selectedIndex: -1,
      paused: false,
      spyEnabled: false,
      ignoreList: [],
      blockList: [],
      searchQuery: '',
      listsMode: null,
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

      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      while (i < len) {
        if (code[i] === '-' && code[i + 1] === '-') {
          let end = code.indexOf('\\n', i);
          if (end === -1) end = len;
          result += '<span class="cm">' + esc(code.slice(i, end)) + '</span>';
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
          result += '<span class="str">' + esc(code.slice(i, j)) + '</span>';
          i = j;
          continue;
        }

        if (code[i] >= '0' && code[i] <= '9') {
          let j = i;
          while (j < len && /[0-9.xXa-fA-Fe]/.test(code[j])) j++;
          result += '<span class="num">' + esc(code.slice(i, j)) + '</span>';
          i = j;
          continue;
        }

        if (/[a-zA-Z_]/.test(code[i])) {
          let j = i;
          while (j < len && /[a-zA-Z0-9_]/.test(code[j])) j++;
          const word = code.slice(i, j);
          if (LUAU_KEYWORDS.has(word)) result += '<span class="kw">' + esc(word) + '</span>';
          else if (LUAU_GLOBALS.has(word)) result += '<span class="gl">' + esc(word) + '</span>';
          else if (j < len && code[j] === '(') result += '<span class="fn">' + esc(word) + '</span>';
          else result += esc(word);
          i = j;
          continue;
        }

        result += esc(code[i]);
        i++;
      }
      return result;
    };

    const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString();

    const getCallClass = (call) => {
      const base = call.remoteType === 'RemoteFunction' ? 'function' : 'event';
      return base;
    };

    const matchesSearch = (call) => {
      if (state.searchQuery === '') return true;
      const q = state.searchQuery.toLowerCase();
      return call.remoteName.toLowerCase().includes(q)
        || call.method.toLowerCase().includes(q)
        || call.remotePath.join('.').toLowerCase().includes(q);
    };

    const renderCallList = () => {
      const list = document.getElementById('call-list');
      const empty = document.getElementById('empty-state');
      const filtered = state.calls.filter(matchesSearch);

      if (filtered.length === 0) {
        empty.style.display = 'flex';
        list.querySelectorAll('.call-item').forEach(el => el.remove());
        return;
      }

      empty.style.display = 'none';
      let html = '';
      for (let i = 0; i < filtered.length; i++) {
        const call = filtered[i];
        const realIndex = state.calls.indexOf(call);
        const typeClass = getCallClass(call);
        const selected = realIndex === state.selectedIndex ? ' selected' : '';
        const blocked = call._blocked ? ' blocked' : '';
        html += '<div class="call-item ' + typeClass + selected + blocked + '" data-index="' + realIndex + '" onclick="selectCall(' + realIndex + ')">'
          + '<div class="call-info">'
          + '<div class="call-name">' + escHtml(call.remoteName) + '</div>'
          + '<div class="call-meta">'
          + '<span class="call-type-badge ' + typeClass + '">' + call.method + '</span>'
          + '<span>' + escHtml(call.remoteType) + '</span>'
          + '</div></div>'
          + '<span class="call-time">' + formatTime(call.timestamp) + '</span>'
          + '</div>';
      }
      const items = list.querySelectorAll('.call-item');
      items.forEach(el => el.remove());
      empty.insertAdjacentHTML('afterend', html);
    };

    const renderCodeView = () => {
      const codeView = document.getElementById('code-view');
      const codeEmpty = document.getElementById('code-empty');
      const codeActions = document.getElementById('code-actions');
      const codeHeader = document.getElementById('code-header');
      const codeHeaderText = document.getElementById('code-header-text');
      const headerDot = document.getElementById('header-dot');

      if (state.selectedIndex < 0 || state.selectedIndex >= state.calls.length) {
        codeView.style.display = 'none';
        codeEmpty.style.display = 'flex';
        codeActions.style.display = 'none';
        codeHeader.style.display = 'none';
        return;
      }

      const call = state.calls[state.selectedIndex];
      const isFn = call.remoteType === 'RemoteFunction';
      codeView.style.display = 'block';
      codeEmpty.style.display = 'none';
      codeActions.style.display = 'flex';
      codeHeader.style.display = 'flex';
      codeHeaderText.textContent = call.remoteName + ' - ' + call.method;
      headerDot.className = 'header-dot' + (isFn ? ' fn' : '');
      codeView.innerHTML = highlightLuau(call.code);
    };

    const renderListsPanel = () => {
      const panel = document.getElementById('lists-panel');
      if (state.listsMode === null) {
        panel.style.display = 'none';
        return;
      }

      panel.style.display = 'block';
      let html = '';

      if (state.listsMode === 'ignores') {
        html += '<div class="list-header">Ignored Remotes (' + state.ignoreList.length + ')</div>';
        if (state.ignoreList.length === 0) {
          html += '<div class="list-entry" style="color:var(--vscode-descriptionForeground);font-style:italic;">No ignores set</div>';
        }
        for (const entry of state.ignoreList) {
          html += '<div class="list-entry">'
            + '<span class="entry-type">' + entry.type + '</span>'
            + '<span class="entry-value">' + escHtml(entry.value) + '</span>'
            + '<span class="entry-remove" onclick="removeIgnoreEntry(\\'' + escAttr(entry.type) + '\\', \\'' + escAttr(entry.value) + '\\')">x</span>'
            + '</div>';
        }
        html += '<div style="padding:4px 10px;"><button class="btn" onclick="doClearIgnores()" style="width:100%;">Clear All Ignores</button></div>';
      } else if (state.listsMode === 'blocks') {
        html += '<div class="list-header">Blocked Remotes (' + state.blockList.length + ')</div>';
        if (state.blockList.length === 0) {
          html += '<div class="list-entry" style="color:var(--vscode-descriptionForeground);font-style:italic;">No blocks set</div>';
        }
        for (const entry of state.blockList) {
          html += '<div class="list-entry">'
            + '<span class="entry-type">' + entry.type + '</span>'
            + '<span class="entry-value">' + escHtml(entry.value) + '</span>'
            + '<span class="entry-remove" onclick="removeBlockEntry(\\'' + escAttr(entry.type) + '\\', \\'' + escAttr(entry.value) + '\\')">x</span>'
            + '</div>';
        }
        html += '<div style="padding:4px 10px;"><button class="btn danger" onclick="doClearBlocks()" style="width:100%;">Clear All Blocks</button></div>';
      }
      panel.innerHTML = html;
    };

    const updateStatusBar = () => {
      const statusText = document.getElementById('status-text');
      const statusDot = document.getElementById('status-dot');
      const callCount = document.getElementById('call-count');
      const pauseBtn = document.getElementById('btn-pause');
      const toggleBtn = document.getElementById('btn-toggle');

      callCount.textContent = state.calls.length + ' calls';

      if (state.spyEnabled === false) {
        statusText.textContent = 'Spy disabled';
        statusDot.className = 'status-dot';
        toggleBtn.textContent = 'Enable Spy';
        toggleBtn.className = 'btn primary';
        pauseBtn.disabled = true;
      } else if (state.paused) {
        statusText.textContent = 'Paused';
        statusDot.className = 'status-dot paused';
        toggleBtn.textContent = 'Disable';
        toggleBtn.className = 'btn danger';
        pauseBtn.textContent = 'Resume';
        pauseBtn.disabled = false;
      } else {
        statusText.textContent = 'Listening';
        statusDot.className = 'status-dot active';
        toggleBtn.textContent = 'Disable';
        toggleBtn.className = 'btn danger';
        pauseBtn.textContent = 'Pause';
        pauseBtn.disabled = false;
      }

      document.getElementById('ignore-count').textContent = state.ignoreList.length.toString();
      document.getElementById('block-count').textContent = state.blockList.length.toString();
    };

    const escHtml = (s) => {
      if (typeof s !== 'string') return '';
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    const escAttr = (s) => {
      if (typeof s !== 'string') return '';
      return s.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
    };

    const selectCall = (index) => {
      state.selectedIndex = index;
      renderCallList();
      renderCodeView();
      vscode.postMessage({ type: 'selectCall', index });
    };

    const toggleSpy = () => {
      vscode.postMessage({ type: 'toggleSpy', enabled: state.spyEnabled === false });
    };

    const togglePause = () => {
      if (state.paused) vscode.postMessage({ type: 'resume' });
      else vscode.postMessage({ type: 'pause' });
    };

    const clearCalls = () => {
      vscode.postMessage({ type: 'clear' });
    };

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

    const doClearIgnores = () => { vscode.postMessage({ type: 'clearIgnores' }); };
    const doClearBlocks = () => { vscode.postMessage({ type: 'clearBlocks' }); };

    const removeIgnoreEntry = (type, value) => {
      vscode.postMessage({ type: 'removeIgnore', entry: { type, value } });
    };
    const removeBlockEntry = (type, value) => {
      vscode.postMessage({ type: 'removeBlock', entry: { type, value } });
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
    const callListEl = document.getElementById('call-list');
    callListEl.addEventListener('scroll', () => {
      const atBottom = callListEl.scrollHeight - callListEl.scrollTop - callListEl.clientHeight < 40;
      shouldAutoScroll = atBottom;
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.type === 'addCall') {
        state.calls.push(msg.call);
        if (state.calls.length > 1000) state.calls.shift();
        renderCallList();
        updateStatusBar();
        if (shouldAutoScroll) {
          requestAnimationFrame(() => { callListEl.scrollTop = callListEl.scrollHeight; });
        }
        return;
      }

      if (msg.type === 'clear') {
        state.calls = [];
        state.selectedIndex = -1;
        renderCallList();
        renderCodeView();
        updateStatusBar();
        return;
      }

      if (msg.type === 'updateState') {
        const s = msg.state;
        state.calls = s.calls || [];
        state.selectedIndex = s.selectedIndex;
        state.paused = s.paused;
        state.spyEnabled = s.spyEnabled;
        state.ignoreList = s.ignoreList || [];
        state.blockList = s.blockList || [];
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
  </script>
</body>
</html>`;
  };

  private getNonce = (): string => randomBytes(16).toString('base64url');
}
