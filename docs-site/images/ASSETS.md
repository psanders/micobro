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

| File                               | Used by                   | Source                                                             | Captured   |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------ | ---------- |
| `logo/light.svg`                   | `docs.json` (light theme) | Hand-built from `site/src/components/Logo.tsx`                     | 2026-08-05 |
| `logo/dark.svg`                    | `docs.json` (dark theme)  | Hand-built from `site/src/components/Logo.tsx`                     | 2026-08-05 |
| `favicon.svg`                      | `docs.json`               | Copied from `site/public/favicon.svg`                              | 2026-08-05 |
| `guias/cobros/tipo-de-cobro.png`   | `guias/cobros`            | `pencil.pen` → `07 Cobrar Pago` (`qoaNg`), exported 2×             | 2026-08-06 |
| `guias/cobros/credito-abierto.png` | `guias/cobros`            | `pencil.pen` → `07c Cobrar Crédito Abierto` (`gH1rr`), exported 2× | 2026-08-06 |
| `guias/cobros/recibo.png`          | `guias/cobros`            | `pencil.pen` → `12 Recibo de Pago` (`htxyb`), exported 2×          | 2026-08-06 |

## Screenshots come from Pencil, and Pencil can go stale

App screenshots are exported from `pencil.pen`, not captured from a running build. That is
faster, and it keeps the docs visually consistent, but it has one failure mode you must guard
against: **a Pencil screen can drift from what the app actually ships.**

This is not hypothetical. When `guias/cobros` was illustrated, `07 Cobrar Pago` still showed
`Cobrar atrasos` and `Cobrar cuotas múltiples` — options that no longer exist — and was
missing `Solo mora`. The design was corrected before export.

So, before exporting any app screen:

1. Read the corresponding screen component under `components/screens/`.
2. Compare every visible label against the design, including the order options appear in.
3. Fix the Pencil frame if they disagree. The app is the source of truth, never the design.

`pencil.pen` edits made through the MCP live in memory until someone saves the file, so a
design correction is not durable until it is saved and committed.
