# Resolve PM — Stage 3: Experience Ascent

## Phase Overview

**Stage 2** delivered infrastructure stability: deterministic lifecycle, aligned service contracts, zero-survivor cleanup, bulletproof recovery, and production-safe stress validation.

**Stage 3** transitions from "operationally stable" to "premium collaborative intelligence platform." Every investment targets velocity, clarity, and team energy — not feature bloat.

### Design Tenets

1. **Velocity over options** — reduce friction, not increase surface area
2. **Clarity over density** — more signal, less chrome
3. **Realtime as default** — stale data is a bug
4. **AI as operator** — surface what matters, generate nothing that doesn't
5. **Mobile is tactical** — approve, triage, communicate — not manage
6. **No regression** — Stage 2 guarantees (cleanup, lifecycle, observability) are non-negotiable

---

## 1. Architecture Plan

### Layer Map

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Dashboard │ │  Command  │ │  Boards  │ │  Mobile  │   │
│  │  Widgets  │ │  Palette  │ │  Views   │ │  Shell   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
├───────┴────────────┴────────────┴────────────┴─────────┤
│                   COMPOSITION LAYER                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Cards / │ │  Hooks   │ │Animation │ │  Layout  │   │
│  │  Widgets │ │  (shared)│ │Primitives│ │  System  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│                    REALTIME LAYER                         │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────┐ │
│  │  Supabase      │ │  Optimistic    │ │  Conflict    │ │
│  │  Realtime      │ │  Update Engine │ │  Resolution  │ │
│  └────────────────┘ └────────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────────┤
│                   DOMAIN SERVICES                         │
│  (Stage 2 — unchanged contract)                          │
├─────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE                          │
│  (Stage 2 — unchanged)                                   │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Widget-based dashboard | Isolated state, independent loading, parallel development |
| Shared hooks layer | `useRealtime`, `usePresence`, `useCommandPalette` avoid prop drilling |
| Optimistic UI with rollback | Every mutation updates local state immediately, reverts on server error |
| Real-time via Supabase subscriptions | No additional infrastructure; same auth/RLS boundary |
| Mobile as separate view shell | Prevents desktop compromises leaking into mobile experience |

---

## 2. UI Component Map

### New Widget Primitives (`src/components/widgets/`)

```
widgets/
├── WidgetCard.tsx            — base wrapper (title, loading, error, empty states)
├── WidgetGrid.tsx            — responsive grid layout with drag-reorder
├── WidgetHeader.tsx          — consistent header with actions menu
├── WidgetSkeleton.tsx        — loading skeleton
├── MetricTile.tsx            — single KPI display (value, label, trend, sparkline)
├── ActivityFeed.tsx          — realtime-scrollable event list
├── ActivityItem.tsx          — single event row (icon, actor, action, timestamp)
├── HealthBadge.tsx           — status indicator (healthy/warning/critical)
├── RiskMeter.tsx             — visual risk score (low/medium/high with gauge)
├── WorkloadBar.tsx           — horizontal bar showing allocation %
├── PresenceAvatar.tsx        — avatar with online/typing indicator
├── QuickActionButton.tsx     — icon + label action button
└── InsightCard.tsx           — AI-generated insight with confidence indicator
```

### Shared Hooks (`src/hooks/`)

```
hooks/
├── useRealtime.ts            — generic Supabase channel subscription
├── usePresence.ts            — online/typing/editing status for workspace
├── useCommandPalette.ts      — open/close + search state
├── useOptimistic.ts          — optimistic update with automatic rollback
├── useWidgetConfig.ts        — per-user widget layout/visibility
├── useActivityFeed.ts        — paginated realtime activity stream
├── useKeyboard.ts            — global keyboard shortcut registry
└── useMobileDetection.ts     — responsive breakpoint + input mode detection
```

### Animation Primitives (`src/lib/animation.ts`)

```
animate = {
  fadeIn,       — opacity 0→1
  slideUp,      — translateY 8→0
  slideIn,      — translateX -8→0
  scaleIn,      — scale 0.95→1
  stagger,      — sequential child delay
  pulse,        — attention attractor
  skeleton,     — shimmer loading
}
```

All animations use `prefers-reduced-motion` respect and `will-change` optimization.

---

## 3. Command Center Redesign Proposal

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  HEADER                                                  │
│  ┌──────┐ ┌──────────────────────────┐ ┌──────────┐   │
│  │ Logo │ │  Breadcrumb / Workspace  │ │  Profile  │   │
│  └──────┘ └──────────────────────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│  PRIMARY NAV (left rail, collapsible)                    │
│  Dashboard • Boards • Projects • Teams • Calendar      │
│  Integrations • Settings                                 │
├─────────────────────────────────────────────────────────┤
│  COMMAND CENTER (main content area)                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  WORKSPACE HEALTH ROW (3 MetricTiles)            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │
│  │  │ Risk     │ │ Overdue  │ │ Sprint   │         │   │
│  │  │ Score    │ │ Tasks    │ │ Velocity │         │   │
│  │  └──────────┘ └──────────┘ └──────────┘         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────┬──────────────────────────────────┐   │
│  │  AI INSIGHTS  │  LIVE ACTIVITY STREAM             │   │
│  │  Panel        │  (realtime scrolling feed)        │   │
│  │               │                                    │   │
│  │  • Blockers   │  • task moved to In Progress      │   │
│  │  • Risks      │  • sprint v2.3 completed          │   │
│  │  • Overdue    │  • automation 'autoclose' fired   │   │
│  │  • Suggest    │  • approval #42 approved          │   │
│  │               │  • comment from @jane             │   │
│  └───────────────┴──────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  TEAM RADAR                                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │ User 1   │ │ User 2   │ │ User 3   │          │   │
│  │  │ 80% load │ │ BLOCKED  │ │ 45% load │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  QUICK ACTIONS RAIL (bottom/floating)                    │
│  [+ Task] [+ Project] [Trigger] [Cmd+K] [AI Summary]   │
└─────────────────────────────────────────────────────────┘
```

### Workspace Health

Three `MetricTile` components at the top of the command center:

| Metric | Source | Refresh |
|--------|--------|---------|
| Risk Score | Weighted sum of overdue tasks + blocked tasks + drift | Realtime |
| Overdue Tasks | Tasks with `due_date < now()` and `status != 'done'` | Realtime |
| Sprint Velocity | Running avg of story points completed in last 3 sprints | On sprint end |

Clicking any tile navigates to the relevant filtered view.

### Live Activity Stream

- Single-column scrollable feed
- Entries arrive via Supabase subscription on `activity_logs` INSERT
- Actor avatar + action verb + target + relative timestamp
- Clickable: clicking a task reference opens the task
- Auto-scrolls to top; pauses on manual scroll-up

### Team Radar

- Horizontal list of user workload cards
- Each card shows: name, workload percentage, status indicator (normal/warning/critical)
- Blocked users show a red icon
- Overloaded users (>85% allocation) show warning
- Click navigates to user's task list

### Quick Actions Rail

Floating bottom bar with icon buttons:

| Action | Shortcut | Behavior |
|--------|----------|----------|
| New Task | `t` | Opens task creation modal |
| New Project | `p` | Opens project creation modal |
| Trigger | `Ctrl+Enter` | Opens automation trigger dialog |
| Command Palette | `Cmd+K` | Opens universal command palette |
| AI Summary | `Ctrl+.` | Generates AI workspace summary |

### AI Insights Panel

Compact card list, each with:

- Icon indicating insight type (blocker/risk/overdue/suggestion)
- One-line summary
- Confidence indicator (low/med/high)
- Action button ("View tasks" / "Review" / "Dismiss")

---

## 4. Realtime Architecture Proposal

### Subscription Model

```
┌──────────────┐     ┌───────────────────┐     ┌─────────────┐
│  Supabase    │────▶│  useRealtime      │────▶│  Widget     │
│  Realtime    │     │  (generic hook)   │     │  State      │
│  Channel     │     │                   │     │             │
│              │     │  - connect        │     │  - loading  │
│              │     │  - reconnect      │     │  - data     │
│              │     │  - filter         │     │  - error    │
│              │     │  - debounce       │     │  - empty    │
│              │     │  - cleanup        │     │             │
│              │     │  - retry          │     │             │
└──────────────┘     └───────────────────┘     └─────────────┘
```

### Channels

| Channel | Table | Filter | Used By |
|---------|-------|--------|---------|
| `activity:{wsId}` | activity_logs | `workspace_id=eq.{wsId}` | Activity Feed |
| `tasks:{wsId}` | tasks | `workspace_id=eq.{wsId}` | Boards, Radar |
| `presence:{wsId}` | (presence channel) | — | Presence Avatars |
| `approvals:{wsId}` | approval_instances | via chain_id | Approvals Widget |

### Optimistic Update Engine

```
User Action
  → Update local state immediately (skeleton → data)
  → Fire Supabase mutation in background
  → On success: confirm state, no visual flash
  → On error: rollback to previous state, show inline error
  → On timeout (5s): show "saving..." indicator, retry
```

### Reconnection Strategy

- Exponential backoff: 1s, 2s, 4s, 8s, max 30s
- On reconnect: full state sync via `SELECT` + resume subscription
- Pending optimistic mutations retried automatically
- Users see a subtle "Reconnecting..." banner after 5s of disconnect

### Conflict Safety

- Supabase RLS is the single source of truth
- Optimistic updates are overwritten on server mismatch
- No client-side conflict resolution needed (RLS + `ON CONFLICT` handles it)

---

## 5. AI Integration Strategy

### Principles

1. **AI surfaces, never creates noise** — every AI output must have a clear operational purpose
2. **Confidence matters** — always show confidence level (low/med/high) alongside AI output
3. **One-click actionability** — every insight has a button to act on it
4. **Context window is the workspace** — AI never sees data outside the user's workspace

### Services

```
src/services/ai/
├── aiBlockers.ts         — detect blocked tasks and suggest unblock actions
├── aiRisks.ts            — project health risk analysis
├── aiSprintSummary.ts    — generate sprint retrospectives
├── aiOverdueCluster.ts   — group overdue tasks by root cause
├── aiWorkload.ts         — detect workload imbalance
├── aiRecommendation.ts   — suggest automation rules, config changes
└── aiTaskAssistant.ts    — help write task descriptions, acceptance criteria
```

### Gemini Integration

All AI operations route through the existing `GEMINI_API_KEY` infrastructure. Each call includes:

- Workspace context (projects, tasks, users, sprint state)
- Explicit instruction prompt (no freeform generation)
- Output schema (structured JSON, validated before display)

### Rate Limiting

- AI calls are debounced: max 1 call per 10 seconds per user
- AI insights panel refreshes on demand, not automatically
- Cache results in memory for 5 minutes

---

## 6. Mobile Strategy

### Separation Principle

Mobile is a **tactical shell**, not a responsive desktop. Routes, components, and interactions are purpose-built for mobile workflows.

### Mobile Routes

| Route | Purpose |
|-------|---------|
| `/mobile/approvals` | Approve/reject with single tap |
| `/mobile/notifications` | Prioritized notification list |
| `/mobile/tasks/:id` | Quick status update, comment, assign |
| `/mobile/sprints/:id` | Velocity, burndown, remaining work |
| `/mobile/search` | Command palette entry |

### Mobile Component Library

```
src/components/mobile/
├── MobileShell.tsx          — nav + header layout
├── ApprovalCard.tsx         — swipe-to-approve/reject
├── NotificationRow.tsx      — priority-coded notification
├── QuickTaskDrawer.tsx      — bottom sheet for task update
├── SprintMini.tsx           — compact sprint health card
└── MobileCommandBar.tsx     — persistent bottom command input
```

### What Mobile Does NOT Do

- No gantt charts
- No dense tables
- No drag-and-drop board
- No workspace configuration
- No integration management

---

## 7. Implementation Priority Order

### Phase 3A — Foundation (Weeks 1-2)

| Item | Effort | Impact |
|------|--------|--------|
| Shared hooks: `useRealtime`, `usePresence`, `useOptimistic`, `useKeyboard` | 4 days | Enables everything downstream |
| Animation primitives library | 1 day | Consistent motion across all new UI |
| WidgetCard/WidgetGrid base components | 2 days | Reusable widget shell |
| Command palette: fuzzy search, grouped commands, slash commands | 3 days | Universal navigation layer |
| Keyboard shortcut registry | 1 day | Power-user velocity |

### Phase 3B — Command Center (Weeks 3-4)

| Item | Effort | Impact |
|------|--------|--------|
| Workspace Health row (3 MetricTiles) | 2 days | At-a-glance state |
| Live Activity Stream + realtime subscription | 3 days | Realtime feel |
| Quick Actions Rail | 1 day | Reduced friction |
| Team Radar | 2 days | People awareness |
| AI Insights Panel shell | 2 days | Intelligence surface |

### Phase 3C — AI Intelligence (Weeks 5-6)

| Item | Effort | Impact |
|------|--------|--------|
| AI blocker detection | 2 days | Unblock teams faster |
| AI risk analysis | 2 days | Prevent surprises |
| AI sprint summary | 2 days | Reduce retro overhead |
| AI overdue clustering | 1 day | Pattern recognition |
| AI workload imbalance | 1 day | Team health |

### Phase 3D — Realtime & Polish (Weeks 7-8)

| Item | Effort | Impact |
|------|--------|--------|
| Presence indicators + typing | 2 days | Collaboration feel |
| Realtime board updates | 2 days | Live collaboration |
| Optimistic UI on task/project mutations | 3 days | Instant feel |
| Mobile tactical shell | 3 days | Mobile coverage |
| Smart notifications with grouping | 2 days | Signal over noise |

### Phase 3E — UX Polish Pass (Week 9)

| Item | Effort | Impact |
|------|--------|--------|
| Skeleton loading states | 1 day | Perceived performance |
| Empty states for all widgets | 1 day | Onboarding clarity |
| Hover/focus state audit | 1 day | Interaction quality |
| Transition smoothness audit | 1 day | Premium feel |
| Responsive behavior check | 1 day | Device coverage |

---

## 8. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Realtime subscriptions degrade dashboard performance | Medium | High | `useRealtime` disconnects when widget is not visible; debounce high-frequency events |
| AI latency blocks UI | Low | Medium | All AI calls are non-blocking; insights panel shows loading skeleton |
| Optimistic updates cause visual flicker on rollback | Medium | Low | Use CSS transition for rollback (0.3s fade); show inline error |
| Mobile scope creep | High | Medium | Strict mobile-only component library; no reuse of desktop components |
| Real-time reconnection storm on network recovery | Low | Medium | Staggered reconnection with jitter; full state sync debounced |
| Stage 2 cleanup regression | Very Low | Critical | All new components use existing domain services; no new DB write paths bypass cleanup |
| Command palette performance on large datasets | Medium | Medium | Virtualize results list; debounce input; limit results to 50 |

---

## 9. Suggested Component Structure

```
src/
├── components/
│   ├── widgets/           — Stage 3 widget primitives
│   │   ├── WidgetCard.tsx
│   │   ├── WidgetGrid.tsx
│   │   ├── MetricTile.tsx
│   │   ├── ActivityFeed.tsx
│   │   ├── ActivityItem.tsx
│   │   ├── HealthBadge.tsx
│   │   ├── RiskMeter.tsx
│   │   ├── WorkloadBar.tsx
│   │   ├── PresenceAvatar.tsx
│   │   ├── QuickActionButton.tsx
│   │   └── InsightCard.tsx
│   ├── dashboard/         — Command center implementation
│   │   ├── CommandCenter.tsx
│   │   ├── WorkspaceHealth.tsx
│   │   ├── ActivityStream.tsx
│   │   ├── TeamRadar.tsx
│   │   ├── QuickActions.tsx
│   │   ├── AIInsights.tsx
│   │   └── DashboardSkeleton.tsx
│   ├── command/           — Command palette
│   │   ├── CommandPalette.tsx
│   │   ├── CommandGroup.tsx
│   │   ├── CommandItem.tsx
│   │   ├── CommandInput.tsx
│   │   ├── SlashCommands.tsx
│   │   └── RecentActions.tsx
│   ├── realtime/          — Realtime UI components
│   │   ├── PresenceProvider.tsx
│   │   ├── TypingIndicator.tsx
│   │   ├── LiveBadge.tsx
│   │   └── ReconnectionBanner.tsx
│   ├── mobile/            — Mobile tactical shell
│   │   ├── MobileShell.tsx
│   │   ├── ApprovalCard.tsx
│   │   ├── NotificationRow.tsx
│   │   ├── QuickTaskDrawer.tsx
│   │   ├── SprintMini.tsx
│   │   └── MobileCommandBar.tsx
│   └── notifications/     — Smart notification system
│       ├── NotificationProvider.tsx
│       ├── NotificationGroup.tsx
│       ├── NotificationToast.tsx
│       └── NotificationDigest.tsx
├── hooks/
│   ├── useRealtime.ts
│   ├── usePresence.ts
│   ├── useCommandPalette.ts
│   ├── useOptimistic.ts
│   ├── useWidgetConfig.ts
│   ├── useActivityFeed.ts
│   ├── useKeyboard.ts
│   └── useMobileDetection.ts
├── services/
│   ├── ai/
│   │   ├── aiBlockers.ts
│   │   ├── aiRisks.ts
│   │   ├── aiSprintSummary.ts
│   │   ├── aiOverdueCluster.ts
│   │   ├── aiWorkload.ts
│   │   ├── aiRecommendation.ts
│   │   └── aiTaskAssistant.ts
│   └── notifications/
│       ├── notificationEngine.ts
│       └── notificationDigest.ts
└── lib/
    ├── animation.ts       — Animation primitives
    └── keyboard.ts        — Keyboard shortcut registry
```

---

## 10. Phased Rollout Plan

### Rollout Gate Criteria

Each phase must pass before the next begins:

- **Phase 3A**: All hooks documented + test coverage >80%; command palette functional with keyboard-only navigation
- **Phase 3B**: Dashboard loads < 2s with all widgets; activity feed shows realtime events within 500ms
- **Phase 3C**: AI insights show correct data for 3 test workspaces; confidence ratings match manual evaluation
- **Phase 3D**: Optimistic UI rollback tested with network disconnection; mobile shell passes Lighthouse mobile audit
- **Phase 3E**: No visual regressions against Stage 2 screenshots; all empty states render correctly

### Rollback Plan

If any phase introduces a regression:

1. Revert the feature flag (`features/stage3-{phase}`)
2. Stage 2 UI remains fully functional
3. Fix without pressure, re-flag when ready

### Feature Flags

```
features/
├── command-center     — Phase 3B dashboard overhaul
├── command-palette    — Phase 3A command palette evolution
├── realtime           — Phase 3D realtime subscriptions
├── ai-insights        — Phase 3C AI intelligence layer
├── mobile-shell       — Phase 3D mobile routes
├── smart-notifications — Phase 3D notification engine
└── ux-polish          — Phase 3E visual audit
```

All flags default to `false` in production. Stage 2 UI is the fallback for every flag.

---

## Appendix A: Stage 2 Guarantee Checklist

Before any Stage 3 code is merged:

- [ ] `stressTest` lifecycle passes with `cleanup.success === true`
- [ ] `orphanCount === 0` on tiny validation profile
- [ ] No new direct `supabase.from().insert()` calls (must go through domain services)
- [ ] All new files have corresponding cleanup paths if they create DB records
- [ ] `appendLog` graceful degradation path exercised
- [ ] Lock system tested with forced browser close + recovery

---

## Appendix B: Success Metrics

| Metric | Current | Stage 3 Target |
|--------|---------|----------------|
| Dashboard load time | ~300ms | < 500ms with widgets |
| Command palette open-to-result | ~300ms | < 150ms |
| Activity feed latency | N/A | < 500ms from event to display |
| AI insight relevance | N/A | >80% user keep rate |
| Mobile approval complete | N/A | < 10s from open to approve |
| Notification click-through | N/A | >30% |
| Time to create task | ~15s | < 5s via command palette |
| Time to find project | ~8s | < 2s via command palette |
