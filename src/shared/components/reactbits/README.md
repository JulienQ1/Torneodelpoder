# React Bits components

Vendored from [React Bits](https://reactbits.dev) (`DavidHDev/react-bits`),
**TS + Tailwind** variant. React Bits is a copy-paste library: these files are
now part of this repo and are meant to be edited, not treated as a black box.

## Usage

Each file default-exports one component. Import it directly — there is no barrel
file, so a page never pulls in `ogl` or `gsap` just to render some text.

```tsx
import BlurText from '@/shared/components/reactbits/TextAnimations/BlurText';
import SpotlightCard from '@/shared/components/reactbits/Components/SpotlightCard';

<BlurText text="Torneo del Poder" delay={120} className="text-4xl font-bold" />;
```

Every file starts with `'use client'` — they use hooks, refs, canvas or WebGL,
so they cannot render as React Server Components.

## What's here

| Category | Components | Extra runtime |
| --- | --- | --- |
| `TextAnimations/` | `BlurText`, `CountUp`, `DecryptedText`, `GradientText`, `RotatingText`, `ShinyText` | `motion` |
| | `SplitText` | `gsap`, `@gsap/react` |
| | `TextType` | `gsap` |
| `Animations/` | `ClickSpark`, `ElectricBorder`, `GlareHover`, `Magnet`, `StarBorder` | — |
| | `AnimatedContent`, `FadeContent` | `gsap` |
| `Components/` | `SpotlightCard` | — |
| | `AnimatedList`, `Counter`, `Dock`, `Stepper`, `TiltedCard` | `motion` |
| | `CardSwap`, `MagicBento` | `gsap` |
| `Backgrounds/` | `Waves` | — |
| | `DotGrid` | `gsap` |
| | `Aurora`, `Particles` | `ogl` |

That's 27 of the 165+ components upstream — a starting set chosen for this app
(head-to-head match stages, winner reveals, bracket and list motion). Add more
with the CLI below; the whole catalogue is at <https://reactbits.dev>.

All of them render live at **`/ui`** ([`src/app/ui/page.tsx`](../../../app/ui/page.tsx)) —
a gallery route that doubles as the compile check for this folder.

## Local edits to upstream

Kept deliberately small, so a future re-pull is easy to diff. Beyond the three
fixes described below (applied throughout), only two components differ:

| File | Change | Why |
| --- | --- | --- |
| `Components/CardSwap.tsx` | `perspective-[900px]` → `[perspective:900px]` | `perspective-*` is a Tailwind v4 utility; the arbitrary property works in v3. |
| `Components/AnimatedList.tsx` | `w-[500px]` → `w-full` | Upstream hardcodes a 500px width, which overflows any narrower column. |

## Adding more

The repo's [`components.json`](../../../../components.json) registers the
`@react-bits` registry, so the shadcn CLI can fetch any component:

```bash
npx shadcn@latest add @react-bits/Aurora-TS-TW      # always the TS-TW variant
npx jsrepo@latest add https://reactbits.dev/r/Aurora-TS-TW   # equivalent
```

The CLI drops files under `src/shared/components/reactbits/`. After adding one,
apply the same three fixes this repo needs — they are not upstream bugs, just a
mismatch with this project's setup:

1. **`'use client'`** at the top of the file (upstream targets Vite, not the
   App Router).
2. **Tailwind v3 classes** — upstream is on v4. `rounded-4xl` is already mapped
   in [`tailwind.config.ts`](../../../../tailwind.config.ts); watch for
   `bg-linear-*`, `text-shadow-*`, `outline-hidden`, `@theme`.
3. **`noUncheckedIndexedAccess`** — this repo enables it, upstream doesn't, so
   indexed reads (`arr[i].foo`, destructured `[first]`) need `!` or a guard.
   Every such spot in the vendored files is already patched; `npm run typecheck`
   will find the new ones.

Then run `npm run typecheck` and `npm run lint`.

## Updating

There is no upgrade path — that's the trade-off of copy-paste ownership. To
refresh a component, re-run the CLI for it, re-apply the three fixes above, and
diff against any local customisation you made.

## Licence

MIT + Commons Clause, © David Haz. Free to use and modify inside this product;
you may not sell, sublicense or redistribute the components themselves.
Full text: <https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md>.
