---
name: Resolve Command
colors:
  surface: '#121416'
  surface-dim: '#121416'
  surface-bright: '#37393b'
  surface-container-lowest: '#0c0e10'
  surface-container-low: '#1a1c1e'
  surface-container: '#1e2022'
  surface-container-high: '#282a2c'
  surface-container-highest: '#333537'
  on-surface: '#e2e2e5'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e2e2e5'
  inverse-on-surface: '#2f3133'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#c3c6d5'
  on-secondary: '#2c303c'
  secondary-container: '#434653'
  on-secondary-container: '#b1b4c3'
  tertiary: '#ffb783'
  on-tertiary: '#4f2500'
  tertiary-container: '#d97721'
  on-tertiary-container: '#452000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#dfe2f1'
  secondary-fixed-dim: '#c3c6d5'
  on-secondary-fixed: '#171b26'
  on-secondary-fixed-variant: '#434653'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#121416'
  on-background: '#e2e2e5'
  surface-variant: '#333537'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 32px
  stack-gap-lg: 24px
  stack-gap-md: 16px
  stack-gap-sm: 8px
  grid-columns: '12'
  grid-gutter: 24px
---

## Brand & Style

The design system is an "industrial-grade" framework designed for high-stakes enterprise project management. It prioritizes a **Strategic, Calm, and Tactical** personality, evoking the precision of a mission control interface. The aesthetic is rooted in **Modern Corporate** values with a heavy lean toward **Minimalism** and **Tonal Layering**.

The target audience is executive leadership and technical operations managers who require immediate clarity across complex data streams. The UI avoids "startup" playfulness in favor of a sophisticated, "expensive" feel characterized by deep neutral tones, high-precision typography, and purposeful whitespace. It creates a sense of stability and institutional trust.

## Colors

The palette is anchored in a monochromatic range of deep graphites and charcols to minimize cognitive load.
- **Primary Actions:** Soft Indigo (#6366F1) is reserved for high-priority interactions and active states.
- **Surface Strategy:** Layers are built using #1A1C1E as the base, with #2D2E32 and #3F4045 serving as elevated container levels.
- **Operational Indicators:** Muted emerald and cyan are used strictly for status health (e.g., "Operational," "On Track"). They must be desaturated to maintain the tactical mood.
- **Restraint:** No vibrant gradients are permitted. Color is used as a functional signal, not as decoration.

## Typography

This design system utilizes a dual-font strategy to balance executive legibility with technical precision.
- **Geist (Sans):** Used for all primary UI elements, headings, and body copy. It provides a modern, neutral, and high-quality feel.
- **JetBrains Mono:** Reserved for telemetry, timestamps, technical metadata, and ID strings. This reinforces the "industrial" nature of the platform.
- **Hierarchy:** Large display sizes should use tight letter-spacing. Labels in monospace should be all-caps with slight tracking for increased scannability at small sizes.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for dashboard views to ensure predictable data visualization.
- **Rhythm:** A 4px baseline grid governs all spacing. 
- **Density:** While data density is high, we maintain a "breathable" rhythm through 32px outer margins and 24px internal gutters.
- **Structure:** Use a 12-column system for desktop. Sidebars are fixed at 240px or 280px depending on the navigation depth.
- **Reflow:** On smaller viewports, the 12-column grid collapses into a single column, with padding reducing from 32px to 16px to maximize screen real estate.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Ambient Shadows** rather than high-contrast borders.
- **Base Level:** #1A1C1E (The canvas).
- **Level 1 (Cards/Panels):** #2D2E32. Subtle shadow: `0 4px 12px rgba(0, 0, 0, 0.4)`.
- **Level 2 (Popovers/Modals):** #3F4045. More pronounced shadow: `0 12px 32px rgba(0, 0, 0, 0.6)`.
- **Borders:** Use low-opacity inner strokes (1px, `rgba(255, 255, 255, 0.05)`) to define edges on dark surfaces without creating visual noise.

## Shapes

The design system uses a **Rounded** shape language to soften the industrial aesthetic, ensuring it feels premium and modern.
- **Standard Cards:** 12px (`rounded-lg`) radius.
- **Input Fields/Buttons:** 8px (`rounded-md`) radius.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Large Sections:** 16px (`rounded-xl`) radius for major layout containers.

## Components

- **Buttons:** Primary buttons use #6366F1 with white text. Secondary buttons use a ghost style (transparent fill with #3F4045 border).
- **Cards:** Must feature subtle top-down lighting (1px semi-transparent top border) to reinforce elevation. 
- **Telemetry Chips:** Use monospace font for the value and a small dot for status. Backgrounds should be muted versions of the status color (e.g., 10% opacity emerald).
- **Input Fields:** Deep graphite background with a 1px slate border that glows Indigo on focus.
- **KPI Widgets:** Feature "Operational Pulse" sparklines. These should be simplified, monochromatic lines (indigo or slate) to show trends without cluttering the view.
- **Navigation:** Vertical sidebar with active states indicated by a subtle indigo left-accent bar and a low-opacity indigo background tint.