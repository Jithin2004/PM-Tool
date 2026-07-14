# DESIGN_BIBLE_AUDIT.md
## Resolve PM Enterprise — Design Bible Complete Extraction

> Source: `resolve_pm_design_bible.html` (798 lines, 12 navigation phases, 20 chapters)
> Extracted: 2026-07-13
> Status: **CANONICAL — this document is the permanent reference for all frontend decisions**

---

## 1. Design Philosophy

### 1.1 Brand Identity

**Visual Register**: Enterprise Operations Intelligence
- Closest analog: mission control room aesthetic
- Reference: "Bloomberg Terminal meets Linear"
- Dark-native, status-forward, operational hierarchy

**Brand Personality Keywords** (6):

| Keyword | Meaning |
|---------|---------|
| **Controlled** | ECG pulse = urgency that is managed, never chaotic |
| **Operationally Aware** | Surfaces feel like they're monitoring, not just displaying |
| **Executive** | Decision-makers live here. Authority and precision. Nothing decorative. |
| **Precise** | Typography, spacing, data = surgical. No ambiguity. |
| **Trustworthy** | People stake careers on this data. Never unstable or experimental. |
| **Purposeful** | Every pixel serves a function. Visual weight = operational weight. |

### 1.2 Core Design Principles (6)

| ID | Principle | Rule |
|----|-----------|------|
| P1 | **Calm at Scale** | Density acceptable; visual noise is not. Breathing room prevents cognitive fatigue. |
| P2 | **Information Before Decoration** | No element exists unless it carries information or enables action. Gradients for aesthetics, decorative icons = **prohibited**. |
| P3 | **Hierarchy Through Restraint** | Emphasis works because most elements are de-emphasized. Primary actions earn prominence. |
| P4 | **Consistent Vocabulary** | One button style. One card style. One table style. Uniformity across 200+ screens. |
| P5 | **Dark is Primary** | Dark mode is native state, not an option. Reduces eye strain, creates premium focus. |
| P6 | **The Pulse is Alive** | Motion, status indicators, real-time data = alive but never frantic. ECG metaphor guides animation. |

### 1.3 Visual Direction Verdict

**✓ Enterprise Operations Intelligence** — Dark, composed, data-forward. Calm default state. Visible hierarchy. Status colors that mean something.

**Rejected Directions:**
- ❌ Startup/SaaS — white backgrounds, bright accents, rounded everything (Notion/Linear/Figma)
- ⚠ Technical/Developer Tool — terminal aesthetics, monospace labels, PROBE_01 IDs (current UI leans too far here)
- ❌ Financial — too austere, no operational warmth
- ❌ Government — too bureaucratic
- ❌ Industrial — too mechanical

### 1.4 Design North Star

> *"After 8 hours in Resolve PM, the user should feel informed and in control — not drained."*

**Implications:**
1. No cognitive taxation without payoff
2. Status must be instantly readable (understand health/risk/blocked within 3 seconds)
3. Interface should recede after familiarity
4. Actions should feel safe (destructive = confirmation, reversible = clearly indicated)

---

## 2. Design Tokens

### 2.1 Typography

**Primary Font**: Inter (v4)
- Fallback: `system-ui, -apple-system, sans-serif`
- Rationale: Neutral at small sizes, readable at high density, no personality competition

**Monospace Font**: JetBrains Mono
- Usage: timestamps, AES identifiers, connection strings, database values, IDs, code
- **Never** use monospace for navigation or prose

**Type Scale** (13 roles):

| Role | Size | Weight | Line-H | Tracking | Usage |
|------|------|--------|--------|----------|-------|
| Display | 32px | 600 | 1.2 | -0.02em | Hero stats, landing page only |
| H1 / Page Title | 22px | 600 | 1.25 | -0.01em | Section page headings |
| H2 | 18px | 500 | 1.3 | 0 | Sub-section headings |
| H3 | 15px | 500 | 1.35 | 0 | Card titles, widget headings |
| Label / Overline | 11px | 500 | 1.3 | +0.06em | Section labels (UPPERCASE), table headers |
| Body | 14px | 400 | 1.6 | 0 | All primary prose, descriptions |
| Body Small | 13px | 400 | 1.55 | 0 | Secondary descriptions, helper text |
| Caption | 12px | 400 | 1.5 | 0 | Timestamps, metadata, footnotes |
| Metric / Stat | 28px | 500 | 1.1 | -0.02em | Dashboard KPI numbers |
| Mono / Code | 12px | 400 | 1.5 | 0 | IDs, timestamps, tech labels |
| Button | 13px | 500 | 1.0 | +0.01em | All button labels |
| Nav Item | 13px | 400 | 1.0 | 0 | Sidebar navigation labels |
| Table Cell | 13px | 400 | 1.4 | 0 | Table body text |

**Typography Rules:**
- R1: All-caps labels rationed to **3 uses per page** (table headers, section overlines, tech status codes)
- R2: **Never** font weight below 400 (dark backgrounds make thin weights unreadable)
- R3: Metric numbers use `font-variant-numeric: tabular-nums` (stable column alignment)

**Typography CSS Tokens:**

```css
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;

--text-xs: 11px;    --text-sm: 12px;    --text-base: 13px;
--text-md: 14px;    --text-lg: 15px;    --text-xl: 18px;
--text-2xl: 22px;   --text-3xl: 28px;   --text-4xl: 32px;
```

### 2.2 Colors

#### Surface & Background Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-base` | `#080A16` | Deepest background layer |
| `--color-surface-0` | `#0F1124` | Main content background |
| `--color-surface-1` | `#151829` | Cards, panels |
| `--color-surface-2` | `#1A1E30` | Elevated cards |
| `--color-surface-3` | `#1F2438` | Highest elevation cards |
| `--color-border` | `#1E2440` | Standard borders |
| `--color-border-strong` | `#252B45` | Emphasized borders |
| sidebar | `#0F1124` | Sidebar background |
| surface-overlay | `#2A3050` | Overlay/modal backdrop |

#### Brand & Interactive

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#4F6DFF` | CTAs, active states, links |
| `--color-primary-hover` | `#3D5AE8` | Hover state |
| `--color-primary-active` | `#2E49D4` | Active/pressed state |
| `--color-primary-subtle` | `rgba(79,109,255,0.12)` | Tinted backgrounds |

#### Semantic Status Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#22D3A0` | Success, completed |
| `--color-warning` | `#F59E0B` | Warning, at risk |
| `--color-danger` | `#EF4444` | Danger, blocked, error |
| `--color-info` | `#60A5FA` | Information, moderate |

#### Operational Status Colors

| Status | Hex |
|--------|-----|
| Not Started | `#6B7494` |
| In Progress | `#4F6DFF` |
| Completed | `#22D3A0` |
| Blocked | `#EF4444` |
| At Risk | `#F59E0B` |
| Review | `#A855F7` |
| High Priority | `#EC4899` |
| Archived | `#1E2440` |

#### Risk Level Colors

| Level | Hex |
|-------|-----|
| Low Risk | `#22D3A0` |
| Moderate | `#60A5FA` |
| High Risk | `#F59E0B` |
| Critical | `#EF4444` |

#### Text Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#E8EAF2` | Page titles, body text, table data, input values |
| `--color-text-secondary` | `#9BA3C7` | Subtitles, descriptions, helper text |
| `--color-text-muted` | `#6B7494` | Placeholders, timestamps, metadata |
| `--color-text-disabled` | `#3A4060` | Disabled controls, inactive tabs |

### 2.3 Spacing

**Base unit**: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Icon internal padding, inline gap |
| `--space-2` | 8px | Badge padding, tight row gaps |
| `--space-3` | 12px | Button padding vertical, form field gap |
| `--space-4` | 16px | Card internal padding, section gap |
| `--space-5` | 20px | Table row height padding |
| `--space-6` | 24px | Content block gap, modal padding |
| `--space-8` | 32px | Section heading margin, card grid gap |
| `--space-10` | 40px | Page section separation |
| `--space-12` | 48px | Content area top padding |
| `--space-16` | 64px | Dashboard section margins |

### 2.4 Elevation

**Rule: No glow. No glassmorphism.**

| Level | Shadow | Usage |
|-------|--------|-------|
| None / Flat | No shadow. Border defines edge. | Sidebar items, table rows, inline elements |
| sm | `0 1px 3px rgba(0,0,0,0.3)` | Cards, form inputs, data cells |
| md | `0 2px 8px rgba(0,0,0,0.4)` | Dropdowns, popovers, tooltips |
| lg | `0 4px 16px rgba(0,0,0,0.5)` | Modals, command palette, drawer |
| overlay | `0 8px 32px rgba(0,0,0,0.6)` | Critical alerts, full-screen overlays |

### 2.5 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 2px | Status dots, micro indicators |
| `--radius-sm` | 4px | Badges, tags, chips, code blocks |
| `--radius-md` | 6px | Buttons, inputs, select controls, tabs |
| `--radius-lg` | 8px | Cards, panels, sidebar sections |
| `--radius-xl` | 12px | Modal containers, command palette |
| `--radius-pill` | 9999px | Navigation active pills, toggle switches only |

### 2.6 Motion

| Token | Value | Usage |
|-------|-------|-------|
| `--dur-instant` | 80ms | Hover fills, focus rings, active presses |
| `--dur-fast` | 150ms | Dropdown open, badge appear, tooltip show |
| `--dur-base` | 200ms | Modal enter/exit, drawer slide, tab switch |
| `--dur-slow` | 300ms | Page transitions, skeleton→content, chart animate |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | Default for all transitions |
| `--ease-decel` | `cubic-bezier(0,0,.2,1)` | Elements entering screen |
| `--ease-accel` | `cubic-bezier(.4,0,1,1)` | Elements leaving screen |

**Special Motion Rules:**
- Hover: 80ms ease, background color change only. **Never scale on hover for data elements.**
- Skeleton pulse: 1.4s infinite, opacity 0.4→0.7→0.4. **No shimmer. No gradient sweep.**
- `prefers-reduced-motion`: All transitions → 0ms. Skeleton → static. Charts → instant render.

### 2.7 Breakpoints & Accessibility

**Accessibility Requirements (WCAG AA):**
- Contrast: body text ≥4.5:1, large text ≥3:1, UI components ≥3:1
- Primary `#4F6DFF` on surface-1 `#151829` = 4.7:1 ✓
- Every interactive element reachable by Tab
- Focus order follows visual order
- Skip-to-content link present
- Command Palette (`Ctrl/Cmd+K`) = primary keyboard shortcut
- Focus ring: 2px indigo `#4F6DFF` outline + 2px offset. **Never `outline:none` without visible replacement.**
- All icons: `aria-label` or `aria-hidden`
- Status changes: `aria-live`
- Tables: proper `thead`/`th` with `scope`
- Modals: trap focus, restore on close
- Form errors: inline below field, `aria-describedby`, focus moves to first error on submit

**Dark Mode Rules:**
- Dark is independently designed, not inverted
- Chart gridlines: `1px rgba(255,255,255,0.06)`
- Borders: `--color-border` (#1E2440) standard, `--color-border-strong` (#252B45) emphasis
- **No pure black (#000000)** — darkest surface #080A16 has blue tint

---

## 3. Component Catalogue

### 3.1 Component Specifications (12 defined)

| Component | Specification |
|-----------|---------------|
| **Buttons** | 3 variants: Primary (filled indigo), Secondary (bordered), Ghost (text-only). One primary per view. Never >2 variants in same context. No gradient buttons. |
| **Inputs** | Single style. Dark surface bg, border all sides, indigo focus ring. Labels always above field (no floating). Error: red border + message below. |
| **Cards** | One style: surface-1 bg, 1px border, 8px radius. No drop shadows. Elevation through bg lightness. No hover effects that lift or scale. |
| **Tables** | Fixed header. Row separator only (no vertical grid). Alternating row optional for >12 cols. Headers: UPPERCASE 11px. Actions right-aligned. |
| **Badges/Tags** | Always semantic (color = meaning). Text + colored bg. 4px radius. No gradient. Width = content. No decorative badges. |
| **Dialogs/Modals** | Max 640px. Title + close in header. Actions bottom-right. Destructive bottom-left. Backdrop: 60% opacity. Animation: fade + 4px translateY only. |
| **Navigation** | Left sidebar: fixed 220px. Icon + label. Active: indigo left-border + subtle indigo bg tint. No active icon change. Section groups separated by 4px gap. |
| **Metrics/KPIs** | Large number (28px/500). Label above in 11px uppercase muted. Delta below. Sparkline optional. Never >6 KPI cards per row. |
| **Charts** | Minimal axes. No chart border. Gridlines: 1px 15% opacity. Legend for multi-series. Tooltip on hover. Empty: inline message, never spinner. |
| **Kanban** | Column headers in surface-2. Card: white title, secondary meta. Status badge. Priority: left border color. No card shadows. Drag: 4px opacity reduction. |
| **Command Palette** | Full-width centered, 640px max, 480px max-height. Groups with uppercase labels. Keyboard hint right-aligned. Active: indigo tint bg, no border. |
| **Empty States** | 20px Lucide icon, centered. 16px title (500). 14px description (muted). One CTA. No illustrations. No emoji. Background matches surface. |

### 3.2 Component Tiers (4 tiers, 55+ components)

**Tier 1 — Primitives** (build first):
Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Toggle/Switch, Badge, Tag/Chip, Avatar, Tooltip, Spinner, Skeleton, Divider, StatusDot, ProgressBar, Kbd

**Tier 2 — Composites** (requires primitives):
Card, MetricCard, FormField, SearchInput, DatePicker, MultiSelect, DropdownMenu, ContextMenu, Tabs, Breadcrumb, Pagination, Alert/Banner, Toast/Notification, EmptyState, UserProfile chip, FileUpload, RichTextEditor, CommentThread

**Tier 3 — Complex** (platform-specific):
DataTable, Modal/Dialog, Drawer/SlidePanel, CommandPalette, KanbanBoard, GanttChart, Timeline, Calendar, ChartWrapper, HeatmapGrid, ActivityFeed, ApprovalFlow, RiskMatrix, ResourceAllocationBar, BudgetTracker, DocumentViewer, AICopilotPanel, AuditLogViewer

**Tier 4 — Layout Templates**:
AppShell, DashboardLayout, ListDetailLayout, FullWidthLayout, ReadingLayout, AuthLayout, WizardLayout, SettingsLayout

### 3.3 Iconography

**Library**: Lucide Icons — outline only, 1.5px stroke

| Rule | Specification |
|------|---------------|
| Sizes | 16px (inline/nav), 18px (buttons), 20px (standalone), 24px (empty states only) |
| Stroke | 1.5px at all sizes. **Never 2px.** |
| Color | Inherit text color. Never independently colored unless semantic status. |
| Paired with text | 8px gap. Icon left of label. **Never icon-only for primary actions.** |
| Semantic icons | Status icons (check, x, alert-triangle, info) may carry semantic color. |
| Nav icons | Fixed per section. Active: color → primary, not icon change. |
| **Prohibited** | No emoji as icons. No filled variants. No custom SVG that doesn't match Lucide stroke. |

---

## 4. Layout Rules

### 4.1 Layout Tokens

| Token | Value | Rule |
|-------|-------|------|
| sidebar-width | 220px | Fixed. Collapsible to 60px (icon-only). Never fluid. |
| header-height | 48px | Fixed. Contains subnav tabs + global actions. |
| content-max-width | 1280px | Centered when viewport exceeds. |
| content-padding | 32px | Left/right within content area. |
| reading-width | 680px | Documents, forms, wizard steps. Never full-width prose. |
| panel-width | 380px | Right-side detail panels, drawers, preview panes. |
| table-min-col | 100px | Minimum before horizontal scroll. |

### 4.2 Page Template Grid Rules

| Template | Grid Specification |
|----------|-------------------|
| **Dashboard** | 12-column grid. KPI cards span 3 cols. Primary chart 8 cols. Side panel 4 cols. Activity feed 4 cols. |
| **CRUD / List** | Full-width table. Filter bar above. Toolbar right-aligned. Detail panel slides right on row click — never navigates away. |
| **Analytics** | Full-width canvas. No sidebar. Chart priority. Filter controls in sticky toolbar. |
| **Forms / Settings** | Reading width (680px). Single column. Section headers separate groups. Never two-column forms. |
| **Kanban** | Full horizontal scroll. Fixed 280px column width. Header sticky. No page padding — columns to edges. |

### 4.3 Dashboard Philosophy — The Three Zones

| Zone | Question | Content | Position |
|------|----------|---------|----------|
| 1 | "What happened?" | KPI metrics, trend deltas, activity feed. Max 6 metrics. Value + delta + trend. | Top of page |
| 2 | "What requires attention?" | At-risk, overdue, blocked, pending approvals. Amber/red semantic colors. | Never below the fold |
| 3 | "What should I do next?" | Recommended actions, AI suggestions, shortcuts. | After user has context. Never first. |

---

## 5. Implementation Rules (Non-Negotiables)

### Enterprise UX Rules — The 10 Commandments

1. **One Button Style per context** — Primary (indigo filled), Secondary (bordered), Ghost (text-only). Never gradient. Never page-specific variants.
2. **One Card Style** — surface-1 bg, 1px border, 8px radius, 16px padding. No exceptions. No special shadows/gradients/colored bg.
3. **One Table Style** — Fixed header. Row separators only. 40px standard / 32px compact. Actions right-aligned. No zebra striping default (only >12 cols).
4. **One Modal Style** — Max 640px. Standard header/body/footer. Primary bottom-right. Cancel left of primary. Destructive bottom-left. **No teal accent.**
5. **One Form Style** — Label above field. Full-width inputs. Helper text below. Error below (red, 12px). No floating labels. No inline editing default.
6. **One Navigation Style** — Sidebar: section groups, icon + label, indigo left-border active. No nested nav beyond 2 levels. Top subnav bar for within-section tabs only.
7. **One Empty State Style** — Lucide icon (24px, muted). Title (15px, 500). Description (13px, muted). One CTA. Centered. No illustrations. No emoji.
8. **One Loading Style** — Skeleton placeholders matching layout. **Never a spinner centered on page.** Spinners only in buttons (inline) and small contained components.
9. **Color is always semantic** — No color for visual interest. Every color communicates state/priority/status/role. If no information, remove it.
10. **No modal-on-modal stacking** — Modals never spawn secondary modals. Inline destructive confirmation within same modal.

### Implementation Order (from Bible)

1. Design Tokens → CSS custom properties file (1–2 days)
2. Tier 1 Primitives → Button, Input, Badge, Avatar, Tooltip, Skeleton, StatusDot (1 week)
3. AppShell → Sidebar + Header rebuild (3–4 days)
4. Tier 2 Composites → Card, Modal, Table, Form (1 week)
5. Dashboard → Mission Control rebuild, three-zone philosophy (1 week)
6. Tier 3 Complex → DataTable, Kanban, Calendar, Charts by usage frequency (2–4 weeks)
7. Polish → Motion, Empty States, Loading, Accessibility audit (1 week)
