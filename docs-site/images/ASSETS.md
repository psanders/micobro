# Docs assets registry

Every image used by a page under `docs-site/` gets a row here. The point is traceability: when
a screen changes, this file tells you which screenshots went stale and where they came from.

Written in English (internal build doc), unlike the `.mdx` pages themselves. See
`docs-site/CLAUDE.md` for the editorial policy that governs what may appear in an asset.

## Rules

- **No real data.** No real customer names, phone numbers, cédulas, addresses, or Google
  accounts in any screenshot. Use the same fake-but-Dominican examples the docs use
  (`Ramona Peña`, `809-555-0134`).
- **No internals.** A diagram that names SQLite, the push queue, OAuth, or any file in the
  repo does not belong in these docs. Draw what the lender sees.
- **Store next to the page.** `images/<page-slug>/<name>.png`, e.g.
  `images/guias/cobros/tipo-de-cobro.png`.
- **Screenshots come from the real app**, not from mockups, so what the reader sees on their
  phone matches the page.
- **Re-register on replacement.** Update the row's "Captured" date when you retake an asset.

## Registry

| File | Used by | Source | Captured |
| --- | --- | --- | --- |
| `logo/light.svg` | `docs.json` (light theme) | Hand-built from `site/src/components/Logo.tsx` | 2026-08-05 |
| `logo/dark.svg` | `docs.json` (dark theme) | Hand-built from `site/src/components/Logo.tsx` | 2026-08-05 |
| `favicon.svg` | `docs.json` | Copied from `site/public/favicon.svg` | 2026-08-05 |

No page screenshots yet. The guides currently describe the screens in words; add screenshots
per page as they are captured, and register each one above.
