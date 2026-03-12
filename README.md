# PostgreSQL Browser for Obsidian

A desktop-only Obsidian plugin that connects to PostgreSQL databases and provides a sidebar interface for browsing schemas, previewing table data, and running SQL queries.

## Features

- **Multiple named connections** -- configure and switch between several PostgreSQL databases
- **Schema tree browser** -- collapsible tree showing schemas, tables, views, and columns with types and primary key indicators
- **Table data preview** -- click any table to see its first N rows
- **SQL query editor** -- write and execute arbitrary SQL with Ctrl/Cmd+Enter
- **Results table** -- scrollable results with sticky headers, row counts, and query duration
- **Error display** -- PostgreSQL error codes, details, and hints rendered inline

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Obsidian (Electron)                                     │
│                                                         │
│  main.ts                                                │
│  ├── Plugin lifecycle (onload / onunload)               │
│  ├── Registers sidebar view, settings tab, ribbon icon  │
│  │                                                      │
│  ├── settings.ts                                        │
│  │   └── Connection CRUD, test button, global prefs     │
│  │                                                      │
│  ├── db/                                                │
│  │   ├── connection-manager.ts  (pool lifecycle)        │
│  │   ├── schema-introspection.ts (information_schema)   │
│  │   └── query-executor.ts      (sql.unsafe for queries)│
│  │                                                      │
│  └── views/                                             │
│      ├── sidebar-view.ts    (main ItemView, orchestrator)│
│      ├── connection-selector.ts (dropdown + refresh)    │
│      ├── schema-tree.ts    (collapsible tree)           │
│      ├── query-editor.ts   (textarea + run button)      │
│      └── results-table.ts  (HTML table renderer)        │
│                                                         │
│  [postgres npm package] ──TCP/TLS──> PostgreSQL server  │
└─────────────────────────────────────────────────────────┘
```

The plugin uses the `postgres` npm package (porsager/postgres), a pure-JavaScript PostgreSQL client with zero native dependencies. It connects directly to PostgreSQL over TCP/TLS using Node.js `net` and `tls` modules provided by Obsidian's Electron runtime. All dependencies are bundled into a single `main.js` file via esbuild; Node.js built-in modules are externalized and resolved at runtime.

This means **no middleware server is needed** -- the plugin talks directly to your PostgreSQL database.

### Why desktop-only?

Obsidian mobile (iOS/Android) runs in a webview without Node.js. The `net` and `tls` modules required for TCP connections to PostgreSQL are unavailable there. The plugin's `manifest.json` sets `isDesktopOnly: true` to prevent installation on mobile.

## Installation

### From source

```bash
cd /path/to/this/repo
npm install
npm run build
```

This produces three files needed by Obsidian:

- `main.js` (bundled plugin code, ~97KB)
- `manifest.json` (plugin metadata)
- `styles.css` (sidebar styles)

### Loading into Obsidian

1. Copy `main.js`, `manifest.json`, and `styles.css` into your vault at:
   ```
   <vault>/.obsidian/plugins/postgres-browser/
   ```
2. Open Obsidian and go to **Settings > Community plugins**
3. If prompted, enable community plugins
4. Find **PostgreSQL Browser** in the list and enable it

### Development mode

```bash
npm run dev
```

This starts esbuild in watch mode. Changes to `src/` are automatically recompiled. Use Obsidian's "Reload app without saving" (Ctrl/Cmd+R) to pick up changes, or install the Hot Reload plugin.

## Configuration

Open **Settings > PostgreSQL Browser** to configure:

### Connections

- **Add Connection** -- creates a new named connection
- **Connection name** -- a display label (e.g., "Production", "Local Dev")
- **Connection string** -- standard PostgreSQL URI format:
  ```
  postgresql://user:password@host:port/database
  ```
  The field is masked by default (password input).
- **Test Connection** -- verifies the connection works (runs `SELECT 1`)
- **Delete** -- removes the connection and closes any active pool

### Global settings

- **Preview row limit** -- maximum rows fetched when clicking a table (default: 100)
- **Query timeout** -- not yet enforced at the query level (default: 30s, reserved for future use)

### Security note

Connection strings (including passwords) are stored in **plaintext** in your vault's `.obsidian/plugins/postgres-browser/data.json`. Be mindful of this if your vault is synced or version-controlled.

## Usage

1. Click the **database icon** in the left ribbon (or use the command palette: "Open PostgreSQL Browser")
2. Select a connection from the dropdown at the top of the sidebar
3. The schema tree loads automatically -- expand schemas and tables to see columns
4. **Click a table** to preview its data in the results panel below
5. **Write SQL** in the query editor textarea
6. Press **Ctrl+Enter** (Cmd+Enter on Mac) or click **Run Query** to execute
7. Results appear in the scrollable table at the bottom, with row count and duration

## Project structure

```
postgres/
├── manifest.json              # Plugin metadata
├── versions.json              # Version compatibility
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript config
├── esbuild.config.mjs         # Build config
├── styles.css                 # Plugin styles (Obsidian CSS vars)
├── main.js                    # Built output (gitignored)
└── src/
    ├── main.ts                # Plugin entry point
    ├── types.ts               # All TypeScript interfaces
    ├── constants.ts           # View type ID, default settings
    ├── settings.ts            # Settings tab UI
    ├── db/
    │   ├── connection-manager.ts    # Connection pool lifecycle
    │   ├── schema-introspection.ts  # Schema/table/column queries
    │   └── query-executor.ts        # Query execution + error handling
    └── views/
        ├── sidebar-view.ts          # Main sidebar (ItemView)
        ├── connection-selector.ts   # Connection dropdown
        ├── schema-tree.ts           # Collapsible schema tree
        ├── query-editor.ts          # SQL textarea + run button
        └── results-table.ts         # Results HTML table
```

## Known limitations and potential issues

### Connection errors

- **SSL/TLS failures**: Many hosted PostgreSQL providers require SSL. The plugin defaults to `ssl: "prefer"` (opportunistic). If your server requires strict SSL or uses a self-signed certificate, you may see connection failures. Per-connection SSL configuration is not yet exposed in the settings UI.
- **Network/firewall issues**: The plugin connects directly from your machine. Corporate firewalls, VPNs, or cloud provider IP allowlists may block the connection.
- **Connection hangs on shutdown**: The `postgres` package's `sql.end()` can occasionally hang if the server disconnects unexpectedly. The plugin uses a 5-second timeout to mitigate this, but in rare cases Obsidian may take a moment to fully unload the plugin.

### Query execution

- **No query timeout enforcement**: The `queryTimeoutSeconds` setting is reserved but not yet wired to `SET statement_timeout`. A long-running query will block the UI until it completes or the connection drops.
- **Large result sets**: Fetching thousands of rows renders them all as HTML table rows, which can slow down the sidebar. The preview row limit helps, but custom queries have no automatic limit.
- **DDL and write queries**: The query editor uses `sql.unsafe()` and will execute any valid SQL including `INSERT`, `UPDATE`, `DELETE`, `DROP`, etc. There is no confirmation prompt or read-only mode.

### Schema introspection

- **Databases with many schemas/tables**: The schema tree loads all schemas and their tables eagerly on connection. Very large databases (hundreds of schemas or thousands of tables) may cause a slow initial load.
- **Columns loaded lazily**: Column details for each table are fetched on first expand, which adds a small delay per table.

### Platform restrictions

- **Desktop only**: Will not install on Obsidian mobile.
- **Sandboxed Linux**: Flatpak/Snap versions of Obsidian may restrict Node.js module access, potentially breaking TCP connections.

### Credential storage

- Connection strings are stored as plaintext JSON in the vault's plugin data directory. There is no secure credential storage API available in Obsidian.

## Next steps

Potential improvements for future development:

1. **Query timeout enforcement** -- prepend `SET statement_timeout = 'Xs'` to user queries or use `AbortController` to cancel long-running requests
2. **SSL configuration UI** -- expose per-connection SSL options (require, reject unauthorized, custom CA) in the settings tab
3. **Result pagination** -- add OFFSET/LIMIT-based paging instead of rendering all rows at once
4. **CodeMirror SQL editor** -- replace the textarea with a CodeMirror 6 editor using `@codemirror/lang-sql` for syntax highlighting and autocompletion (Obsidian bundles CM6 core, but `lang-sql` would need to be bundled separately)
5. **Export results** -- copy as CSV/JSON or insert as a markdown table into the current note
6. **Read-only mode** -- option to restrict the query editor to SELECT-only statements
7. **Connection string from environment** -- allow referencing environment variables instead of hardcoding credentials
8. **Saved queries** -- persist frequently-used queries per connection
9. **Table row count in tree** -- show approximate row counts next to table names using `pg_stat_user_tables`
10. **Chat and video via PostgreSQL** -- a separate plugin concept explored during research, using PostgreSQL LISTEN/NOTIFY for signaling and WebRTC for audio/video (not included in this plugin)
