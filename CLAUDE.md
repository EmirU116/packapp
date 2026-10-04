# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

PackApp (a.k.a. "Parcel Package App") is a goods-reception app for registering incoming packages and printing sticker labels. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) is the product brief and the source of truth – read it before planning any feature.

The MVP is being built in steps, one PR each. Done so far: backend scaffold with login and dynamic RBAC; package CRUD, search, tracking lookup and the notification outbox; label and list PDFs. Still to come: the frontend. Update this list as steps land.

## Commands

Run from `backend/` (PowerShell). The virtualenv is `backend/.venv`.

- Install: `python -m venv .venv; .venv\Scripts\python -m pip install -r requirements.txt`
- Run API: `.venv\Scripts\python -m uvicorn app.main:app --reload` (http://localhost:8000, API page at `/docs`)
- All tests: `.venv\Scripts\python -m pytest`
- Single test: `.venv\Scripts\python -m pytest tests/test_auth.py::test_logout_ends_session`

There is no linter configured and no frontend yet.

## Backend architecture

- `app/main.py` wires routers and, on startup, creates tables and runs `app/seed.py` (default permissions, roles, demo users – idempotent, never overwrites admin changes).
- Layers: `routers/` (HTTP only) → `services/` (logic) → `models/` (SQLAlchemy) with `schemas/` (Pydantic) for request/response shapes.
- Auth: JWT in an HttpOnly cookie; `services/auth.get_current_user` reloads the user from the DB on every request.
- RBAC: endpoints are gated with `Depends(require_permission(CODE))` from `services/permissions.py`. Permissions per role live in the DB, so admin changes apply on the next request. Any change to roles/users must call `ensure_rbac_manager_remains(db)` before commit.
- Packages: single and multi register both go through `services/packages.create_packages` (one shared set of details, one package per tracking number; empty number → generated). `tracking_number` is intentionally not unique. Package timestamps are local time (`models/package.local_now`), unlike `User.created_at` (UTC).
- Field constraints live once in `schemas/package.py` as annotated types shared by create and update; dropdown choices come from the enums in `models/package.py` via `GET /api/packages/options`.
- Tracking auto-fill: `services/tracking.lookup_tracking` merges sources in order pattern → parcelsapp (only if `PARCELSAPP_API_KEY` is set; unverified against the live API) → history.
- PDFs: `services/labels.py` (ReportLab). The label is a stack of fixed boxes (`_ROWS`); all text goes through `fit_text` / `wrap_text` so fields can never overlap – keep that invariant when adding fields. Code128 falls back to QR for long or non-ASCII numbers. `GET /api/labels?ids=..&output=labels|summary|list` serves all three outputs. When changing the layout, render a PDF and look at it; tests only check content and sizes.
- Email: `services/notifications.py` writes to a local outbox table; nothing is sent.
- Tests (`tests/conftest.py`) override `get_db` with a seeded in-memory SQLite DB; use the `login("chief")` fixture to get a client logged in as a demo user. The app's `lifespan` does not run in tests.

## Stack

- Frontend: TypeScript (React + Vite, planned)
- Backend: Python with FastAPI, SQLAlchemy, SQLite file at `backend/data/packapp.db`
- Verification is done through a locally served web app; the product goals are **simplification** and **automation** of a slow, manual workflow.

## Core workflow (drives the architecture)

1. Scan the package barcode.
2. The system auto-fills as many registration fields as it can from the tracking number, using Parcelsapp.com.
3. If something is wrong or missing, the user edits manually; otherwise go straight to step 4.
4. Save the package, generate a PDF and print it on a sticker label.

Manual registration must always remain possible as the fallback when automation fails.

## Domain rules that are easy to miss

- **Package fields**: `id`, `tracking_number`, `carrier`, `package_type`, `sender`, `recipient`, `institute`, `route`, `su_number`, `email`, `room_number`, `extra_information`, `status`, `created_at`, `updated_at`, `created_by`.
- `carrier` is who drove the package; `sender` ("From") is the company that sent it. Search by company means `sender`, not `carrier`.
- `package_type`: cold, parcel, frozen, multiple temperatures, REK letter, pallet, EXT.
- `route`: ABC, DEF, MBW, Arrenhius, Biblotek.
- `email`: a notification is sent only when the email option is checked.
- `extra_information` needs a length limit so it cannot overflow into other fields on the label.
- No tracking number on the package → the system generates one.
- No recipient name → the institute is used as the delivery target.
- **Label**: scannable tracking number, from, to, package type, extra information, room number. Fields must be laid out so they never overlap.
- **Single register** prints exactly one label. **Multi register** uses the same fields but offers three outputs: a paper list of all packages, one label per package, or one label showing the number of packages on the tracking number.
- **Search** must be fast: by recipient name, sender company, tracking number, with date filtering.
- **Roles (RBAC)**: Chief – register/update/delete plus dynamic local RBAC management; Employee – register/update/delete; Intern – register/update only (no delete).

## Working rules (from the project brief)

- Use plan mode to plan tasks.
- When implementing a feature, also write documentation for it.
- Code should be reusable, scalable and modular. Document large or complex functions/methods with a docstring; use inline comments for small pieces such as loops and conditionals.
- Do **not** change the project structure without checking with the user first.
- Do **not** work on anything unrelated to the current task.
- Do **not** open a PR without tests that have been written and are passing.
- **Commits and PRs**:
  - Never commit or push directly to `main`. Each piece of work goes on its own branch (`feature/<short-name>`, or `chore/<short-name>` for non-feature work).
  - Commit regularly in small, logical steps with clear messages, so the history is easy to follow.
  - When a piece of work is finished and its tests pass, push the branch and open a PR to `main` (`EmirU116/packapp`) with a summary of what changed and how to test it.
  - **Only the user approves and merges PRs.** Never merge a PR, and wait for the user's approval of a PR before starting work that builds on it.
  - After opening a PR, use the `wait-for-merge` skill (`.claude/skills/wait-for-merge/`) so work continues automatically once the user merges.
- Web research is allowed for system and architecture design. Adding or creating skills for repeated actions is allowed, as are subagents and parallel agent teams when they make sense for a local project (no production-oriented agents).
- Token efficiency: agent-to-agent messages should be terse, with no filler; reports and summaries to the user are written in normal, clear language.
- Model choice: Haiku for quick lookups and reformatting, Sonnet as the everyday default, Opus for tangled architecture or multi-step agentic work, Fable only for the hardest problems.
