---
name: Logistics Core
colors:
  surface: '#fbf9fa'
  surface-dim: '#dbd9db'
  surface-bright: '#fbf9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f4'
  surface-container: '#efedef'
  surface-container-high: '#e9e7e9'
  surface-container-highest: '#e4e2e3'
  on-surface: '#1b1c1d'
  on-surface-variant: '#44474c'
  inverse-surface: '#303032'
  inverse-on-surface: '#f2f0f2'
  outline: '#74777d'
  outline-variant: '#c4c6cd'
  surface-tint: '#4f6073'
  primary: '#041627'
  on-primary: '#ffffff'
  primary-container: '#1a2b3c'
  on-primary-container: '#8192a7'
  inverse-primary: '#b7c8de'
  secondary: '#0453cd'
  on-secondary: '#ffffff'
  secondary-container: '#356ee7'
  on-secondary-container: '#fefcff'
  tertiary: '#001a0e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00311e'
  on-tertiary-container: '#20a571'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4fb'
  primary-fixed-dim: '#b7c8de'
  on-primary-fixed: '#0b1d2d'
  on-primary-fixed-variant: '#38485a'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b2c5ff'
  on-secondary-fixed: '#001848'
  on-secondary-fixed-variant: '#0040a2'
  tertiary-fixed: '#82f9be'
  tertiary-fixed-dim: '#65dca4'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005235'
  background: '#fbf9fa'
  on-background: '#1b1c1d'
  surface-variant: '#e4e2e3'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is engineered for high-stakes logistics environments where precision, reliability, and speed are paramount. The target audience includes import managers, logistics coordinators, and supply chain analysts who require a tool that reduces cognitive load while handling dense data sets.

The design style is **Corporate / Modern** with a focus on functional clarity. It prioritizes a systematic layout over decorative elements, ensuring that the UI feels authoritative and stable. By utilizing a "content-first" approach, the design system minimizes distractions, allowing users to focus on exception management and workflow progression. The emotional response should be one of "controlled efficiency"—the user should feel that the system is an extension of their professional expertise.

## Colors

The palette is anchored in trust and clarity. 

- **Primary (#1A2B3C):** Used for structural elements like the global navigation sidebar and high-level headers to provide a grounded, professional frame.
- **Accent (#0052CC):** Reserved for primary calls to action, active states, and interactive links to guide the user's eye toward movement.
- **Semantic Palette:** Success Green (#36B37E) and Warning Orange (#FFAB00) are utilized strictly for status indication and alerts to ensure they retain their urgency.
- **Neutral Greys:** A tiered grey scale is used for surface backgrounds, borders, and secondary text to create clear visual hierarchy in data-heavy views.

**Dark Mode Implementation:** In dark mode, the neutral backgrounds shift to deep charcoal tones, while the primary navy remains the anchor. Text contrast is adjusted to meet WCAG AA standards, ensuring readability for late-night operational monitoring.

## Typography

This design system utilizes **Inter** for its exceptional legibility and systematic feel. The type scale is optimized for information density.

- **Data Tables:** Use `body-md` for standard cell content. For numerical values, tracking numbers, or IDs, use `mono-data` with tabular lining figures enabled to ensure columns of numbers align perfectly for easy scanning.
- **KPIs:** Large numeric displays on dashboards should use `display-lg` to ensure key metrics are visible at a glance.
- **Labels:** Small, uppercase labels with slightly increased letter spacing are used for table headers and form field captions to differentiate them from user-generated content.
- **Mobile Adjustments:** `display-lg` should scale down to 24px (`headline-md`) on mobile devices to preserve screen real estate.

## Layout & Spacing

This design system follows a **Fixed-Fluid Hybrid Grid**. The sidebar is a fixed width (240px), while the main content area utilizes a 12-column fluid grid.

- **Rhythm:** A 4px baseline grid ensures consistent vertical rhythm. Standard spacing between components (stacking) is typically 16px or 24px.
- **Data Density:** In tables, a "Compact" mode is supported where vertical padding is reduced to 8px, allowing more rows to be visible above the fold.
- **Breakpoints:**
  - **Desktop (1440px+):** Full 12-column layout with 24px margins.
  - **Tablet (768px - 1024px):** Sidebar collapses to an icon-only rail (64px). Content margins reduce to 16px.
  - **Mobile (<768px):** Single-column layout. Horizontal scrolling is enabled for data tables to preserve data integrity.

## Elevation & Depth

This design system uses **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows to maintain a clean, professional aesthetic.

- **Surface 0:** The main application background (Neutral Grey).
- **Surface 1:** Primary cards and containers. These use a 1px solid border (#DFE1E6) to define their boundaries.
- **Surface 2:** Modals and fly-out panels. These utilize a soft, ambient shadow (0px 4px 12px rgba(0,0,0,0.08)) to indicate they are "floating" above the workspace.
- **Interactive States:** Buttons and clickable cards do not use elevation to show hover; instead, they use subtle background color shifts (e.g., Primary Navy shifts to a slightly lighter tint on hover).

## Shapes

The shape language is **Soft** but structured. 

- **Standard Radius (0.25rem):** Used for buttons, input fields, and status badges. This provides a modern touch without looking overly "playful" or consumer-grade.
- **Container Radius (0.5rem):** Used for dashboard cards and modal windows to provide a clear distinction between the container and the elements within it.
- **Status Pills:** Status badges utilize a fully rounded (pill) shape to distinguish them from interactive buttons.

## Components

- **Data Tables:** The core of the TMS. Headers should be sticky. Row hover states are mandatory. Include a "Filter Bar" pinned to the top of the table card with clear, chip-based active filters.
- **Status Badges:** Use subtle background tints with bold text for high readability (e.g., Success Green background at 15% opacity with 100% opacity text).
- **Multi-Step Progress Bars:** Use a horizontal line with numbered nodes. Completed steps use the Success Green; the active step uses Professional Blue; pending steps use Neutral Grey.
- **Buttons:**
  - **Primary:** Solid Professional Blue.
  - **Secondary:** Outlined Neutral Grey.
  - **Destructive:** Outlined Red (use sparingly).
- **Dashboard Widgets:** Use a standard card format with a header area for the title and a right-aligned "Actions" menu (e.g., Expand, Export).
- **Input Fields:** Use 1px borders with clear focus states using the Professional Blue color. Labels must always be visible (avoid placeholder-only labels for accessibility).