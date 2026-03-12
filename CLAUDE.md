# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian plugin (desktop-only) that provides a sidebar UI for browsing PostgreSQL databases. Uses the `postgres` npm package (porsager/postgres) for direct TCP/TLS connections via Obsidian's Electron runtime — no middleware server needed. Desktop-only because Obsidian mobile lacks Node.js `net`/`tls` modules.

## Build Commands

```bash
npm run dev       # esbuild watch mode (dev with inline sourcemaps)
npm run build     # TypeScript type check + esbuild production bundle
npm run deploy    # build + copy main.js, manifest.json, styles.css to vault (reads VAULT_PLUGIN_DIR from .env)
```

Output: `main.js` (CommonJS bundle), `manifest.json`, `styles.css`. No test suite or linter is configured.

## Architecture

Three layers with clear separation:

**Plugin core** (`src/main.ts`, `src/settings.ts`, `src/types.ts`, `src/constants.ts`): Plugin lifecycle, settings tab with connection CRUD, shared TypeScript interfaces, and constants.

**Database layer** (`src/db/`):
- `connection-manager.ts` — Connection pool lifecycle (3 concurrent connections, 300s idle timeout), SSL/TLS config, schema list extraction
- `schema-introspection.ts` — `information_schema` queries for schemas, tables, columns, constraints, indexes, FK relationships
- `query-executor.ts` — Query execution via `sql.unsafe()`, table preview, inline cell updates, row deletion, error normalization

**View layer** (`src/views/`): 11 UI components. `database-view.ts` is the main orchestrator (an Obsidian `ItemView`). Key components: `toolbar.ts` (connection selector + mode tabs), `schema-tree.ts` (collapsible tree), `query-editor.ts` (textarea with Ctrl+Enter), `results-table.ts` (HTML table with inline editing and pending changes tracking), `cell-editor.ts` (modal-like inline editors for different column types).

**Data flow**: User selects connection → ConnectionManager establishes pool → Schema tree loads hierarchy → User clicks table (Data tab) or writes SQL (Query tab) → Results render in results table.

## Build Configuration

- Entry point: `src/main.ts`
- esbuild bundles everything into single `main.js` (CommonJS)
- `obsidian` module + all CodeMirror modules + Node.js builtins are marked as externals (resolved at runtime by Electron)
- Target: ES2018
- TypeScript strict mode enabled (`noImplicitAny`, `strictNullChecks`, `isolatedModules`)

## Key Conventions

- All TypeScript interfaces live in `src/types.ts`
- Constants and defaults in `src/constants.ts`
- UI uses Obsidian CSS variables for theming (no external CSS framework)
- Connection strings encrypted via OS keychain using `src/secret-storage.ts` (Obsidian v1.11.4+); falls back to plaintext in `data.json` on older versions
- The plugin's view type ID is defined in `constants.ts` as `VIEW_TYPE_POSTGRES`
