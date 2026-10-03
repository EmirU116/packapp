# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

PackApp (a.k.a. "Parcel Package App") is a goods-reception app for registering incoming packages and printing sticker labels. The repository is **pre-implementation**: it contains only [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) (the product brief – the source of truth), [README.md](README.md) and the workflow diagram `image.png`. There is no code, build system, linter or test runner yet, so there are no commands to list. When the scaffold is added, record the build / lint / test / single-test commands here.

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before planning any feature.

## Planned stack

- Frontend: TypeScript
- Backend: Python with FastAPI
- Database: local (MVP only)
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
- Web research is allowed for system and architecture design. Adding or creating skills for repeated actions is allowed, as are subagents and parallel agent teams when they make sense for a local project (no production-oriented agents).
- Token efficiency: agent-to-agent messages should be terse, with no filler; reports and summaries to the user are written in normal, clear language.
- Model choice: Haiku for quick lookups and reformatting, Sonnet as the everyday default, Opus for tangled architecture or multi-step agentic work, Fable only for the hardest problems.
