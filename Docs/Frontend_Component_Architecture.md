# ETL1 Frontend Component Architecture & Implementation Guide

> **This document provides technical guidance for implementing the UI specification (UI_Requirement.md). It defines the component hierarchy, state management strategy, and development workflows.**

---

## Overview

The ETL1 frontend is a **React/TypeScript web application** built with modern best practices:

- **Framework**: React 18+ with hooks  
- **Language**: TypeScript  
- **State management**: Redux Toolkit (for global state) + React Context (for local state)  
- **UI library**: Custom design system components (built with Radix UI primitives)  
- **Styling**: Tailwind CSS with CSS-in-JS for dynamic theming  
- **Build tool**: Vite  
- **Testing**: Vitest + React Testing Library + Playwright E2E  

---

## Project Structure

```
Frontend/
├── src/
│   ├── index.tsx                          # App entry point
│   ├── App.tsx                            # Root component
│   ├── components/                        # Reusable UI components
│   │   ├── common/                        # Atomic components (Button, Input, Icon, etc.)
│   │   ├── layout/                        # Layout components (Header, Sidebar, MainArea, etc.)
│   │   ├── canvas/                        # Pipeline canvas & rendering
│   │   ├── tree/                          # Metadata tree & interactions
│   │   ├── properties/                    # Properties panel
│   │   ├── preview/                       # Data preview panel
│   │   ├── tabs/                          # Tab management & rendering
│   │   └── modals/                        # Modal dialogs
│   ├── pages/                             # Page-level components (ProjectPage, EditorPage, etc.)
│   ├── hooks/                             # Custom React hooks
│   │   ├── useCanvas.ts                   # Canvas interaction state
│   │   ├── useTab.ts                      # Tab management
│   │   ├── useKeyboardShortcuts.ts        # Keyboard shortcuts
│   │   ├── useUndo.ts                     # Undo/redo stack
│   │   └── ... other hooks
│   ├── store/                             # Redux store
│   │   ├── index.ts
│   │   ├── slices/
│   │   │   ├── projectSlice.ts            # Project metadata
│   │   │   ├── pipelineSlice.ts           # Pipeline state
│   │   │   ├── uiSlice.ts                 # UI state (panel widths, theme, etc.)
│   │   │   ├── collaborationSlice.ts      # Live presence, comments, activity
│   │   │   └── ...
│   │   └── selectors/
│   ├── services/                          # API clients and business logic
│   │   ├── api/                           # REST API clients
│   │   ├── websocket.ts                   # WebSocket for real-time updates
│   │   ├── dataPreview.ts                 # Preview & profiling API
│   │   ├── lineage.ts                     # Lineage computation
│   │   └── localStorage.ts                # Workspace persistence
│   ├── utils/                             # Utility functions
│   │   ├── canvas.ts                      # Canvas math (zoom, pan, collision)
│   │   ├── keyboard.ts                    # Keyboard event helpers
│   │   ├── format.ts                      # Formatting (dates, numbers, etc.)
│   │   ├── validation.ts                  # Form validation
│   │   ├── git-like-diff.ts               # Version diff computation
│   │   └── ...
│   ├── styles/                            # Global styles
│   │   ├── tailwind.config.js             # Tailwind configuration with design tokens
│   │   ├── globals.css                    # Global CSS
│   │   └── themes.css                     # Dark mode & compact density themes
│   ├── types/                             # TypeScript type definitions
│   │   ├── canvas.ts
│   │   ├── project.ts
│   │   ├── pipeline.ts
│   │   ├── api.ts
│   │   └── ...
│   └── __tests__/                         # Test files
├── public/
│   ├── icons/                             # SVG icons
│   └── ...
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## Core Components Hierarchy

### 1. Layout Shell
```
<AppShell>
  ├── <Header />                           # Global header, search, user menu
  ├── <LeftSidebar />                      # Project tree, navigation
  ├── <MainArea>
  │   ├── <TabBar />                       # Tab management
  │   └── <TabContent />                   # Active tab rendering
  │       ├── <PipelineEditor />           # Canvas, palette, toolbar
  │       ├── <TablePreview />             # Table viewer
  │       ├── <CodeEditor />               # SQL/expression editor
  │       └── ... other tab types
  ├── <RightSidebar>
  │   └── <PropertiesPanel />              # Node properties, schema mapping
  ├── <BottomPanel />                      # Data preview, logs
  └── <Footer />                           # Status bar, connection health
```

### 2. Canvas Components
```
<PipelineCanvas>
  ├── <CanvasViewport>                     # SVG viewport with zoom/pan
  │   ├── <GridBackground />               # 24px grid
  │   ├── <NodeRenderer>
  │   │   └── ... <Node /> for each pipeline node
  │   │       ├── <NodeCard />             # Node visual representation
  │   │       ├── <NodeConnectors />       # Input/output ports
  │   │       └── <QuickToolbar />         # Hover actions
  │   └── <EdgeRenderer>
  │       └── ... <Edge /> for each connection
  │           ├── <BezierPath />           # Curved SVG path
  │           └── <EdgeLabel />            # Optional mapping label
  ├── <ComponentPalette />                 # Source/Transform/Target palette
  ├── <CanvasToolbar>                      # Zoom, pan, align, distribute, undo
  └── <SelectionIndicator />               # Multi-select bounding box
```

### 3. Properties Panel Components
```
<PropertiesPanel>
  ├── <SectionHeader>                      # Sticky section tabs
  ├── <ConfigurationSection>
  │   ├── <TextField />
  │   ├── <SelectField />
  │   ├── <CodeEditorField>                # Monaco-based code input
  │   └── <ColumnMappingUI />              # Drag-drop mapping matrix
  ├── <DataPreviewSection>
  │   ├── <DataTable>
  │   │   ├── <TableHeader />              # Sticky column headers
  │   │   └── <TableBody />                # Virtualized rows
  │   ├── <SchemaView />
  │   ├── <SamplingControls />             # First N / Random / Stratified
  │   └── <ProfilingMetrics />             # Null %, distinct, etc.
  ├── <PropertiesForm />                   # Two-column field layout
  └── <InlineValidation />                 # Error messages under fields
```

### 4. Tree/Navigation Components
```
<MetadataTree>
  ├── <TreeNode>                           # Recursive tree item
  │   ├── <NodeIcon />                     # Status badge + icon
  │   ├── <NodeLabel />                    # Editable inline
  │   ├── <NodeContextMenu />              # Right-click actions
  │   ├── <NodeMetadata />                 # Badges (row count, updated, etc.)
  │   └── <TreeExpansionToggle />
  ├── <TreeSearch />                       # Incremental search
  └── <TreeFilterBar />                    # Technology, tag, owner filters
```

### 5. Tab Management Components
```
<TabBar>
  ├── <Tab>                                # Individual tab
  │   ├── <TabLabel />
  │   ├── <UnsavedDot />                   # Red/orange indicator
  │   ├── <CloseButton />
  │   └── <ContextMenu />                  # Pin, close others, duplicate, etc.
  ├── <TabScrollControl>                   # Left/right chevrons for overflow
  └── <NewTabButton />                     # Add tab action

<TabContent>                               # Renders active tab component
  └── Dynamic rendering based on tab type (PipelineEditor, TablePreview, etc.)
```

### 6. Collaboration Components
```
<CollaborationPresence>
  ├── <AvatarStack />                      # Active user avatars
  ├── <LiveCursor>                         # Cursor indicators for collaborators
  ├── <ActivityFeed>                       # Recent changes timeline
  ├── <CommentThread>                      # Threaded comments on nodes
  └── <ConflictResolutionModal />          # Side-by-side conflict view
```

### 7. Modal & Dialog Components
```
<Modal />                                  # Generic modal wrapper
<ConfirmDialog />                          # Delete/discard confirmation
<FormDialog />                             # Create/edit object dialogs
<SearchDialog />                           # Command palette (Ctrl+K)
<NodeJumpDialog />                         # Node navigation (Ctrl+J)
<ExportDialog />                           # CSV/JSON/Parquet export options
<UndoTimelineModal />                      # Visual undo history
<VersionComparisonModal />                 # Version diff viewer
```

---

## State Management

### Redux Store Structure
```typescript
// Store hierarchy
{
  // Global/project state
  projects: {
    byId: { [projectId]: Project },
    activeProjectId: string,
    loading: boolean,
  },
  
  // Pipeline design state
  pipelines: {
    byId: { [pipelineId]: Pipeline },
    activePipelineId: string,
    nodes: { [nodeId]: Node },
    edges: { [edgeId]: Edge },
    unsavedChanges: boolean,
    lastSavedAt: timestamp,
  },
  
  // UI state (persistent across sessions)
  ui: {
    theme: 'light' | 'dark',
    density: 'normal' | 'compact',
    leftRailVisible: boolean,
    rightRailVisible: boolean,
    bottomPanelVisible: boolean,
    focusMode: boolean,
    leftRailWidth: number,
    rightRailWidth: number,
    bottomPanelHeight: number,
  },
  
  // Tab management
  tabs: {
    allTabs: Tab[],
    activetabId: string,
    tabHistory: string[],
  },
  
  // Undo/Redo stack (per-tab)
  undo: {
    [tabId]: {
      past: Action[],
      present: State,
      future: Action[],
    }
  },
  
  // Collaboration
  collaboration: {
    activeUsers: User[],
    comments: { [nodeId]: Comment[] },
    activity: ActivityLog[],
    cursorPositions: { [userId]: CursorPos },
  },
  
  // Data preview & caching
  preview: {
    cache: { [datasetId]: CachedDataset },
    profiles: { [datasetId]: DataProfile },
    loadingDatasets: string[],
  },
}
```

### State Access Patterns
```typescript
// Use Redux hooks for global state
import { useAppDispatch, useAppSelector } from './store';

// Component example
function PipelineCanvas() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector(state => state.pipelines.nodes);
  const activePipeline = useAppSelector(selectActivePipeline);
  
  // Dispatch actions
  useEffect(() => {
    dispatch(addNode({ type: 'source', ... }));
  }, [dispatch]);
}

// Use Context + useState for local/tab-scoped state
const TabContext = React.createContext<TabContextValue>(null);

function useTabState() {
  return useContext(TabContext);
}
```

---

## Key Custom Hooks

### useCanvas
Manages canvas viewport state (zoom, pan, selection):
```typescript
const canvas = useCanvas();
// canvas.zoom(1.2), canvas.pan(x, y), canvas.fitToScreen()
// canvas.selectedNodeIds, canvas.hoveredNodeId
```

### useTab
Persists tab state across sessions:
```typescript
const tab = useTab(tabId);
// tab.isDirty, tab.state, tab.save(), tab.revert()
```

### useKeyboardShortcuts
Registers global and local keyboard shortcuts:
```typescript
useKeyboardShortcuts([
  { key: 'ctrl+k', action: openCommandPalette },
  { key: 'ctrl+s', action: savePipeline },
  { key: 'f2', action: renameNode, when: () => nodeSelected },
]);
```

### useUndo
Per-tab undo/redo management:
```typescript
const { undo, redo, clearHistory, canUndo, canRedo } = useUndo();
// undo() reverts last change; redo() reapplies
```

### useDataPreview
Lazy load and cache data preview with smart sampling:
```typescript
const { data, schema, isLoading, error, sample } = useDataPreview(datasetId);
// sample(mode: 'first' | 'random' | 'stratified', size)
```

### useLineage
Compute and visualize data lineage:
```typescript
const { lineage, upstream, downstream, trace } = useLineage(nodeId);
// trace(columnName) shows column-level lineage
```

### useCollaboration
Live presence and conflict detection:
```typescript
const { activeUsers, changes, conflict, resolve } = useCollaboration(pipelineId);
// resolve('mine' | 'theirs' | 'merge')
```

---

## Styling and Design Tokens

### Tailwind Configuration
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    colors: {
      primary: {
        50: '#F0F5FF',
        100: '#E6F0FF',
        // ...
        600: '#0B66FF',    // Primary blue
      },
      text: {
        primary: '#111827',
        secondary: '#6B7280',
      },
      surface: {
        light: '#FFFFFF',
        muted: '#F6F7F9',
      },
      // ... other colors
    },
    spacing: {
      // Base 8px unit
      1: '8px',
      2: '16px',
      3: '24px',
      // ...
    },
  },
};
```

### Dark Mode & Compact Density
```css
/* themes.css */

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text: #E5E7EB;
    --color-surface: #0F172A;
    --color-border: #334155;
    /* ... */
  }
}

/* Compact density */
[data-density="compact"] {
  --spacing-multiplier: 0.85;
  --font-size-multiplier: 0.9;
  /* Adjust all spacing and font sizes */
}
```

---

## API Integration

### RESTful Endpoints
```typescript
// api/projects.ts
export const projectsApi = {
  getProjects: () => GET('/api/projects'),
  getProject: (id) => GET(`/api/projects/${id}`),
  createProject: (data) => POST('/api/projects', data),
  updateProject: (id, data) => PUT(`/api/projects/${id}`, data),
  deleteProject: (id) => DELETE(`/api/projects/${id}`),
};

// api/pipelines.ts
export const pipelinesApi = {
  getPipeline: (id) => GET(`/api/pipelines/${id}`),
  savePipeline: (id, data) => PUT(`/api/pipelines/${id}`, data),
  runPipeline: (id) => POST(`/api/pipelines/${id}/run`),
  getPreview: (nodeId, options) => GET(`/api/nodes/${nodeId}/preview`, options),
  getLineage: (nodeId) => GET(`/api/nodes/${nodeId}/lineage`),
};

// api/metadata.ts
export const metadataApi = {
  getTree: () => GET('/api/metadata/tree'),
  searchTree: (query) => GET('/api/metadata/tree/search', { query }),
  getProfile: (datasetId) => GET(`/api/metadata/${datasetId}/profile`),
};
```

### WebSocket for Real-Time Updates
```typescript
// services/websocket.ts
class WebSocketClient {
  connect(projectId: string) {
    this.socket = new WebSocket(`wss://api.example.com/ws?projectId=${projectId}`);
    this.socket.on('message', (event) => {
      const { type, payload } = JSON.parse(event.data);
      dispatcher(handleWebSocketMessage(type, payload));
    });
  }
  
  // Events: 'user_joined', 'user_left', 'node_changed', 'comment_added', etc.
}
```

---

## Development Workflow

### 1. Component Development
```bash
# Create a new button component
# components/common/Button.tsx

import React from 'react';
import classNames from 'classnames';
import styles from './Button.module.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick,
}) => {
  return (
    <button
      className={classNames(
        'px-4 py-2 rounded-lg font-medium transition-colors',
        {
          'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
          'bg-gray-200 text-gray-900': variant === 'secondary',
          'bg-red-600 text-white': variant === 'danger',
          'text-sm': size === 'sm',
          'text-base': size === 'md',
          'text-lg': size === 'lg',
          'opacity-50 cursor-not-allowed': disabled,
        }
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

### 2. Testing
```typescript
// components/common/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick handler', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    screen.getByText('Click').click();
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByText('Click')).toBeDisabled();
  });
});
```

### 3. E2E Testing
```typescript
// e2e/pipeline-editor.spec.ts
import { test, expect } from '@playwright/test';

test('user can create and run a simple pipeline', async ({ page }) => {
  await page.goto('http://localhost:5173/projects/123');
  
  // Create new pipeline
  await page.click('[data-testid="new-pipeline-btn"]');
  await page.fill('[data-testid="pipeline-name"]', 'My Pipeline');
  await page.click('[data-testid="create-btn"]');
  
  // Add source node
  const sourcePalette = page.locator('[data-testid="component-palette"]');
  await sourcePalette.drag('[data-palette="source"]', {
    target: { x: 400, y: 400 }
  });
  
  // Verify node was added
  expect(page.locator('[data-node-type="source"]')).toBeVisible();
  
  // Save pipeline
  await page.keyboard.press('Control+S');
  await expect(page.locator('[data-testid="save-indicator"]')).not.toBeVisible();
});
```

---

## Performance Optimization

### 1. Code Splitting
```typescript
// App.tsx
const PipelineEditor = React.lazy(() => import('./pages/PipelineEditor'));
const ProjectSettings = React.lazy(() => import('./pages/ProjectSettings'));

function Router() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/pipelines/:id" element={<PipelineEditor />} />
        <Route path="/settings" element={<ProjectSettings />} />
      </Routes>
    </Suspense>
  );
}
```

### 2. Virtualization for Large Lists
```typescript
// components/tree/MetadataTree.tsx
import { FixedSizeList } from 'react-window';

export function MetadataTree({ items }: TreeProps) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={40}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <TreeNode item={items[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

### 3. Memoization
```typescript
// Memoize components that receive stable props
const NodeCard = React.memo(({ node, isSelected }: Props) => {
  return <div>{node.name}</div>;
});

// Memoize selectors to avoid unnecessary re-renders
const selectNodeById = (state, id) => state.pipelines.nodes[id];
const memoizedSelectNodeById = createSelector(
  selectNodeById,
  node => node
);
```

### 4. Lazy Loading & Pagination
```typescript
// Load objects on demand
const useInfinitePagination = (query, pageSize = 50) => {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMore = useCallback(async (page) => {
    const data = await api.search(query, { page, pageSize });
    setItems(prev => [...prev, ...data]);
    setHasMore(data.length === pageSize);
  }, [query, pageSize]);
  
  return { items, loadMore, hasMore };
};
```

---

## Build & Deployment

### Development
```bash
npm install
npm run dev          # Vite dev server on :5173
```

### Production
```bash
npm run build        # Optimized bundle
npm run preview      # Preview production build locally
npm run test         # Run Vitest
npm run e2e          # Run Playwright E2E
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

### Docker
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./
EXPOSE 3000
CMD ["npx", "serve", "-s", ".", "-l", "3000"]
```

---

## Accessibility Checklist

- [ ] All interactive elements are keyboard accessible (Tab, Enter, Escape, arrow keys)
- [ ] Focus indicators are visible and 2px solid blue  
- [ ] Color not the only indicator of status (use icons, labels, text)
- [ ] Text contrast ≥ 4.5:1 for normal text, 3:1 for large text  
- [ ] Semantic HTML (`<button>`, `<input>`, `<label>`, `<nav>`, etc.)  
- [ ] ARIA roles, labels, and statuses for non-semantic elements  
- [ ] Screen reader tested with NVDA/JAWS/VoiceOver  
- [ ] Reduced motion respected (prefers-reduced-motion media query)  
- [ ] Form validation errors clearly associated with fields  
- [ ] Images have alt text; icons have aria-label or title attribute  

---

## Security Best Practices

- [ ] Never store secrets in frontend code; use environment variables  
- [ ] Validate all user input on frontend and backend  
- [ ] Use HTTPS for all API calls  
- [ ] Sanitize rich text (comments) before rendering  
- [ ] Implement CSRF token for state-changing requests  
- [ ] Use Content Security Policy (CSP) headers  
- [ ] Regularly update dependencies for security patches  

---

**End of Frontend Implementation Guide**
