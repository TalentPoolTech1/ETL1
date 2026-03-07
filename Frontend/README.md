# ETL1 Frontend

Cloud-neutral, no-code Spark ETL platform UI. Built with React, TypeScript, Tailwind CSS, and Redux.

## Quick Start

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Opens at `http://localhost:5173`

### Build for Production
```bash
npm run build
npm run preview  # Preview the build locally
```

### Testing
```bash
npm run test          # Run Vitest
npm run test:ui       # Run with UI
```

### Linting
```bash
npm run lint          # ESLint
npm run type-check    # TypeScript check
```

## Project Structure

- **src/components/** - React components organized by feature
  - `common/` - Reusable UI components (Button, Input, etc.)
  - `layout/` - Layout shell (Header, Sidebar, AppShell)
  - `canvas/` - Pipeline canvas & rendering
  - `tabs/` - Tab management
  - `properties/` - Properties panel
  - `preview/` - Data preview panel

- **src/store/** - Redux state management
  - `slices/` - Pipeline, UI, tabs state slices
  - `index.ts` - Store configuration
  - `hooks.ts` - Redux hooks (useAppDispatch, useAppSelector)

- **src/types/** - TypeScript type definitions

- **src/styles/** - Global styles, Tailwind config

- **src/utils/** - Utility functions (cx, etc.)

## UI/UX Features

### Keyboard-First
- `Ctrl+K` - Command palette
- `Ctrl+S` - Save
- `Ctrl+W` - Close tab
- `Ctrl+Tab` - Next tab
- `F2` - Rename
- `Delete` - Delete node
- Arrow keys - Pan canvas

### Tabbed Workspace
- Multiple tabs for pipelines, datasets, etc.
- Drag to reorder
- Middle-click to close
- Unsaved indicator (dot)

### Pipeline Canvas
- Drag nodes to position
- Click to select, Ctrl+Click for multi-select
- 24px snap-to-grid
- Add nodes from component palette
- Visual feedback for selection

### Properties Panel
- Overview, Configuration, Advanced sections
- Edit node properties in real-time
- Validate configuration
- Preview data

### Data Preview
- Sample data with pagination
- Column filtering and sorting
- Different sampling modes (First N, Random, Stratified)

## Architecture

### State Management
Redux Toolkit for global state:
- **pipeline** - Pipeline design (nodes, edges, selection)
- **ui** - UI state (panel widths, theme, zoom)
- **tabs** - Tab management (open tabs, active tab)

### Component Pattern
- Functional components with hooks
- Local state for UI interactions
- Redux for shared state
- TypeScript for type safety

### Styling
- Tailwind CSS for utility classes
- CSS custom properties for design tokens
- Dark mode support (via prefers-color-scheme)
- Compact density mode

## Design System

Colors, typography, spacing, and components defined in:
- `tailwind.config.js` - Design tokens
- `src/styles/globals.css` - CSS variables
- `src/components/common/` - Component library

## Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation
- Focus indicators (2px blue ring)
- Semantic HTML
- ARIA labels

## Performance

- Code splitting with React.lazy
- Component memoization
- Virtualized lists for large datasets
- Optimized re-renders with Redux selectors

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

---

**Built with React 18, TypeScript, Tailwind CSS, and Redux Toolkit**
