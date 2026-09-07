# UI/UX resource bank

A curated, growing list of the design & component sources this project draws
from. Julien collects these across projects — **append here, never replace**, so
the bank survives from one session to the next.

Format for every entry: what it is, what it's good for here, how the code
actually gets into the repo (copy-paste, CLI, or npm), and the licence.

---

## 1. React Bits — <https://reactbits.dev> · <https://github.com/DavidHDev/react-bits>

**Installed in this repo.** 27 components under
[`src/shared/components/reactbits/`](../src/shared/components/reactbits/README.md),
rendered live at `/ui`.

165+ animated React components in four variants (JS-CSS, JS-TW, TS-CSS, TS-TW).
Copy-paste ownership model: the code lands in your repo and you edit it freely.
Split into **Text Animations**, **Animations**, **Components** and
**Backgrounds**, plus free creative tools (Background Studio, Shape Magic,
Texture Lab) at <https://reactbits.dev/tools>.

- Best for: hero text, winner reveals, animated backgrounds, card/list motion.
- Install: `npx shadcn@latest add @react-bits/<Name>-TS-TW` (see
  [`components.json`](../components.json)) or `npx jsrepo@latest add
  https://reactbits.dev/r/<Name>-TS-TW`.
- Licence: MIT + Commons Clause — free in products, but you may not resell the
  components themselves.

## 2. Uiverse — <https://uiverse.io>

Community gallery of thousands of small UI elements — buttons, loaders,
toggles, checkboxes, cards, inputs — each shipped as self-contained HTML + CSS
(a Tailwind toggle is available on most). Pure CSS, no runtime dependency.

- Best for: one-off micro-interactions — a vote button, a loading state, a
  toggle — where a whole component library would be overkill.
- Install: copy the HTML/CSS from the element page; port the markup to JSX
  (`class` → `className`) and drop the CSS in `globals.css` or a CSS module.
- Licence: MIT (per the site); attribution is polite, the author is on each card.

## 3. Kokonut UI — <https://kokonutui.com>

Free React/Next.js component collection built on Tailwind + Motion, distributed
through the shadcn CLI. Leans towards polished, "product-grade" blocks — cards,
inputs, AI-chat surfaces, pricing and action panels.

- Best for: complete, opinionated blocks rather than raw effects — a nice
  counterweight to React Bits, which is effect-first.
- Install: `npx shadcn@latest add <url-from-the-component-page>`; the repo's
  [`components.json`](../components.json) already configures the shadcn CLI.
- Licence: check the component page — most of the free set is MIT.

## 4. Anime.js — <https://animejs.com>

Not a component library: a small, standalone JavaScript animation engine
(timelines, staggering, SVG morphing/line drawing, scroll-linked playback,
spring easings). v4 is ESM-first and tree-shakeable.

- Best for: bespoke sequences the vendored components don't cover — a bracket
  animating as it fills, an SVG trophy drawing itself, a staggered reveal.
- Install: `npm i animejs` (not installed yet — this project currently animates
  with GSAP + Motion, which came in with React Bits; add Anime.js only if a
  sequence is genuinely easier to express with it).
- Licence: MIT.

## 5. bklit — <https://bklit.com>

Landing-page templates (per Julien — the domain was unreachable from the
sandbox where this entry was written, so the details below are the shape of the
resource, not a verified inventory).

- Best for: the one page in this app that is a landing page —
  [`src/app/page.tsx`](../src/app/page.tsx), the create/join screen. Structure
  and copy layout to lift; the room, bracket and history views are product UI
  and won't map onto a marketing template.
- Install: templates are whole-page, so treat them as a reference to rebuild
  from rather than a paste target — this app is a single Next.js page with a
  Socket.IO create/join flow, not a static site. Keep the existing
  `Button`/`Card`/`Input` primitives from `src/shared/components/ui.tsx`.
- Licence: check on the site before shipping anything from it — page templates
  more often carry a per-use or commercial licence than the component libraries
  above.

---

## How to add to this bank

1. Add a numbered section using the format above.
2. If the resource is actually *installed*, say so in the first line and link to
   where its code lives.
3. Keep the licence line — it decides whether the code can ship.

## Style constraints this project imposes

Anything pulled from these sources has to survive the repo's existing setup:

- **Tailwind v3.4**, not v4 — no `@theme`, `rounded-4xl`, `bg-linear-*`,
  `text-shadow-*`, `outline-hidden`. Port them to v3 utilities or extend
  [`tailwind.config.ts`](../tailwind.config.ts).
- **Next.js App Router** — anything using hooks, refs, canvas or WebGL needs
  `'use client'` at the top of the file.
- **`strict` + `noUncheckedIndexedAccess`** in `tsconfig.json` — most
  copy-pasted TS assumes indexing is safe, so expect to add `!` or guards.
- **Dark theme, brand purple** (`brand-*` in the Tailwind config, slate-950
  background). Recolour effects rather than accepting their defaults.
