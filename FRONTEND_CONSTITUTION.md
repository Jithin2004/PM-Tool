# FRONTEND_CONSTITUTION.md
## Resolve PM Enterprise — Permanent UI Architecture Law

> Version: 1.0
> Effective: 2026-07-13
> Authority: Resolve PM Design Bible (`resolve_pm_design_bible.html`)
> Scope: All frontend code in `frontend/src/`

---

## Article I — Supremacy

1. The Design Bible is the supreme authority for all frontend decisions.
2. If existing code conflicts with this Constitution, this Constitution wins unless the change would break backend functionality or established business workflows.
3. No component, page, or style may be created or modified without conforming to this document.

---

## Article II — Design Tokens

1. **All visual values must reference design tokens.** No hardcoded colors, font sizes, spacing values, shadows, radii, or durations in component code.
2. Design tokens live in `src/design/*.css` as CSS custom properties on `:root`.
3. The token files are:
   - `tokens.css` — master import file
   - `colors.css` — all color tokens
   - `typography.css` — fonts, type scale
   - `spacing.css` — 4px-base spacing scale
   - `motion.css` — durations, easings
   - `elevation.css` — shadows, radii
   - `components.css` — base component styles
   - `layouts.css` — page template styles
4. **Forbidden patterns:**
   - `#XXXXXX` hex literals in `.tsx` files
   - Tailwind color utilities (`text-purple-*`, `bg-slate-*`, `text-gray-*`)
   - `px` values for spacing (use `var(--space-*)`)
   - Inline `style={{}}` for visual properties

---

## Article III — Typography

1. **Primary font**: Inter (v4). Fallback: `system-ui, -apple-system, sans-serif`.
2. **Mono font**: JetBrains Mono. For: timestamps, IDs, code, connection strings, database values.
3. **Never** use monospace for navigation or prose.
4. **Minimum weight**: 400. Never use font weight below 400.
5. **All-caps**: Rationed to 3 uses per page maximum (table headers, section overlines, tech status codes).
6. **Metric numbers**: Must use `font-variant-numeric: tabular-nums`.
7. Every text element must use a defined type role from the scale (Display, H1, H2, H3, Label, Body, Body Small, Caption, Metric, Mono, Button, Nav Item, Table Cell).

---

## Article IV — Color

1. **Single primary**: Indigo Blue `#4F6DFF`. No secondary competing primary.
2. **Color is always semantic.** No color exists purely for visual interest. Every color communicates state, priority, status, or role.
3. **Forbidden**: Purple (`#7C3AED`), Teal (`#22d3ee`), or any color not in the token system.
4. **No pure black** (`#000000`). Darkest surface is `#080A16`.
5. Status colors are fixed and non-negotiable: Success `#22D3A0`, Warning `#F59E0B`, Danger `#EF4444`, Info `#60A5FA`.
6. Text hierarchy: primary `#E8EAF2`, secondary `#9BA3C7`, muted `#6B7494`, disabled `#3A4060`.

---

## Article V — Components

### V.1 Core Component Library
1. All reusable components live in `src/components/core/`.
2. **Every page** consumes core components. No page may define its own button, card, input, modal, badge, or table style.
3. The core library includes: Button, Card, Input, Modal, Badge, Avatar, EmptyState, MetricCard, Panel, Toolbar, Table, StatTile, PageHeader.

### V.2 One Style Per Component
1. **One Button style** per context: Primary (filled indigo), Secondary (bordered), Ghost (text-only). Never gradient. Never page-specific variants. One primary per view.
2. **One Card style**: `--color-surface-1` bg, 1px border, `--radius-lg` (8px), `--space-4` (16px) padding. No drop shadows on cards. No hover lift/scale.
3. **One Table style**: Fixed header, row separators only, 40px standard / 32px compact row height, UPPERCASE 11px headers, actions right-aligned.
4. **One Modal style**: Max 640px, standard header/body/footer, fade + 4px translateY animation. Primary bottom-right, destructive bottom-left. No glassmorphism. No scale animation.
5. **One Form style**: Label above field, full-width inputs, helper text below, error below (red, 12px). No floating labels.
6. **One Empty State style**: 20px Lucide icon (muted), 16px title (500), 14px description (muted), one CTA. No illustrations, no emoji.
7. **One Loading style**: Skeleton placeholders matching content layout. Opacity pulse 0.4→0.7→0.4. **Never a centered page spinner.** No shimmer. No gradient sweep.

### V.3 Component Prohibitions
- No `backdrop-filter` / `blur()` in any component
- No `transform: scale()` on hover for data elements
- No `box-shadow` glow effects (e.g., `0 0 Xpx rgba(...)`)
- No gradient backgrounds for buttons, cards, or panels
- No `!important` in component styles
- No `framer-motion` for simple state transitions (use CSS transitions with design tokens)

---

## Article VI — Icons

1. **Lucide React only.** Direct imports: `import { Settings } from 'lucide-react'`.
2. **No wrapper component.** No `Icon.tsx`. No abstraction layer.
3. **Sizes**: 16px (inline/nav), 18px (buttons), 20px (standalone), 24px (empty states only).
4. **Stroke width**: 1.5px at all sizes. Never 2px.
5. **Color**: Icons inherit parent text color. Never independently colored unless conveying semantic status (success/danger/warning/info).
6. **Paired with text**: 8px gap. Icon left of label. Never icon-only for primary actions.
7. **Prohibited**: No emoji as icons. No filled variants. No Material Symbols. No Phosphor Icons. No custom SVGs that don't match Lucide stroke weight.

---

## Article VII — Layout

### VII.1 Page Templates
Every module page must use the `PageShell` template system:

```
<PageShell>
  <PageHeader />
  <PageToolbar />
  <PageContent>
    <PageSidebar /> (optional)
  </PageContent>
  <PageFooter /> (optional)
</PageShell>
```

No page may define its own layout structure.

### VII.2 Layout Tokens
| Token | Value | Rule |
|-------|-------|------|
| Sidebar | 220px fixed, 60px collapsed | Never fluid |
| Header | 48px fixed | Contains subnav + global actions |
| Content max-width | 1280px | Centered beyond |
| Content padding | 32px | Left/right |
| Reading width | 680px | Forms, docs, wizards |
| Panel width | 380px | Right-side drawers |

### VII.3 Dashboard Three-Zone Philosophy
1. **Zone 1** (top): "What happened?" — KPI metrics, deltas, activity. Max 6 metrics.
2. **Zone 2** (middle): "What requires attention?" — At-risk, overdue, blocked. Never below fold.
3. **Zone 3** (bottom): "What should I do next?" — Recommendations, AI, shortcuts. Never first.

---

## Article VIII — Motion

1. All transitions use design token durations and easings.
2. **Hover**: 80ms, background color change only. No scale. No lift.
3. **Skeleton loading**: 1.4s opacity pulse (0.4→0.7→0.4). No shimmer. No gradient sweep.
4. **Modal enter/exit**: 200ms fade + 4px translateY. No scale. No spring physics.
5. **`prefers-reduced-motion`**: All transitions → 0ms. Skeleton → static. Charts → instant render.

---

## Article IX — Accessibility

1. **WCAG AA** compliance is non-negotiable for all screens.
2. All body text: ≥4.5:1 contrast ratio. Large text: ≥3:1. UI components: ≥3:1.
3. Every interactive element reachable by Tab. Focus order = visual order.
4. Focus ring: 2px `--color-primary` outline + 2px offset. Never `outline:none` without visible replacement.
5. All icons: `aria-label` or `aria-hidden`.
6. Tables: `<thead>`, `<th>` with `scope`.
7. Modals: trap focus, restore on close.
8. Form errors: inline below field, `aria-describedby`, focus to first error on submit.
9. Skip-to-content link present.

---

## Article X — Elevation

1. Elevation is through background lightness, not shadow (for cards/panels).
2. Shadows are reserved for floating elements: dropdowns, tooltips, modals, overlays.
3. **Prohibited**: glassmorphism, backdrop-filter, blur effects, glow shadows, ambient gradient animations.
4. Four shadow levels only: sm, md, lg, overlay.

---

## Article XI — Theme Engine

1. Theme is managed by `ThemeProvider`.
2. Two themes: Enterprise Dark (primary), Enterprise Light.
3. Dark mode is independently designed, not inverted.
4. Architecture supports future themes: Executive, High Contrast, OEM.
5. All components must reference tokens, never hardcoded theme values.

---

## Article XII — Deprecation

1. Legacy components are moved to `src/components/legacy/` — never hard-deleted immediately.
2. Only deleted after `grep` confirms zero references across the entire codebase.
3. All new code must use core components from `src/components/core/`.

---

## Article XIII — Compliance Gate

Before any phase is considered complete:

1. ✅ `npx tsc --noEmit` — TypeScript passes
2. ✅ `npm run build` — Vite production build succeeds
3. ✅ No hardcoded hex colors in `.tsx` files
4. ✅ No `backdrop-filter` or `blur()` in component code
5. ✅ No Rubik font references
6. ✅ No Material Symbols or Phosphor imports
7. ✅ No `--pm-*` token usage (migrated to `--color-*`)
8. ✅ Accessibility: keyboard navigation verified
9. ✅ Responsive: tested at 768px and 1280px breakpoints
10. ✅ Visual regression: before/after screenshots captured

---

## Signatories

This Constitution governs all frontend development for Resolve PM Enterprise v1.4 and beyond. Any violation constitutes technical debt that must be resolved before the Frontend Freeze.
