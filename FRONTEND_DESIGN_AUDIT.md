# FRONTEND_DESIGN_AUDIT.md
## Resolve PM Enterprise — Current Frontend vs. Design Bible Gap Analysis

> Audited: 2026-07-13
> Bible Source: `resolve_pm_design_bible.html`
> Frontend Source: `frontend/src/` (~45 component dirs, ~15 page dirs, 1318 lines CSS)

---

## Global Violations (affect every screen)

### G1. Font System — CRITICAL
| Current | Bible Requirement | Files Affected |
|---------|-------------------|----------------|
| `Rubik` everywhere (sans + mono) | `Inter` (sans) + `JetBrains Mono` (mono) | `index.css:5,92-99,219,421-422,447-448,488,560,589,1286-1290`, every component via inheritance |

All `.font-geist`, `.font-mono-pm`, `.font-mono-data`, `.font-serif-headers` classes resolve to `Rubik`. The Bible forbids this font — Inter was chosen for screen-optimized neutrality.

### G2. Primary Color — CRITICAL
| Current | Bible Requirement |
|---------|-------------------|
| Purple `#7C3AED` (primary), Violet `#a78bfa` (secondary), Teal `#22d3ee` (accent) | Single Indigo Blue `#4F6DFF` with hover `#3D5AE8` and active `#2E49D4` |

Three competing primaries exist. The Bible explicitly calls this out: *"The current app uses both violet-purple and teal. This creates two competing primaries."*

### G3. Surface System — CRITICAL
| Current | Bible Requirement |
|---------|-------------------|
| Translucent `rgba()` surfaces with `backdrop-filter: blur()` | Solid opaque hex surfaces (`#080A16` → `#1F2438`) |

Glassmorphism classes: `.glass-panel`, `.premium-panel`, `.modal-premium`, `.sidebar-collapsed-premium`, `.card-premium`, `.pm-card`, `.premium-card` all use `backdrop-filter: blur()`. Bible: *"No Glow, No Glassmorphism"*.

### G4. Elevation — CRITICAL
| Current | Bible Requirement |
|---------|-------------------|
| Glow effects (`box-shadow: 0 0 15px rgba(124,58,237,0.25)`), ambient gradients, scale transforms | Box-shadow only (defined 4 levels), no glow, no scale |

CSS classes `.premium-hover-lift`, `.sidebar-nav-active-premium`, `.btn-premium-primary:hover`, `.card-premium:hover` all use glow and/or scale. Bible: *"Never scale on hover for data elements."*

### G5. Icon Libraries — CRITICAL
| Current | Bible Requirement |
|---------|-------------------|
| Lucide + Material Symbols + Phosphor Icons (3 libraries) | Lucide only, 1.5px stroke, outline only |

`Icon.tsx` wraps Material Symbols. `RouteIcon.tsx` imports `@phosphor-icons/react`. Bible: *"No filled icon variants. No custom SVG that doesn't match Lucide stroke weight."*

### G6. CSS Architecture — STRUCTURAL
| Current | Bible Requirement |
|---------|-------------------|
| 1318 lines in single `index.css`, duplicate blocks (lines 420-464 duplicate 424-464), 50+ `!important` rules | Modular CSS files with design tokens as single source of truth |

### G7. Design Token Namespace — STRUCTURAL
| Current | Bible Requirement |
|---------|-------------------|
| `--pm-*` namespace (80+ tokens), `--surface-*`, `--signal-*`, `--accent-*` | `--color-*`, `--space-*`, `--text-*`, `--dur-*`, `--ease-*`, `--radius-*`, `--shadow-*` |

---

## Screen-by-Screen Audit

### AUTH SCREENS

#### Login (`components/auth/Login.tsx`)
| Issue | Detail |
|-------|--------|
| ❌ Glassmorphism | `premium-panel` class = backdrop-filter + blur |
| ❌ Decorative grid overlay | `radial-gradient(circle at 2px 2px, white 1px, transparent 0)` — violates P2 (Information Before Decoration) |
| ❌ Gradient button | `btn-premium-primary` = `linear-gradient(135deg, #7c3aed, #4f46e5)` |
| ❌ Hardcoded color | `text-indigo-400`, `text-indigo-300`, `text-red-400`, `bg-red-500/5`, `bg-emerald-400` |
| ❌ Wrong radius | `rounded-2xl` (16px) — Bible max card radius is 12px (`--radius-xl`) |
| ❌ Glass surface | `bg-[var(--surface-glass)]` on inputs — Bible: solid surface background |
| ❌ Active scale | `active:scale-[0.98]` on button — Bible: no scale transforms |
| ❌ Pulse animation | `animate-pulse` on status dot — Bible: skeleton pulse only (opacity 0.4-0.7-0.4) |
| ❌ Font | `font-geist` class = Rubik, not Inter |
| ⚠ Typography | `text-3xl` on heading — Bible Display = 32px, but H1 = 22px. Login title should be H1. |

#### ProductKeyGate, ProvisioningGate, PasswordSetup, ResetPassword
- Same class patterns: `premium-panel`, `btn-premium-primary`, `surface-glass` inputs
- All inherit global violations G1-G5

### DASHBOARD LAYOUT (`pages/dashboard/DashboardLayout.tsx`)
| Issue | Detail |
|-------|--------|
| ❌ Monolithic file | 1826 lines — sidebar, header, routing, state, modals all in one component |
| ❌ No PageShell pattern | Custom flex layout, not using any template system |
| ❌ Sidebar width | Not tokenized, uses Tailwind utility classes |
| ❌ Sidebar active state | Uses `--pm-primary` (#7C3AED purple) with glow, not indigo left-border |
| ❌ Icon library | Imports 50+ Lucide icons (good) but sidebar icons use Phosphor via `renderRouteIcon()` |
| ❌ Multiple nav patterns | Domain-based nav AND sidebar groups — inconsistent vocabulary |

### STATS GRID (`components/dashboard/StatsGrid.tsx`)
| Issue | Detail |
|-------|--------|
| ⚠ Good semantic tokens | Uses `text-signal-safe`, `text-signal-warning` — correct pattern |
| ❌ Wrong font | `font-mono` resolves to Rubik, not JetBrains Mono |
| ❌ Font size | `text-[9px]` and `text-[10px]` — Bible minimum is 11px (`--text-xs`) |
| ❌ Missing tabular nums | No `font-variant-numeric: tabular-nums` on metric numbers |
| ❌ Metric typography | `text-xl` / `text-2xl` — Bible Metric = 28px / 500 weight |

### MISSION CONTROL (`components/mission-control/`)
| Issue | Detail |
|-------|--------|
| ❌ No three-zone layout | Missing Zone 1/2/3 dashboard philosophy |
| ❌ Mixed widget styles | DependencyRiskPanel (31KB), WorkSessionPanel (18KB) — no shared widget framework |
| ❌ No MetricCard component | Each widget defines its own stat display |
| ❌ Hardcoded styles | Inline styles throughout widgets |

### TASK CARD (`components/task/TaskCard.tsx`)
| Issue | Detail |
|-------|--------|
| ⚠ Good signal colors | Uses `text-signal-critical`, `bg-signal-critical-bg` |
| ❌ CSS class | Uses `task-card` which has `transform: translateY(-2px)` hover lift — Bible prohibits |
| ❌ Density prop | Custom density system (`comfortable`/`compact`/`executive`) vs Bible fixed spacing |

### EMPTY STATES
| Issue | Detail |
|-------|--------|
| ❌ Two EmptyState components | `components/ui/EmptyState.tsx` + `components/common/EmptyState.tsx` + `components/common/PremiumEmptyState.tsx` + `components/ui/PremiumEmptyState.tsx` — 4 competing implementations |
| ❌ Gradient icon container | `bg-gradient-to-br from-[var(--surface-hover)] to-[var(--surface-glass)]` — Bible: no gradients |
| ❌ Glow effect | `bg-indigo-500/5 blur-xl` — Bible: no glow |
| ❌ Icon size | `w-7 h-7` (28px) in 16x16 container — Bible: 20px Lucide, centered |
| ❌ Motion | `motion.div` with `framer-motion` — Bible: simple CSS transitions only |

### CONFIRMATION MODAL (`components/ui/ConfirmationModal.tsx`)
| Issue | Detail |
|-------|--------|
| ❌ Glassmorphism | `modal-overlay-premium` + `modal-premium` = backdrop-filter blur |
| ❌ Scale animation | `scale: 0.95 → 1` — Bible: fade + 4px translateY only |
| ❌ Spring physics | `type: "spring", damping: 25, stiffness: 300` — Bible: simple `--ease-standard` |
| ❌ Wrong radius | `rounded-2xl` — Bible modal: `--radius-xl` (12px) |
| ❌ Hardcoded color | `bg-rose-500/10`, `text-rose-400`, `bg-purple-500/10`, `text-purple-400` |
| ❌ Layout | Confirm + Cancel side by side (`flex gap-4`) — Bible: Primary bottom-right, destructive bottom-left |
| ❌ Button text | "Abort" label — inconsistent with enterprise standard "Cancel" |

### PREMIUM LOADER (`components/common/PremiumLoader.tsx`)
| Issue | Detail |
|-------|--------|
| ❌ Centered page spinner | Bible: *"Never a spinner centered on page"* — skeleton placeholders only |
| ❌ Hardcoded purple | `borderTopColor: '#7c3aed'`, `borderColor: 'rgba(124, 58, 237, 0.15)'` |
| ❌ Shimmer skeleton | Uses `animate-pulse` from Tailwind — Bible: opacity 0.4→0.7→0.4, no shimmer/sweep |
| ❌ Glass surface | `bg-[var(--surface-glass)]` skeleton shapes |

### COMMAND PALETTE (`components/navigation/CommandCenter.tsx` + `components/command/CommandPalette.tsx`)
| Issue | Detail |
|-------|--------|
| ⚠ Two implementations | `CommandCenter.tsx` and `CommandPalette.tsx` — should be one |
| ❌ No keyboard hints | Bible: keyboard hint right-aligned for each result |
| ❌ No group labels | Bible: groups with uppercase labels |

### FINANCE COMPONENTS (`components/finance/`)
| Issue | Detail |
|-------|--------|
| ❌ Custom modal styles | Each modal (`CreateInvoiceModal`, `AddExpenseModal`, etc.) defines its own layout |
| ❌ No shared form pattern | Each modal builds its own form structure |

### HR COMPONENTS (`components/hr/`)
| Issue | Detail |
|-------|--------|
| ❌ Same modal/form issues as Finance |

### FILES COMPONENTS (`components/files/`)
| Issue | Detail |
|-------|--------|
| ❌ Hardcoded colors in `FilePreview.tsx`, `FileVersionHistory.tsx` |

---

## CSS Audit Summary

### `index.css` — 1318 lines

| Category | Count | Examples |
|----------|-------|---------|
| `!important` rules | ~50+ | Nearly every premium class |
| Duplicate blocks | 2 | Lines 420-464 duplicated |
| Glassmorphism classes | 8+ | `.glass-panel`, `.premium-panel`, `.modal-premium`, etc. |
| Gradient classes | 4 | `.bg-primary-gradient`, `.bg-secondary-gradient`, `.text-primary-gradient`, `.btn-premium-primary` |
| Glow effects | 5+ | `--accent-glow`, `--premium-glow`, `.sidebar-nav-active-premium` |
| Scale transforms | 6+ | `.btn-premium-*:hover`, `.card-premium:hover`, `.premium-active-press` |
| Shimmer animations | 2 | `@keyframes shimmer` (defined twice) |
| Dead/unused material | ~50 lines | Material Symbols classes after icon migration |
| Competing token systems | 3 | `--pm-*`, `--signal-*`, `--surface-*` |

### Hardcoded Colors in Components (grep results — 50+ files)
Every file listed in the grep contains at least one `#XXXXXX` hex literal or Tailwind color utility (`text-purple-*`, `bg-slate-*`, etc.) instead of design tokens.

---

## Technical Debt Summary

| Debt | Severity | Impact |
|------|----------|--------|
| 4 EmptyState components | HIGH | Inconsistent empty states across modules |
| 2 Command Palette components | HIGH | Duplicate navigation UX |
| DashboardLayout.tsx at 1826 lines | HIGH | Unmaintainable, blocks component extraction |
| No core component library | HIGH | Every module builds its own buttons, cards, modals |
| No PageShell/template system | HIGH | Every page defines its own layout structure |
| Mixed icon libraries (3) | MEDIUM | Visual inconsistency, bundle size |
| Purple-Indigo-Teal color split | MEDIUM | Competing visual hierarchies |
| Glassmorphism throughout | MEDIUM | Performance (backdrop-filter is GPU-heavy), inconsistency |
| No design token file | MEDIUM | Tokens scattered across 400+ lines of CSS |
| Density system vs Bible spacing | LOW | Architectural decision needed |
| Light theme extensive overrides | LOW | Maintainable via ThemeProvider |
