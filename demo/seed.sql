-- =============================================================================
-- Demo seed data for PostgreSQL Browser for Obsidian
-- Designed to showcase every major UI feature of the plugin.
--
-- Start:  docker compose -f docker-compose.demo.yml up -d
-- Connect: postgresql://demo:demo@localhost:5434/demo
-- Stop:   docker compose -f docker-compose.demo.yml down
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Schema: public
-- ---------------------------------------------------------------------------

-- users: PK, UNIQUE, CHECK, boolean, JSONB, timestamps, defaults, indexes
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    role VARCHAR(20) CHECK (role IN ('admin', 'editor', 'viewer')),
    profile JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_created_at ON users (created_at);

INSERT INTO users (username, email, is_active, role, profile, created_at) VALUES
('alice',      'alice@example.com',      true,  'admin',  '{"bio": "Platform engineer. Coffee enthusiast.", "links": {"github": "github.com/alice", "site": "alice.dev"}}', '2024-11-01 09:00:00+00'),
('bob',        'bob@example.com',        true,  'editor', '{"bio": "Technical writer and occasional coder.", "links": {"github": "github.com/bob"}}', '2024-11-03 14:30:00+00'),
('carol',      'carol@example.com',      true,  'editor', '{"bio": "Full-stack developer", "links": {"github": "github.com/carol", "site": "carol.io"}}', '2024-11-05 11:15:00+00'),
('dave',       'dave@example.com',       false, 'viewer', '{"bio": "Data analyst"}', '2024-11-06 08:45:00+00'),
('eve',        'eve@example.com',        true,  'admin',  '{"bio": "Security researcher", "links": {"github": "github.com/eve", "mastodon": "@eve@infosec.exchange"}}', '2024-11-08 16:20:00+00'),
('frank',      'frank@example.com',      true,  'viewer', NULL, '2024-11-10 10:00:00+00'),
('grace',      'grace@example.com',      NULL,  'editor', '{"bio": "UX designer turned developer"}', '2024-11-12 13:45:00+00'),
('heidi',      'heidi@example.com',      true,  'viewer', '{"bio": "DevOps and cloud infrastructure", "links": {"github": "github.com/heidi"}}', '2024-11-14 09:30:00+00'),
('ivan',       'ivan@example.com',       false, 'viewer', NULL, '2024-11-15 17:00:00+00'),
('judy',       'judy@example.com',       true,  'editor', '{"bio": "Backend engineer, Rust and Go", "links": {"github": "github.com/judy", "site": "judy.codes"}}', '2024-11-18 11:00:00+00'),
('karl',       'karl@example.com',       true,  'viewer', '{"bio": "Student, learning web development"}', '2024-11-20 08:15:00+00'),
('lena',       'lena@example.com',       true,  'editor', '{"bio": "Open source maintainer", "links": {"github": "github.com/lena"}}', '2024-11-22 15:30:00+00'),
('mallory',    'mallory@example.com',    NULL,  'viewer', NULL, '2024-11-25 12:00:00+00'),
('nina',       'nina@example.com',       true,  'admin',  '{"bio": "Engineering manager", "links": {"site": "nina.engineering"}}', '2024-11-28 09:45:00+00'),
('oscar',      'oscar@example.com',      false, 'viewer', '{"bio": "Freelance consultant"}', '2024-12-01 14:00:00+00');


-- posts: FK, nullable columns, TEXT, composite index
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    body TEXT,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_posts_author_published ON posts (author_id, is_published);

INSERT INTO posts (author_id, title, body, is_published, published_at, view_count, created_at) VALUES
(1,  'Getting Started with PostgreSQL',          'PostgreSQL is a powerful open-source relational database. In this post we will walk through installation, basic configuration, and your first queries. Whether you are coming from MySQL or starting fresh, this guide covers the essentials you need to be productive.',                                                   true,  '2024-11-02 10:00:00+00', 342,  '2024-11-01 18:00:00+00'),
(1,  'Understanding JSONB in Postgres',           'JSONB is one of PostgreSQL''s most versatile column types. It stores JSON data in a binary format that supports indexing, containment queries, and path expressions. We will explore GIN indexes, the @> operator, and when to choose JSONB over normalized tables.',                                                   true,  '2024-11-05 09:00:00+00', 218,  '2024-11-04 14:00:00+00'),
(2,  'Writing Better Technical Documentation',    'Good docs start with knowing your audience. This post covers the four types of documentation (tutorials, how-to guides, reference, explanation), common pitfalls, and a template you can adapt for your own projects.',                                                                                                 true,  '2024-11-06 12:00:00+00', 156,  '2024-11-05 20:00:00+00'),
(3,  'React Server Components Explained',         'RSC changes how we think about rendering. This article breaks down the mental model: which components run on the server, which on the client, how data flows between them, and what it means for bundle size.',                                                                                                       true,  '2024-11-08 08:00:00+00', 489,  '2024-11-07 16:00:00+00'),
(3,  'Building a CLI Tool in TypeScript',         'We will build a complete CLI tool from scratch using commander.js and tsx. Topics include argument parsing, interactive prompts, coloured output, and publishing to npm.',                                                                                                                                               true,  '2024-11-10 11:00:00+00', 127,  '2024-11-09 22:00:00+00'),
(5,  'OAuth 2.0 Security Best Practices',         'A deep dive into PKCE, token rotation, and the BFF pattern. We will look at real-world attack vectors and how the latest OAuth 2.1 draft addresses them.',                                                                                                                                                             true,  '2024-11-11 14:00:00+00', 305,  '2024-11-10 10:00:00+00'),
(2,  'Markdown Tips for Developers',              'Markdown is everywhere: README files, documentation sites, note-taking apps. Here are 12 lesser-known tricks including definition lists, task lists in tables, and collapsible sections with <details>.',                                                                                                               true,  '2024-11-13 09:30:00+00', 93,   '2024-11-12 15:00:00+00'),
(10, 'Introduction to Go Concurrency',            'Goroutines and channels make concurrent programming approachable. This post walks through the basics with practical examples: fan-out/fan-in, worker pools, and context cancellation.',                                                                                                                                true,  '2024-11-15 10:00:00+00', 271,  '2024-11-14 20:00:00+00'),
(1,  'PostgreSQL Index Types Compared',           'B-tree, GIN, GiST, BRIN, and hash: when to use each index type. We benchmark a 10M row table and show the query planner differences.',                                                                                                                                                                                 true,  '2024-11-17 08:00:00+00', 198,  '2024-11-16 14:00:00+00'),
(12, 'Contributing to Open Source',               'Your first open source contribution can be intimidating. This guide covers finding good-first-issue labels, fork-and-PR workflow, writing good commit messages, and responding to code review feedback.',                                                                                                               true,  '2024-11-19 12:00:00+00', 164,  '2024-11-18 18:00:00+00'),
(4,  'Data Visualization with Observable Plot',   NULL,                                                                                                                                                                                                                                                                                                                    false, NULL,                          0,    '2024-11-20 09:00:00+00'),
(3,  'CSS Container Queries in Practice',         'Container queries let components respond to their parent''s size instead of the viewport. We will build three real-world examples and discuss browser support.',                                                                                                                                                         true,  '2024-11-21 15:00:00+00', 87,   '2024-11-20 22:00:00+00'),
(5,  'Threat Modeling for Web Applications',      'A practical walkthrough of STRIDE threat modeling applied to a typical SaaS application. Includes a worksheet template and examples for each threat category.',                                                                                                                                                          true,  '2024-11-23 10:00:00+00', 142,  '2024-11-22 16:00:00+00'),
(10, 'Error Handling Patterns in Rust',           'Rust''s Result and Option types enforce error handling at compile time. We compare anyhow vs thiserror, the ? operator, and custom error enums for library vs application code.',                                                                                                                                        true,  '2024-11-25 08:30:00+00', 233,  '2024-11-24 14:00:00+00'),
(8,  'Terraform State Management',                'Remote state, workspaces, and state locking explained. Plus: how to recover from a corrupted state file without losing your infrastructure.',                                                                                                                                                                            true,  '2024-11-26 11:00:00+00', 176,  '2024-11-25 20:00:00+00'),
(7,  'Design Systems for Small Teams',            NULL,                                                                                                                                                                                                                                                                                                                    false, NULL,                          0,    '2024-11-27 13:00:00+00'),
(14, 'Running Effective Code Reviews',            'Code review is about more than catching bugs. This post covers setting expectations, writing actionable feedback, handling disagreements, and keeping review turnaround under 24 hours.',                                                                                                                                true,  '2024-11-28 09:00:00+00', 118,  '2024-11-27 18:00:00+00'),
(12, 'Git Workflows Compared',                    'Trunk-based, Gitflow, GitHub flow, and ship/show/ask. We compare each workflow''s tradeoffs for team size, release cadence, and CI/CD integration.',                                                                                                                                                                     true,  '2024-11-30 10:00:00+00', 205,  '2024-11-29 16:00:00+00'),
(1,  'Window Functions in SQL',                   'ROW_NUMBER, RANK, LAG, LEAD, and running totals. This tutorial uses a real dataset to demonstrate each window function with before/after result sets.',                                                                                                                                                                  true,  '2024-12-01 08:00:00+00', 167,  '2024-11-30 22:00:00+00'),
(6,  'My Notes on Learning SQL',                  NULL,                                                                                                                                                                                                                                                                                                                    false, NULL,                          0,    '2024-12-02 09:00:00+00'),
(3,  'Deploying to Fly.io with Docker',           'A step-by-step guide to deploying a Node.js app on Fly.io: Dockerfile, fly.toml, secrets, volumes, and multi-region setup.',                                                                                                                                                                                            true,  '2024-12-03 11:00:00+00', 94,   '2024-12-02 20:00:00+00'),
(5,  'API Rate Limiting Strategies',              'Token bucket, sliding window, and leaky bucket algorithms explained with Redis implementations. Includes a comparison table and guidance on choosing the right strategy for your API.',                                                                                                                                   true,  '2024-12-04 14:00:00+00', 188,  '2024-12-03 18:00:00+00'),
(10, 'Building a REST API in Go',                 'Using the standard library''s net/http with Go 1.22 routing enhancements. No frameworks needed. Covers middleware, structured logging with slog, and graceful shutdown.',                                                                                                                                                true,  '2024-12-05 09:00:00+00', 156,  '2024-12-04 15:00:00+00'),
(14, 'One-on-One Meeting Templates',              'Five meeting templates for engineering managers: career growth, project check-in, feedback session, skip-level, and new hire onboarding.',                                                                                                                                                                               true,  '2024-12-06 10:00:00+00', 82,   '2024-12-05 21:00:00+00'),
(2,  'API Documentation with OpenAPI',            'Writing OpenAPI 3.1 specs by hand, generating them from code, and publishing interactive docs with Redocly. Includes tips for keeping specs in sync with your implementation.',                                                                                                                                          true,  '2024-12-07 12:00:00+00', 134,  '2024-12-06 18:00:00+00'),
(8,  'Kubernetes Networking Basics',              NULL,                                                                                                                                                                                                                                                                                                                    false, NULL,                          0,    '2024-12-08 14:00:00+00'),
(11, 'Learning SQL Joins',                        'INNER, LEFT, RIGHT, FULL OUTER, and CROSS joins explained with Venn diagrams and runnable examples. Plus: when to use a subquery instead.',                                                                                                                                                                              true,  '2024-12-09 08:00:00+00', 312,  '2024-12-08 20:00:00+00'),
(12, 'Automating Releases with GitHub Actions',   'A CI/CD pipeline that runs tests, builds artifacts, creates a GitHub release, and publishes to npm. Uses reusable workflows and environment protection rules.',                                                                                                                                                         true,  '2024-12-10 10:00:00+00', 149,  '2024-12-09 16:00:00+00'),
(3,  'State Management in 2025',                  'Comparing Zustand, Jotai, Redux Toolkit, and the built-in React context. Each has its sweet spot; this post helps you choose based on your app''s complexity and team preferences.',                                                                                                                                     true,  '2024-12-11 09:00:00+00', 267,  '2024-12-10 22:00:00+00'),
(9,  'Setting Up a Home Lab',                     NULL,                                                                                                                                                                                                                                                                                                                    false, NULL,                          0,    '2024-12-12 11:00:00+00');


-- tags + post_tags: junction table, composite PK
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
);

INSERT INTO tags (name) VALUES
('postgresql'),
('javascript'),
('typescript'),
('devops'),
('security'),
('career'),
('css'),
('rust');

CREATE TABLE post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (post_id, tag_id)
);

INSERT INTO post_tags (post_id, tag_id) VALUES
-- Getting Started with PostgreSQL -> postgresql
(1, 1),
-- Understanding JSONB -> postgresql
(2, 1),
-- Writing Better Technical Documentation -> career
(3, 6),
-- React Server Components -> javascript, typescript
(4, 2), (4, 3),
-- Building a CLI Tool in TypeScript -> typescript
(5, 3),
-- OAuth 2.0 Security -> security
(6, 5),
-- Markdown Tips -> career
(7, 6),
-- Introduction to Go Concurrency (no tag — shows variety)
-- PostgreSQL Index Types -> postgresql
(9, 1),
-- Contributing to Open Source -> career
(10, 6),
-- CSS Container Queries -> css
(12, 7),
-- Threat Modeling -> security
(13, 5),
-- Error Handling in Rust -> rust
(14, 8),
-- Terraform State Management -> devops
(15, 4),
-- Running Effective Code Reviews -> career
(17, 6),
-- Git Workflows -> devops
(18, 4),
-- Window Functions in SQL -> postgresql
(19, 1),
-- Deploying to Fly.io -> devops, typescript
(21, 4), (21, 3),
-- API Rate Limiting -> security
(22, 5),
-- Building a REST API in Go (no extra tags)
-- API Documentation with OpenAPI -> typescript
(25, 3),
-- Learning SQL Joins -> postgresql
(27, 1),
-- Automating Releases with GitHub Actions -> devops
(28, 4),
-- State Management in 2025 -> javascript, typescript
(29, 2), (29, 3),
-- One-on-One Meeting Templates -> career
(24, 6);


-- ---------------------------------------------------------------------------
-- Schema: analytics
-- ---------------------------------------------------------------------------

CREATE SCHEMA analytics;

-- page_views: BIGSERIAL, NUMERIC, cross-schema FK, ~200 rows
CREATE TABLE analytics.page_views (
    id BIGSERIAL PRIMARY KEY,
    path VARCHAR(500) NOT NULL,
    user_id INTEGER REFERENCES public.users(id),
    duration_ms NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Generate ~200 page view rows with varied data
INSERT INTO analytics.page_views (path, user_id, duration_ms, created_at)
SELECT
    paths.path,
    CASE WHEN random() < 0.3 THEN NULL ELSE (floor(random() * 15) + 1)::int END,
    round((random() * 45000 + 500)::numeric, 2),
    '2024-11-01'::timestamptz + (random() * 40)::int * interval '1 day'
                                + (random() * 86400) * interval '1 second'
FROM (
    SELECT unnest(ARRAY[
        '/blog/getting-started-with-postgresql',
        '/blog/understanding-jsonb',
        '/blog/react-server-components',
        '/blog/building-cli-typescript',
        '/blog/oauth-security-best-practices',
        '/blog/go-concurrency',
        '/blog/postgresql-index-types',
        '/blog/contributing-open-source',
        '/blog/css-container-queries',
        '/blog/error-handling-rust',
        '/blog/terraform-state',
        '/blog/git-workflows',
        '/blog/window-functions-sql',
        '/blog/deploying-fly-io',
        '/blog/api-rate-limiting',
        '/blog/rest-api-go',
        '/blog/sql-joins',
        '/blog/github-actions-releases',
        '/blog/state-management-2025',
        '/about'
    ]) AS path
) paths
CROSS JOIN generate_series(1, 10) AS s(i)
ORDER BY random();


-- Enum type + tasks table
CREATE TYPE analytics.task_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE analytics.tasks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status analytics.task_status DEFAULT 'pending',
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO analytics.tasks (name, status, result, created_at) VALUES
('Import November blog posts',   'completed', '{"imported": 12, "skipped": 0}',                          '2024-11-01 06:00:00+00'),
('Generate sitemap',             'completed', '{"pages": 34, "size_kb": 8.2}',                           '2024-11-02 06:00:00+00'),
('Send weekly newsletter',       'completed', '{"recipients": 482, "bounced": 3}',                       '2024-11-08 09:00:00+00'),
('Rebuild search index',         'completed', '{"documents": 1580, "duration_s": 14.3}',                 '2024-11-10 03:00:00+00'),
('Resize uploaded images',       'failed',    '{"error": "Out of memory processing large-banner.png"}',  '2024-11-12 04:30:00+00'),
('Sync analytics to warehouse',  'completed', '{"rows_synced": 9421}',                                   '2024-11-15 05:00:00+00'),
('Export user report',           'running',   NULL,                                                       '2024-12-10 08:00:00+00'),
('Purge expired sessions',       'completed', '{"deleted": 217}',                                        '2024-11-20 02:00:00+00'),
('Validate RSS feed',            'pending',   NULL,                                                       '2024-12-11 10:00:00+00'),
('Compress old backups',         'pending',   NULL,                                                       '2024-12-12 06:00:00+00');


-- View: daily_summary (shows as view icon in schema tree)
CREATE VIEW analytics.daily_summary AS
SELECT
    date_trunc('day', created_at)::date AS day,
    COUNT(*)                             AS total_views,
    COUNT(DISTINCT user_id)              AS unique_visitors,
    round(AVG(duration_ms)::numeric, 0)  AS avg_duration_ms
FROM analytics.page_views
GROUP BY 1
ORDER BY 1 DESC;
