# AdFounder Design System

## Core Principle

AdFounder is a **mobile-first web app**. Every screen must be designed and built for small screens first, then progressively enhanced for desktop. Founders manage their ad spaces, check earnings, and browse the marketplace from phones as often as laptops.

## Breakpoints

| Name     | Width     | Target                |
| -------- | --------- | --------------------- |
| Mobile   | < 640px   | Phones                |
| Tablet   | 640–1024px | Tablets, large phones |
| Desktop  | > 1024px  | Laptops, desktops     |

## Layout Rules

### Dashboard (`/dashboard/*`)

**Mobile (< 640px):**
- Sidebar is hidden by default
- A hamburger/menu button in the header opens a slide-over drawer (full-screen overlay)
- Main content is full-width with 16px padding
- Stat grids stack to single column
- Tables collapse to card list layout

**Tablet (640–1024px):**
- Sidebar collapses to icon-only rail (48px wide)
- Main content gets 16px left margin for the rail
- Stat grids can be 2 columns

**Desktop (> 1024px):**
- Sidebar is fully visible (220px) on the left
- No hamburger needed
- Stat grids can be 3+ columns

### Landing Page (`/`)

Already responsive — keep the existing breakpoint at 768px for grid stacks.

## Navigation

- **Mobile**: Bottom tab bar (Dashboard, Sites, Host, Run, Menu) — or hamburger top-left
- **Desktop**: Sidebar as currently built
- All navigation links must work as both tap (mobile) and click (desktop) targets with minimum 44x44px touch area

## Spacing

| Token  | Mobile  | Desktop |
| ------ | ------- | ------- |
| Page padding | 16px | 24px |
| Card padding | 16px | 24px |
| Section gap | 12px | 16px |
| Grid gap | 12px | 16px |

## Typography

- Headings: same sizes, but reduce `letter-spacing` on mobile to prevent overflow
- Body: 15px on desktop, 16px on mobile (prevents zoom on iOS inputs)
- All form inputs: minimum 44px height for touch targets

## Component Behavior

| Component | Mobile | Desktop |
|-----------|--------|---------|
| Sidebar | Slide-over drawer | Fixed sidebar |
| Stat cards | Single column, full width | 3-column grid |
| Tables | Card list (label: value rows) | Full table |
| Modals | Full-screen sheet from bottom | Centered dialog |
| Buttons | Full width, 44px min height | Auto width |
| Dropdowns | Native `<select>` | Custom styled |
| Charts | Scrollable horizontally | Full width |

## Color & Theme

Already defined in `app.css` via CSS custom properties. No changes needed — just ensure contrast ratios meet WCAG AA on both light and dark themes.

### Green Background Buttons

When a button or interactive element uses `var(--accent)` as its background, text color MUST be `var(--btn-text)` — NOT a hardcoded `#000` or `#fff`. The `--btn-text` variable correctly resolves to `#000` in dark mode and `#fff` in light mode, ensuring proper contrast on both themes.

Bad:
```css
.btn-primary { background: var(--accent); color: #000; }
```

Good:
```css
.btn-primary { background: var(--accent); color: var(--btn-text); }
```

Search the codebase for `background: var(--accent); color:` patterns when adding new buttons to ensure compliance.

## Implementation Priority

1. Convert dashboard sidebar to mobile drawer
2. Make stat grids stack on mobile
3. Ensure all touch targets are 44x44px minimum
4. Test all forms on mobile viewport
