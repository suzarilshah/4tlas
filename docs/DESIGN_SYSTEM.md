# 4tlas Design System
## Apple Human Interface Guidelines Implementation

**Version:** 1.0.0
**Status:** Draft
**Maintainer:** Design System Architect

---

## 1. Foundations

### Color System
Our color system is built on trust, precision, and clarity, essential for threat intelligence.

#### Primary Palette
| Name | Hex | RGB | HSL | Usage | Accessibility |
|------|-----|-----|-----|-------|---------------|
| **Deep Space** | `#0B0C10` | `11, 12, 16` | `228, 19%, 5%` | Global Background | AAA (w/ White) |
| **Gunmetal** | `#1F2833` | `31, 40, 51` | `213, 24%, 16%` | Cards, Panels | AAA (w/ White) |
| **Slate** | `#C5C6C7` | `197, 198, 199` | `210, 2%, 78%` | Secondary Text | AA (on Dark) |
| **Neon Blue** | `#66FCF1` | `102, 252, 241` | `176, 96%, 69%` | Primary Actions, Highlights | AA (on Dark) |
| **Teal** | `#45A29E` | `69, 162, 158` | `177, 40%, 45%` | Secondary Actions, Accents | AA (on Dark) |
| **White** | `#FFFFFF` | `255, 255, 255` | `0, 0%, 100%` | Primary Text | AAA (on Dark) |

#### Semantic Colors
*   **Success**: `#28C76F` (Operation success, safe zones)
*   **Warning**: `#FF9F43` (Potential threats, alerts)
*   **Error**: `#EA5455` (Critical threats, failures)
*   **Info**: `#00CFDD` (Neutral data points)

#### Dark Mode Equivalents
*Designed primarily for dark mode. Light mode is inverted with reduced saturation.*

### Typography
Font Family: **SF Pro Display** (Mac/iOS) / **Inter** (Web fallback)

| Role | Weight | Size (Desktop) | Line Height | Letter Spacing |
|------|--------|----------------|-------------|----------------|
| **Display** | 800 (Heavy) | 48px | 56px | -0.02em |
| **Headline** | 700 (Bold) | 32px | 40px | -0.01em |
| **Title 1** | 600 (SemiBold) | 24px | 32px | -0.01em |
| **Title 2** | 600 (SemiBold) | 20px | 28px | 0 |
| **Body** | 400 (Regular) | 16px | 24px | 0 |
| **Callout** | 500 (Medium) | 15px | 22px | 0 |
| **Subhead** | 600 (SemiBold) | 14px | 20px | 0.01em |
| **Footnote** | 400 (Regular) | 13px | 18px | 0.01em |
| **Caption** | 400 (Regular) | 12px | 16px | 0.02em |

### Layout Grid
*   **Desktop (1440px+)**: 12 Columns, 24px Gutter, 48px Margin
*   **Tablet (768px-1439px)**: 8 Columns, 16px Gutter, 32px Margin
*   **Mobile (<768px)**: 4 Columns, 16px Gutter, 16px Margin

### Spacing System
Base unit: **8px**

| Token | Size | Usage |
|-------|------|-------|
| `space-4` | 4px | Tight grouping (icon + text) |
| `space-8` | 8px | Standard component padding |
| `space-12` | 12px | Vertical list item spacing |
| `space-16` | 16px | Section padding, Card gaps |
| `space-24` | 24px | Major component separation |
| `space-32` | 32px | Container padding |
| `space-48` | 48px | Section breaks |
| `space-64` | 64px | Layout breaks |

---

## 2. Components

### Navigation
*   **Global Header**: Fixed height 64px, frosted glass effect (`backdrop-filter: blur(20px)`). Contains branding, global search, and user profile.
*   **Sidebar**: Collapsible, 240px width (expanded) / 64px (collapsed). Icons with tooltips on collapse.
*   **Tabs**: Pill-shaped active state (`Neon Blue`), ghost inactive state (`Slate`).

### Input
*   **Primary Button**: Solid `Neon Blue`, Black text, 8px radius. Hover: Brightness 110%.
*   **Secondary Button**: Border `Neon Blue` 1px, Transparent fill, Neon Blue text.
*   **Ghost Button**: Transparent fill, White text. Hover: `Gunmetal` bg.
*   **Text Field**: `Gunmetal` background, `Slate` border 1px (focus: `Neon Blue`), 8px radius. Label outside (top).
*   **Toggle Switch**: iOS-style. Active: `Neon Blue`, Inactive: `Slate` (dimmed).

### Data Display
*   **Dashboard Card**: `Gunmetal` background, `space-16` padding, 12px radius, subtle shadow (`0 4px 6px rgba(0,0,0,0.3)`).
*   **Live Feed List**: Virtualized list, compact rows (`48px` height), hover reveals quick actions.
*   **Metric Stat**: Label (`Caption`, Slate), Value (`Title 1`, White), Trend Indicator (Success/Error color).
*   **Table**: Minimalist. `Gunmetal` rows, `Slate` headers. Hover row: `Gunmetal` (lightened 5%).

### Feedback
*   **Toast**: Floating notification (top-right), 8px radius, accent border left. Auto-dismiss 4s.
*   **Skeleton**: Shimmer effect on `Gunmetal` + 10% lightness. Matches text line heights.
*   **Modal**: Centered, backdrop blur (`10px`), `Gunmetal` bg, scale-in animation.

---

## 3. Patterns

### Dashboard Template
*   **Header**: Global context.
*   **Grid**: Masonry or defined grid layout.
*   **Widgets**: Draggable, resizable cards.
*   **Map Layer**: Underlay or dedicated panel.

### Search Flow
1.  **Trigger**: `Cmd+K` or Search Icon.
2.  **Modal**: Centered overlay, 600px max-width.
3.  **Recent**: Show last 5 queries.
4.  **Results**: Categorized (Countries, Events, Signals). Live filtering.

---

## 4. Tokens (JSON)

*(See `src/styles/tokens.json` for full implementation)*

---

## 5. Documentation & Guidelines

### Core Principles
1.  **Deference to Content**: The UI should recede. Content (intelligence data) is king. Use blurring and translucency to maintain context without distraction.
2.  **Clarity**: Typography must be legible at a glance. High contrast for critical alerts, subtle contrast for hierarchy.
3.  **Depth**: Use layering (z-index, shadows, blurring) to establish hierarchy. The map is the "ground" truth; panels float above it.

### Do's and Don'ts

1.  **Do**: Use `Neon Blue` sparingly for primary actions or critical live updates.
    *   *Visual*: A single "Deploy" button in blue against a dark form.
2.  **Don't**: Use the primary color for large background areas.
    *   *Visual*: A card with a full neon blue background (causes eye fatigue).
3.  **Do**: Use standard 8px grid alignment for all components.
    *   *Visual*: Buttons and inputs aligned perfectly to the grid lines.
4.  **Don't**: Use arbitrary padding numbers like 7px or 13px.
    *   *Visual*: Elements that look slightly "off" or jittery.
5.  **Do**: Ensure touch targets are at least 44x44px on mobile.
    *   *Visual*: A button that is easy to tap with a thumb.
6.  **Don't**: Use tiny links or buttons close together on touch interfaces.
    *   *Visual*: "Edit" and "Delete" icons overlapping or too close.
7.  **Do**: Use "Skeleton" states for loading data.
    *   *Visual*: Gray shimmering bars replacing text while data fetches.
8.  **Don't**: Use generic "Loading..." text or blocking spinners for minor updates.
    *   *Visual*: A modal spinner blocking the whole screen for a small chart update.
9.  **Do**: Use semantic colors (Red/Green) only for status/sentiment.
    *   *Visual*: A stock ticker showing green for up, red for down.
10. **Don't**: Use red or green for decorative elements unrelated to status.
    *   *Visual*: A red header bar just for style (confusingly implies error).

### Implementation Guide

1.  **CSS Variables**: All values are defined in `src/styles/design-system.css`. Use `var(--color-neon-blue)` instead of hex codes.
2.  **Typography**: Use utility classes `.text-h1`, `.text-body` defined in `design-system.css`.
3.  **Components**: Extend the base `Panel` class and apply `.card-glass` for standard panel styling.
4.  **Dark Mode**: The system defaults to dark mode. Light mode overrides are handled via `[data-theme="light"]`.

---
