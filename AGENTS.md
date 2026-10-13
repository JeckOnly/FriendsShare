# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

# ReaderWeb Product Scope

The user wants a small friends' life-thoughts sharing MVP. Follow SPEC.md v0.2: two pages, plain-text posts, shared tags/activity heatmap, and nested comments. Do not add likes, bookmarks, notifications, follows, profiles, full-text search, or moderation features by default.

Use docs/references/flomo-layout.png for the quiet two-column layout and docs/references/reddit-comment-tree.png for reply indentation and connector lines. The UI working name is 随记. Preserve shared server persistence and author ownership; browser storage is only for drafts/reading state.

Current work is local-only. Start the local service and verify it in the in-app browser. Do not register or deploy a Site without a subsequent user request. The preserved static template Worker is not the local API; future hosting needs a verified dynamic API, D1, and hosted identity adapter.
