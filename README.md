# NivaasBhoomi

Pan-India property listing portal. Buyers find property and contact dealers
directly on WhatsApp; dealers list property and receive exclusive leads.

**Phase 0 (this repo): project foundation + design system.** See
[`DEV-SPEC.txt`](./DEV-SPEC.txt) for the authoritative full specification.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript 6** (strict, plus `noUncheckedIndexedAccess`)
- **Tailwind CSS 4** (CSS-first `@theme` design tokens)
- **Radix UI** primitives + **CVA** for the component layer
- **React Hook Form + Zod** (forms, arriving with the dealer panel)
- **Mongoose 9** (MongoDB Atlas)
- **next/font** self-hosting Plus Jakarta Sans + Hind

## Getting started

```bash
cp .env.example .env.local   # fill in at least MONGODB_URI
npm install
npm run dev
```

- App: http://localhost:3000
- **Design system review:** http://localhost:3000/design-system
- Health check: http://localhost:3000/api/health

## Scripts

| Script                 | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Dev server (Turbopack)                    |
| `npm run build`        | Production build                          |
| `npm run typecheck`    | `tsc --noEmit`                            |
| `npm run lint`         | ESLint (next/core-web-vitals + strict TS) |
| `npm run format`       | Prettier write                            |
| `npm run check`        | typecheck + lint + format check           |

> `npm run typecheck` relies on Next's generated route types. If you run it on a
> clean checkout before any build, run `npx next typegen` first (a build also
> generates them).

## Design system

The differentiator. Full tokens and every component live at `/design-system`.

- **Ink** (deep indigo) — trust / primary
- **Clay** (warm ochre) — the _bhoomi_ accent
- **WhatsApp green** — reserved; only ever the WhatsApp action, via
  `<WhatsAppButton>`. It appears nowhere else, so buyers learn it on sight.
- **Sand** — warm off-white neutrals; the page is paper, not stark white.
- Subtle borders over heavy shadows; one clear action per surface; mobile-first
  for mid-range Android.

## Structure

Folder layout follows `DEV-SPEC.txt` Section 2. Directories for later phases are
scaffolded with `.gitkeep` placeholders.
