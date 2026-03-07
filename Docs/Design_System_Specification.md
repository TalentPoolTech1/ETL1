# ETL1 Design System Specification

> **Complete design system specification for the ETL1 platform, including tokens, components, patterns, and accessibility guidelines.**

---

## Design Principles

1. **Data-centric**: Prioritize the data and transformations; UI gets out of the way
2. **Professional**: No flashy gradients or excessive animations; clean, serious design for engineers
3. **Keyboard-first**: Power users should never need a mouse
4. **Consistent**: Predictable, discoverable interface; mental model matches data model
5. **Accessible**: WCAG 2.1 AA minimum; inclusive from day one

---

## Color Tokens

### Semantic Colors
```json
{
  "colors": {
    "primary": {
      "50": "#F0F5FF",
      "100": "#E6F0FF",
      "200": "#BFD9FF",
      "300": "#99C2FF",
      "400": "#4D8FFF",
      "500": "#2563FF",
      "600": "#0B66FF",
      "700": "#0952CC",
      "800": "#063E99",
      "900": "#042A66"
    },
    "accent": {
      "50": "#ECFDF5",
      "600": "#06B6D4",
      "700": "#0891B2"
    },
    "success": {
      "50": "#F0FDF4",
      "600": "#16A34A",
      "700": "#15803D"
    },
    "warning": {
      "50": "#FFFBEB",
      "600": "#F59E0B",
      "700": "#D97706"
    },
    "danger": {
      "50": "#FEF2F2",
      "600": "#DC2626",
      "700": "#B91C1C"
    },
    "neutral": {
      "50": "#FAFAFA",
      "100": "#F3F4F6",
      "200": "#E5E7EB",
      "300": "#D1D5DB",
      "400": "#9CA3AF",
      "500": "#6B7280",
      "600": "#4B5563",
      "700": "#374151",
      "800": "#1F2937",
      "900": "#111827"
    }
  }
}
```

### Functional Colors
```
Primary:         #0B66FF   (Links, active states, CTAs, focus rings)
Success:         #16A34A   (Positive confirmations, on-state)
Warning:         #F59E0B   (Alerts, pending states, caution)
Danger:          #DC2626   (Errors, destructive actions)
Surface:         #FFFFFF   (Backgrounds, cards)
Surface Light:   #F6F7F9   (Alternate backgrounds, hover states)
Text Primary:    #111827   (Body text, labels, headings)
Text Secondary:  #6B7280   (Hints, secondary text, disabled)
Border:          #E6E9EE   (Dividers, borders, strokes)
Shadow:          rgba(2,6,23,0.08)  (Drop shadows)
```

### Token CSS Variables
```css
:root {
  /* Colors */
  --color-primary-600: #0B66FF;
  --color-primary-light: #E6F0FF;
  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-danger: #DC2626;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-border: #E6E9EE;
  --color-surface: #FFFFFF;
  --color-surface-light: #F6F7F9;
  
  /* Typography */
  --font-family-base: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-family-mono: "Fira Code", "Monaco", monospace;
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-h3: 18px;
  --font-size-h2: 22px;
  --font-size-h1: 28px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1.2;
  --line-height-normal: 1.4;
  --line-height-relaxed: 1.6;
  
  /* Spacing */
  --spacing-1: 8px;
  --spacing-2: 16px;
  --spacing-3: 24px;
  --spacing-4: 32px;
  --spacing-5: 40px;
  --spacing-6: 48px;
  
  /* Elevation (z-index) */
  --elevation-0: 0;
  --elevation-1: 100;
  --elevation-2: 200;
  --elevation-3: 300;
  --elevation-modal: 1000;
  --elevation-tooltip: 1100;
  
  /* Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  
  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(2, 6, 23, 0.05);
  --shadow-sm: 0 1px 3px rgba(2, 6, 23, 0.1), 0 1px 2px rgba(2, 6, 23, 0.06);
  --shadow-md: 0 2px 6px rgba(2, 6, 23, 0.08);
  --shadow-lg: 0 4px 12px rgba(2, 6, 23, 0.1);
  --shadow-xl: 0 8px 24px rgba(2, 6, 23, 0.12);
  
  /* Transitions */
  --transition-fast: 100ms ease-in-out;
  --transition-normal: 150ms ease-in-out;
  --transition-slow: 250ms ease-in-out;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #E5E7EB;
    --color-text-secondary: #9CA3AF;
    --color-surface: #0F172A;
    --color-surface-light: #1E293B;
    --color-border: #334155;
    --shadow-md: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
}

/* Compact density */
[data-density="compact"] {
  --spacing-1: 6px;
  --spacing-2: 12px;
  --spacing-3: 16px;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 13px;
}
```

---

## Typography

### Font Stack
```
Primary: Inter (UI, labels, body)
Mono:    Fira Code or Monaco (code editors, data values)
Fallback: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
```

### Type Scale
| Use | Size | Weight | Line Height |
|---|---|---|---|
| Overline | 12px | 600 | 1.2 |
| Small text, hints | 13px | 400 | 1.4 |
| Body, form labels | 14px | 400 | 1.4 |
| Body semibold | 14px | 600 | 1.4 |
| Large text | 16px | 400 | 1.4 |
| Heading 3 | 18px | 600 | 1.2 |
| Heading 2 | 22px | 600 | 1.2 |
| Heading 1 | 28px | 700 | 1.2 |
| Code (mono) | 13px | 400 | 1.5 |

### Text Styles
```css
.text-overline {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.text-caption {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-secondary);
}

.text-body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--color-text-primary);
}

.text-body-strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.heading-3 {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--color-text-primary);
}

.heading-2 {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--color-text-primary);
}

.heading-1 {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text-primary);
}

.code {
  font-family: var(--font-family-mono);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  background: var(--color-surface-light);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
```

---

## Spacing System

Base unit: **8px**. All spacing uses multiples of 8px.

```
1x = 8px
2x = 16px
3x = 24px
4x = 32px
5x = 40px
6x = 48px
```

### Padding Guidelines
- **Content padding**: 16px (2x) for standard containers; 24px (3x) for large sections
- **Form field padding**: 8px (1x) vertical, 12px (1.5x) horizontal
- **Button padding**: 10px (1x) vertical, 16px (2x) horizontal
- **Card padding**: 16px (2x) for internal spacing

### Margin Guidelines
- **Block spacing**: 24px (3x) between major sections
- **Vertical stack spacing**: 16px (2x) between list items, form fields
- **Horizontal spacing**: 8px (1x) between inline elements, 16px (2x) between buttons

---

## Component Library

### Basic Components

#### 1. Button
```typescript
// Variants: primary, secondary, danger, ghost
// Sizes: sm (32px), md (40px), lg (48px)
// States: default, hover, active, focused, disabled, loading

<Button variant="primary" size="md" disabled={false}>
  Action
</Button>

// CSS
.button {
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: all var(--transition-fast);
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  white-space: nowrap;
}

.button--primary {
  background: var(--color-primary-600);
  color: white;
}

.button--primary:hover {
  background: var(--color-primary-700);
}

.button--primary:active {
  background: var(--color-primary-800);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button--sm {
  padding: 6px 12px;
  font-size: 13px;
}

.button--md {
  padding: 10px 16px;
  font-size: 14px;
}
```

#### 2. Input
```typescript
// Types: text, email, password, number, date, time, etc.
// States: default, focused, error, disabled
// Props: placeholder, label, helperText, error, maxLength, etc.

<Input
  type="text"
  label="Pipeline name"
  placeholder="Enter pipeline name"
  value={value}
  onChange={handleChange}
  error={errors.name}
  helperText="Name must be unique within project"
/>

// CSS
.input {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 14px;
  font-family: var(--font-family-base);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.input--error {
  border-color: var(--color-danger);
}

.input:disabled {
  background: var(--color-surface-light);
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.input__error {
  color: var(--color-danger);
  font-size: 12px;
  margin-top: 4px;
}
```

#### 3. Select
```typescript
// Single and multi-select with search
<Select
  options={[
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
  ]}
  value={selected}
  onChange={handleChange}
  placeholder="Choose an option"
  searchable={true}
  multi={false}
/>
```

#### 4. Toggle/Switch
```typescript
// 44×24px, rounded corners
<Toggle
  checked={enabled}
  onChange={handleChange}
  disabled={false}
  label="Enable notifications"
/>

// CSS
.toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--color-border);
  border: none;
  cursor: pointer;
  position: relative;
  transition: background-color var(--transition-fast);
}

.toggle--checked {
  background: var(--color-primary-600);
}

.toggle__indicator {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background: white;
  transition: left var(--transition-fast);
}

.toggle--checked .toggle__indicator {
  left: 22px;
}
```

#### 5. Checkbox
```typescript
<Checkbox
  checked={selected}
  onChange={handleChange}
  label="I agree to terms"
  disabled={false}
  indeterminate={false}
/>

// CSS
.checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.checkbox__input {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-border);
  cursor: pointer;
  appearance: none;
  background: white;
}

.checkbox__input:checked {
  background: var(--color-primary-600);
  border-color: var(--color-primary-600);
  background-image: url(data:image/svg+xml,...);
}

.checkbox__input:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
```

#### 6. Tooltip
```typescript
// Max 200 characters; appears on hover with 300ms delay
<Tooltip text="This is a helpful description">
  <InfoIcon />
</Tooltip>

// CSS
.tooltip {
  position: relative;
}

.tooltip__content {
  position: absolute;
  background: var(--color-text-primary);
  color: white;
  padding: var(--spacing-2);
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.4;
  max-width: 200px;
  z-index: var(--elevation-tooltip);
  box-shadow: var(--shadow-lg);
  white-space: normal;
}
```

#### 7. Badge
```typescript
// Variants: neutral, primary, success, warning, danger, info
// Sizes: sm (small), md (medium)

<Badge variant="primary" size="sm">
  Active
</Badge>

// CSS
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--radius-xl);
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
}

.badge--primary {
  background: var(--color-primary-light);
  color: var(--color-primary-700);
}

.badge--success {
  background: #DCF8E8;
  color: #27A84A;
}
```

#### 8. Tag/Chip
```typescript
// Removable tags used for filters, selections
<Tag>
  Important
  <button onClick={() => removeTag()}>×</button>
</Tag>

// CSS
.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 6px 10px;
  font-size: 13px;
}
```

#### 9. Spinner / Loading
```typescript
<Spinner size="md" variant="primary" />

// CSS
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  border: 2px solid var(--color-surface-light);
  border-top-color: var(--color-primary-600);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner--sm { width: 16px; height: 16px; }
.spinner--md { width: 24px; height: 24px; }
.spinner--lg { width: 32px; height: 32px; }
```

#### 10. Alert / Toast
```typescript
<Alert variant="success" onClose={() => {}}>
  <AlertIcon />
  <AlertText>Operation completed successfully</AlertText>
</Alert>

// CSS
.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border-radius: var(--radius-md);
  border-left: 4px solid;
}

.alert--success {
  background: #F0FDF4;
  border-left-color: var(--color-success);
  color: #27A84A;
}

.alert--error {
  background: #FEF2F2;
  border-left-color: var(--color-danger);
  color: var(--color-danger);
}

.alert--warning {
  background: #FEF9E7;
  border-left-color: var(--color-warning);
  color: #92400E;
}
```

### Complex Components

#### Tree/List
- Virtualized rendering for 1000+ items
- Expandable/collapsible nodes
- Drag-and-drop reordering
- Right-click context menu
- Inline editing
- Search highlighting

#### Modal/Dialog
- Centered overlay with semi-transparent backdrop
- Focus trap (Tab navigates within modal)
- Escape key closes (if not blocking)
- Required fields validated before submit
- Max width 600px; max height 90vh
- Smooth fade-in animation

#### Data Table
- Sticky headers and first column (optional)
- Sortable columns (click header)
- Selectable rows (checkbox column)
- Pagination or virtualized scrolling
- Column resizing by drag
- Cell overflow: ellipsis with tooltip

#### Code Editor
- Monaco Editor integration
- Syntax highlighting (SQL, Python, JSON)
- Line numbers, minimap
- Search/replace (Ctrl+H)
- Autocomplete for column names
- Error squiggles and inline hints

#### Canvas / Graph
- SVG viewport with zoom/pan
- Snap-to-grid (24px)
- Node drag-to-move
- Edge routing (cubic bezier)
- Multi-select with marquee
- Keyboard shortcuts for alignment

---

## Interaction Patterns

### Drag and Drop
```
1. User clicks and holds on draggable item
2. Cursor becomes grabbing hand; preview appears
3. User drags; drop zones highlight when over valid area
4. User releases; item moves or action executes
5. Esc cancels the operation
```

### Context Menu (Right-Click)
```
1. Right-click on element
2. Menu appears at cursor position, constrained within viewport
3. Click item to execute action
4. Esc or click outside closes menu
```

### Modal/Dialog Workflow
```
1. Trigger action (button click)
2. Modal fades in with semi-transparent backdrop
3. Focus moves to first form field
4. User fills fields; validation happens on blur or submit
5. Submit button enabled only if all required fields valid
6. On submit, action executes; success/error notification shown
7. Modal closes (or stays open with success message until user closes)
```

### Keyboard Navigation
```
Tab:                Navigate forward through focusable elements
Shift+Tab:          Navigate backward
Enter:              Activate focused button/link
Space:              Toggle checkbox/switch
Arrow keys:         Navigate within tree, list, menu
Escape:             Close modal, menu, cancel operation
Ctrl/Cmd+K:         Open command palette
Ctrl/Cmd+F:         Search within current context
```

### Inline Editing
```
1. User double-clicks editable field or presses F2
2. Field becomes input with current value selected
3. User edits; Escape reverts; Enter commits
4. If validation error, show inline error message
5. Field reverts to display mode on blur or Enter
```

---

## Micro-interactions and Animations

### Transitions
```css
/* Fast feedback for hover/click states */
transition: all 100ms ease-in-out;

/* Slower transitions for panels/drawers */
transition: width 200ms ease-out, opacity 150ms ease-out;

/* Smooth list reordering */
transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Key Animations
- **Fade in**: 150ms ease-out
- **Slide in from left**: 300ms cubic-bezier(0.4, 0, 0.2, 1)
- **Zoom expand**: 200ms cubic-bezier(0.34, 1.56, 0.64, 1)
- **Spin**: 1s linear infinite
- **Pulse**: 2s ease-in-out infinite

---

## Accessibility Standards

### WCAG 2.1 AA Compliance
- **Contrast**: Text ≥ 4.5:1; UI components ≥ 3:1
- **Focus**: Visible focus ring (2px solid blue)
- **Keyboard**: All functionality accessible via keyboard
- **ARIA**: Proper roles, labels, states on interactive elements
- **Alt text**: Images have descriptive alt text
- **Motion**: Respect prefers-reduced-motion; avoid auto-play animations

### Screen Reader Markup
```html
<!-- Button with icon -->
<button aria-label="Delete node">
  <TrashIcon aria-hidden="true" />
</button>

<!-- Expandable tree node -->
<div role="treeitem" aria-expanded="true" aria-level="1">
  <button aria-controls="tree-branch-1">
    <ChevronIcon aria-hidden="true" />
    Parent Node
  </button>
  <div id="tree-branch-1" role="group">
    <!-- Children -->
  </div>
</div>

<!-- Form with validation -->
<div>
  <label for="email">Email</label>
  <input id="email" aria-describedby="email-error" />
  <div id="email-error" role="alert" aria-live="polite">
    Invalid email format
  </div>
</div>

<!-- Tooltip -->
<button aria-describedby="tooltip-help">
  <InfoIcon />
</button>
<div id="tooltip-help" role="tooltip">
  Click to learn more
</div>
```

---

## Dark Mode Implementation

```css
/* Light mode (default) */
:root {
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-surface: #FFFFFF;
  --color-border: #E6E9EE;
  --shadow-md: 0 2px 6px rgba(2, 6, 23, 0.08);
}

/* Dark mode - via system preference */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #E5E7EB;
    --color-text-secondary: #9CA3AF;
    --color-surface: #0F172A;
    --color-surface-light: #1E293B;
    --color-border: #334155;
    --shadow-md: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
}

/* Dark mode - via manual toggle */
[data-theme="dark"] {
  --color-text-primary: #E5E7EB;
  --color-text-secondary: #9CA3AF;
  --color-surface: #0F172A;
  --color-border: #334155;
}
```

---

## Icon Set

### Categories
- **Action**: add, delete, edit, save, run, stop, pause, refresh
- **Navigation**: back, forward, home, folder, document, link
- **Status**: checkmark, error, warning, info, loading, success
- **Connection**: plug, connected, disconnected
- **Data**: table, column, row, filter, sort, settings
- **Collaboration**: comment, mention, share, lock, unlock

### Specifications
- **Size**: 16px for tree/list, 20px for toolbar, 24px for standalone
- **Stroke**: 2px stroke width for consistency
- **Canvas**: 24×24px at 2x scaling
- **Color**: Inherit from text color; can be tinted with semantic colors for status

---

**End of Design System Specification**
