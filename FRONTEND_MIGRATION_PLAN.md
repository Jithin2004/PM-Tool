# FRONTEND_MIGRATION_PLAN.md
## Resolve PM Enterprise v1.4 — Phased Migration Plan

> Version: 2.0 (incorporates all architectural corrections)
> Migration Strategy: Layer-by-layer (not module-by-module)
> Backend: FROZEN — no changes permitted

---

## Phase 3: Design Tokens

### Files
| Action | File |
|--------|------|
| CREATE | `src/design/tokens.css` — master import orchestrator |
| CREATE | `src/design/colors.css` — complete color architecture |
| CREATE | `src/design/typography.css` — font families + type scale |
| CREATE | `src/design/spacing.css` — 4px base spacing tokens |
| CREATE | `src/design/motion.css` — durations + easings |
| CREATE | `src/design/elevation.css` — shadows + radii |
| CREATE | `src/design/components.css` — base component class styles |
| CREATE | `src/design/layouts.css` — page template + grid styles |
| MODIFY | `src/index.css` — replace @theme block with `@import` of design files |
| MODIFY | `index.html` — swap Rubik → Inter + JetBrains Mono fonts |

### Dependencies
- None — tokens are the foundation layer

### Risks
- Font swap may cause layout shifts if Inter metrics differ from Rubik
- Token rename (`--pm-*` → `--color-*`) breaks any component using old tokens

### Rollback
- Revert `index.css` imports, restore `@theme` block

### Verification
- `npm run build` passes
- Visual check: font renders correctly
- Grep: no remaining Rubik references in CSS

### Expected Outcome
- Single source of truth for all design tokens
- Old `--pm-*` tokens aliased to new `--color-*` tokens (temporary backward compat)
- Inter + JetBrains Mono loaded

---

## Phase 4: Core Component Library

### Files
| Action | File |
|--------|------|
| CREATE | `src/components/core/Button.tsx` |
| CREATE | `src/components/core/Card.tsx` |
| CREATE | `src/components/core/Input.tsx` |
| CREATE | `src/components/core/Modal.tsx` |
| CREATE | `src/components/core/Badge.tsx` |
| CREATE | `src/components/core/Avatar.tsx` |
| CREATE | `src/components/core/EmptyState.tsx` |
| CREATE | `src/components/core/MetricCard.tsx` |
| CREATE | `src/components/core/Panel.tsx` |
| CREATE | `src/components/core/Toolbar.tsx` |
| CREATE | `src/components/core/Table.tsx` |
| CREATE | `src/components/core/StatTile.tsx` |
| CREATE | `src/components/core/PageHeader.tsx` |
| CREATE | `src/components/core/index.ts` — barrel export |
| MOVE | `src/components/ui/TiltCard.tsx` → `src/components/legacy/TiltCard.tsx` |
| MOVE | `src/components/ui/PremiumEmptyState.tsx` → `src/components/legacy/PremiumEmptyState.tsx` |
| MOVE | `src/components/common/PremiumEmptyState.tsx` → `src/components/legacy/PremiumEmptyState2.tsx` |
| MOVE | `src/components/ui/PremiumModal.tsx` → `src/components/legacy/PremiumModal.tsx` |

### Dependencies
- Phase 3 (Design Tokens) must be complete

### Risks
- Import paths change for moved legacy components
- Need to update all consumers of moved components

### Rollback
- Move legacy components back, delete core components

### Verification
- `npx tsc --noEmit` passes
- `npm run build` passes
- Grep: zero imports of legacy components from non-legacy paths
- Every core component uses only design tokens

### Expected Outcome
- Clean, Bible-compliant component library
- All existing consumers still work via legacy path aliases
- New components ready for consumption

---

## Phase 5: Layouts & Navigation

### Files
| Action | File |
|--------|------|
| CREATE | `src/components/core/PageShell.tsx` |
| CREATE | `src/components/core/PageContent.tsx` |
| CREATE | `src/components/core/PageToolbar.tsx` |
| CREATE | `src/components/core/PageSidebar.tsx` |
| CREATE | `src/components/core/PageFooter.tsx` |
| MODIFY | `src/components/layout/PremiumAppShell.tsx` — remove ambient glow, use solid bg-base |
| MODIFY | `src/pages/dashboard/DashboardLayout.tsx` — extract sidebar to standalone component |
| CREATE | `src/components/core/Sidebar.tsx` — indigo left-border active, 220px fixed |
| CREATE | `src/components/core/Header.tsx` — 48px fixed, subnav tabs |

### Dependencies
- Phase 4 (Core Components) — Sidebar uses Button, Badge, Avatar

### Risks
- DashboardLayout.tsx is 1826 lines — extraction requires careful state management
- Sidebar active state logic is complex

### Rollback
- Revert DashboardLayout.tsx, delete new shell components

### Verification
- All navigation works identically to current behavior
- Active states use indigo left-border (not purple glow)
- Sidebar collapses to 60px correctly

### Expected Outcome
- Sidebar, Header, PageShell as independent reusable components
- DashboardLayout.tsx reduced in size
- Every page can use `<PageShell>` template

---

## Phase 6: Dashboard Widget Framework

### Files
| Action | File |
|--------|------|
| CREATE | `src/components/core/DashboardWidget.tsx` |
| CREATE | `src/components/core/DashboardSection.tsx` |
| CREATE | `src/components/core/InsightCard.tsx` |
| CREATE | `src/components/core/TimelineCard.tsx` |
| CREATE | `src/components/core/FeedCard.tsx` |
| CREATE | `src/components/core/EnterpriseFeed.tsx` — Enterprise Event Timeline |
| MODIFY | `src/components/dashboard/StatsGrid.tsx` — use MetricCard from core |

### Dependencies
- Phase 4 (Core Components) — MetricCard, Card, Badge
- Phase 5 (Layouts) — DashboardSection uses PageContent grid

### Expected Outcome
- Uniform widget spacing across all dashboard surfaces
- EnterpriseFeed as flagship timeline component with actor, entity, severity, module, timestamps, correlation ID, execution trace, filters
- Every dashboard widget inherits identical styling automatically

---

## Phase 7: Mission Control Rebuild

### Files
| Action | File |
|--------|------|
| MODIFY | All 7 files in `src/components/mission-control/` |
| Implement three-zone layout (Zone 1: metrics, Zone 2: attention, Zone 3: recommendations) |

### Dependencies
- Phase 6 (Widget Framework)

### Expected Outcome
- Mission Control follows the Three Questions philosophy
- Max 6 KPI cards in Zone 1
- At-risk/overdue/blocked items prominent in Zone 2
- AI suggestions/recommendations in Zone 3

---

## Phase 8: Remaining Module Migration (Layer-by-layer)

### Order
1. Replace all buttons across all modules → core Button
2. Replace all cards across all modules → core Card
3. Replace all inputs/forms across all modules → core Input
4. Replace all modals across all modules → core Modal
5. Replace all empty states across all modules → core EmptyState
6. Replace all tables across all modules → core Table
7. Replace all metric displays → core MetricCard / StatTile
8. Replace all page layouts → PageShell template
9. Remaining page-specific cleanup

### Dependencies
- Phases 4-7

### Expected Outcome
- Every module automatically improved by consuming core components
- Minimal per-page custom styling

---

## Phase 9: Accessibility & Responsive

### Tasks
- WCAG AA contrast audit on all screens
- Keyboard navigation test (Tab through every interactive element)
- Focus ring verification (2px indigo outline + 2px offset)
- `aria-label` / `aria-hidden` on all icons
- `aria-live` on status changes
- `aria-describedby` on form errors
- `prefers-reduced-motion` verification
- Skip-to-content link
- Responsive testing at 768px and 1280px

### Expected Outcome
- Full WCAG AA compliance
- All interactive elements keyboard accessible

---

## Phase 10: Performance & CSS Cleanup

### Tasks
- Remove all glassmorphism classes from `index.css`
- Remove all gradient button classes
- Remove all glow/scale animations
- Remove Material Symbols CSS
- Remove duplicate CSS blocks
- Remove dead/unused classes
- Remove old `--pm-*` token aliases (after confirming zero references)
- Audit `!important` usage — eliminate all non-essential
- Bundle size comparison (before vs. after)

### Expected Outcome
- Leaner CSS, no dead code
- Reduced `!important` count from ~50 to near-zero
- Measurable bundle size improvement

---

## Phase 11: Visual Regression

### Screenshots to capture (before/after for each phase):
- Login screen
- Dashboard overview
- Mission Control
- Project list
- Project workspace
- Task board (Kanban)
- Sprint board
- Finance hub
- HR / People Ops
- Knowledge hub
- File center
- Meetings page
- Decision center
- Admin panel
- Settings

### Expected Outcome
- Visual proof of improvement at each phase
- No accidental regressions

---

## Phase 12: Frontend Freeze Certification

### Deliverable
`FRONTEND_FREEZE_CERTIFICATION.md` containing:
- Component inventory (core library)
- Design token compliance report
- Accessibility audit results
- Responsive audit results
- Performance observations (bundle size, CSS size)
- Visual consistency verification
- Remaining technical debt (if any)
- Future recommendations
- **FRONTEND FROZEN** verdict (or list of blockers)
