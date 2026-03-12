# Screenshot Guide

How to capture screenshots for the README using the demo database.

## Setup

```bash
# Start the demo database
docker compose -f docker-compose.demo.yml up -d

# Verify it's running
psql postgresql://demo:demo@localhost:5434/demo -c '\dt public.*'
```

### Connection string

```
postgresql://demo:demo@localhost:5434/demo
```

Add this as a connection in **Settings > PostgreSQL Browser** with the name "Demo".

## Screenshots to take

Save all screenshots into `demo/screenshots/`.

### 1. Hero — Schema tree + Table Data (`hero.jpg`)

This is the most important screenshot. It goes right after the Features section in the README.

1. Connect to the Demo connection
2. Expand the `public` schema in the tree
3. Expand the `users` table node to show columns with PK badge and types
4. Click the `users` table so its data loads in the **Table Data** tab
5. Resize the sidebar to ~280px wide for good proportions

**Shows**: toolbar with connection selector and tabs, schema tree with hierarchy, data table with column types in headers, NULL values (italic/gray), boolean values, JSONB cells.

### 2. Inline editing (`inline-editing.jpg`)

1. In the `users` table data view, double-click a boolean cell (`is_active`) to open the dropdown editor
2. Edit 2-3 cells so the pending changes bar appears ("3 unsaved changes -- Save / Discard")
3. Pending cells should have yellow highlight

**Shows**: type-aware cell editors, pending changes tracking with save/discard bar.

### 3. Schema detail view (`schema-detail.jpg`)

1. Switch to the **Schema** tab in the toolbar
2. Click the `posts` table in the tree
3. Scroll to show columns with types/nullable/defaults, the FK constraint on `author_id`, and the composite index

**Shows**: columns table, constraints section (PK, FK, CHECK), indexes section, estimated row count.

### 4. SQL Query mode (`query-mode.jpg`)

1. Switch to the **SQL Query** tab
2. Type this query:
   ```sql
   SELECT u.username, COUNT(p.id) as post_count
   FROM public.users u
   LEFT JOIN public.posts p ON p.author_id = u.id
   GROUP BY u.username
   ORDER BY post_count DESC;
   ```
3. Run it with Ctrl+Enter
4. Capture the editor and results table, including the status bar showing row count and duration

**Shows**: SQL editor, results table with sticky headers, query duration and row count.

### 5. Multiple schemas in tree (`schemas-tree.jpg`, optional)

Can be combined with screenshot #1 instead of a separate image.

1. Collapse all column nodes
2. Show both `public (4)` and `analytics (3)` schemas expanded in the tree
3. Note the view icon (eye) on `daily_summary`

**Shows**: multi-schema support, view vs table distinction.

### 6. Settings page (`settings.jpg`)

1. Open **Settings > PostgreSQL Browser**
2. Show the connection form with the masked password field and Test Connection button

**Shows**: connection management UI, masked credentials, test button.

## Tips for good screenshots

- Use a **dark Obsidian theme** (most users use dark mode)
- **Crop** to just the plugin sidebar/panel, not the full Obsidian window (unless showing popout)
- Aim for **~800px wide** screenshots
- Make sure the demo data is visible (scroll to top of results)
- PNG format, no compression artifacts

## Where screenshots go in the README

```markdown
## Features
...bullet list...

![PostgreSQL Browser sidebar showing schema tree and table data](demo/screenshots/hero.jpg)

## Usage
...

### Table Data tab
...
![Inline cell editing with pending changes](demo/screenshots/inline-editing.jpg)

### SQL Query tab
...
![SQL query results](demo/screenshots/query-mode.jpg)

### Schema tab
...
![Schema detail view showing columns, constraints, and indexes](demo/screenshots/schema-detail.jpg)
```

The settings screenshot (`settings.jpg`) can optionally go in the Configuration section.

## Teardown

```bash
docker compose -f docker-compose.demo.yml down
```
