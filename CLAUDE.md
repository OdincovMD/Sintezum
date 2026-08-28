# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Синтезум** — платформа университетского технологического предпринимательства. Соединяет студентов, исследователей и лаборатории.

Stack: FastAPI + SQLAlchemy (async) + PostgreSQL + Elasticsearch + MinIO (S3) на бэкенде; React + Vite на фронтенде. Nginx как reverse proxy.

---

## Commands

### Docker (recommended)

```bash
# Full stack
docker compose up --build

# Infrastructure only (then run backend/frontend locally)
docker compose up -d postgres elasticsearch minio
```

### Backend (local)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (local)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build
```

### Linting

```bash
cd backend
ruff check .
ruff format .
```

### Database reset

```bash
# Destroys all volumes (postgres_data, elasticsearch_data, minio_data)
docker compose down -v
docker compose up
```

### Elasticsearch manual reindex

```bash
# Delete index; backend will repopulate on next startup
curl -X DELETE "http://localhost:9200/organizations"
curl -X DELETE "http://localhost:9200/laboratories"
curl -X DELETE "http://localhost:9200/vacancies"
curl -X DELETE "http://localhost:9200/queries"
curl -X DELETE "http://localhost:9200/applicants"
```

### Health check

```bash
curl http://localhost:8000/health
```

---

## Architecture

### Request flow

```
Browser → Nginx → /       → Frontend (React SPA)
                → /api/   → Backend (FastAPI)
                → /labportal/ → MinIO (media files)
```

Swagger/ReDoc/OpenAPI are disabled (`docs_url=None`). See `docs/` for API documentation.

### Backend structure (`backend/app/`)

| Path | Purpose |
|------|---------|
| `main.py` | App entry point, router registration, startup hooks |
| `bootstrap.py` | `create_tables`, `seed_roles`, `ensure_storage`, `ensure_elasticsearch_indexes` |
| `core/` | User/Role models, auth, users, roles API |
| `api/` | Public routes: home, search, profile, storage, analytics, admin |
| `roles/student/` | Student-specific models, queries, profile API |
| `roles/researcher/` | Researcher-specific models, queries, profile API |
| `roles/representative/` | Lab/org management, vacancies, queries, employees, equipment, tasks |
| `services/elasticsearch/` | Index management, search, reindex functions |
| `storage/s3.py` | MinIO/S3 client |
| `jobs/` | APScheduler cron jobs (OpenAlex sync at 03:00 UTC, subscription expiry at 04:00 UTC) |
| `queries/orm.py` | Composite `Orm` class combining Core + Student + Researcher + Representative |
| `middleware/` | `StorageUrlRewriteMiddleware` — rewrites MinIO URLs for public access |

**No Alembic migrations.** Schema is created via `Base.metadata.create_all` on startup. All models are imported through `app/models.py` before `create_all` is called.

### ORM pattern

All DB access goes through a single composite `Orm` class (`app/queries/orm.py`). It inherits from role-specific Orm classes, each living in `roles/<role>/queries/orm.py`.

### Authentication

- JWT HS256 with `sub` (user_id), `exp`, and `v` (token_version)
- `token_version` on the User model — incrementing it invalidates all existing tokens (used on password change / account block)
- FastAPI deps: `get_current_user` (raises 401 if missing), `get_current_user_optional` (returns None)
- Frontend stores `{ token, user }` in `localStorage` under key `labconnect_auth`
- ORCID OAuth flow: redirect → callback → JWT (or complete registration with email+role)

### Elasticsearch

Dual-write pattern: PostgreSQL is the source of truth; ES stores only fields needed for search/sort. On catalog endpoints, IDs are fetched from ES then full objects are loaded from PG in the same order.

Indexes are created and populated from PG on startup if empty (`reindex_*_if_empty`). On entity changes, call `reindex_*_by_ids`.

Catalogs use two-block ranking: paid_active entities first (by rank_score), then free (by rank_score). Rank factors: quality, freshness, performance, longevity.

### Frontend structure (`frontend/src/`)

| Path | Purpose |
|------|---------|
| `api/client.js` | `apiRequest` wrapper — attaches JWT, handles 401 logout, normalizes error messages to Russian |
| `auth/AuthContext.jsx` | Auth state, login/register/logout, stored in `localStorage` |
| `hooks/use*Search.js` | Per-catalog search hooks (labs, vacancies, queries, orgs, applicants) |
| `pages/profile/` | Profile sections per role + employer dashboard |
| `pages/profile/org/` | Tabs for org profile (equipment, vacancies, queries, tasks) |
| `components/ui/` | Base UI primitives (Button, Card, Input, Badge, Drawer) |

Vite proxies `/api` → `http://localhost:8000` in dev. `BACKEND_URL` env var sets API base for production builds.

### Roles

| Role | Profile type | Access |
|------|-------------|--------|
| `student` | Student | Job search, applications |
| `researcher` | Researcher | Same + lab join requests |
| `lab_representative` | Employee | Standalone labs, vacancies, queries |
| `lab_admin` | Employee | Organization + labs, employees, full management |
| `platform_admin` | — | Admin panel: users, subscriptions, moderation |

### Environment variables

Required minimum for local dev (without ORCID/email): `JWT_SECRET` + DB/ES/MinIO connection vars. See `docs/development.md` for the full table.

Key vars:
- `ENV`: `development` | `production` (development auto-adds `localhost:5173` to CORS)
- `S3_PUBLIC_BASE_URL`: public URL for media rewriting via `StorageUrlRewriteMiddleware`
- `FRONTEND_URL`: used in email links and OAuth redirects
- `CORS_ORIGINS`: comma-separated allowed origins

### Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 on /api | Check JWT, inspect `localStorage.labconnect_auth` |
| Empty catalogs | Wait ~1 min for ES indexing on first startup |
| MinIO 403 | Check `S3_ACCESS_KEY`, `S3_SECRET_KEY`, bucket `labportal` |
| ES connection refused | `curl localhost:9200` to verify ES is up |

---

## Frontend Development Rules

### Identity

Expert Frontend Developer и UI/UX Designer. Задача — итеративно модернизировать фронтенд научного портала (маркетплейс для учёных, лабораторий и организаций) в стиле современных площадок типа hh.ru, Airbnb, LinkedIn.

### UI/UX Principles

1. **Clean & Minimalist** — generous whitespace, clear typography, subtle borders/shadows, no visual clutter.
2. **Content First** — scientific data must be highly readable; logical typographic hierarchy (H1 → H2 → body → muted meta).
3. **Search & Filters are core** — prominent, sticky where appropriate, instantly responsive, synced to URL params.
4. **Card-Based Design** — standardized cards for Labs/Vacancies/Orgs with badges ("Premium", "Hot"), metadata, clear CTAs.
5. **Consistency** — single design system; no inventing new button/input styles per page.
6. **Responsive / Mobile-first** — filters collapse into drawers/modals on mobile.

### Architecture Rules

- **Component-driven**: extract repeated UI into `components/ui/` (Button, Input, Select, Card, Badge, Pagination).
- **Reusability first**: before creating a new component, check if an existing one can be adapted via props.
- **State**: UI state (modals, filters) separate from server state; filters/search in URL params for shareable links.
- **Clean code**: semantic HTML, self-explanatory names, small single-responsibility components.
- **JS only** (no TypeScript) — project uses plain JS + JSX throughout.

### Workflow for Page Rewrites

1. **Analyze** — review existing code: logic, API calls, data structures.
2. **Plan** — outline new layout, identify shared components to create/reuse.
3. **Draft UI** — structure with existing data hooks, modern styling.
4. **Integrate Logic** — connect search/filters/pagination synced to URL params.
5. **Refine** — hover states, loading skeletons, empty states, error handling.

Briefly explain thought process before large code blocks. If a global component is needed to make a page work, create it and note it.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **startup** (3005 symbols, 8216 relationships, 248 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/startup/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/startup/context` | Codebase overview, check index freshness |
| `gitnexus://repo/startup/clusters` | All functional areas |
| `gitnexus://repo/startup/processes` | All execution flows |
| `gitnexus://repo/startup/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
