# Product Requirements Document

## Overview
**Purpose**  
Define a production quality, enterprise No‑Code ETL web application UI with a **tabbed workspace** model where every object opens in its own tab (double‑click or open action), preserving layout and maximizing canvas space for pipeline design. The UI must be **professional, functional, and non‑flashy**, optimized for heavy data engineering workflows, strict tree‑structured metadata, and SQL‑first users who perform cleaning, transforms, ML feature engineering, and operational tasks.

**Audience**  
Product managers, UX designers, frontend engineers, backend engineers, QA, accessibility reviewers, and SREs.

**Scope**  
Complete UI specification: global layout, tab behavior, pipeline canvas, properties panel, metadata tree, icons, typography, colors, spacing, interactions, keyboard shortcuts, accessibility, performance targets, and deliverables.

---

## Global Layout and Page Shell
### Page shell structure
- **Header**: fixed top bar, height **56px**, contains **logo**, **global search**, **user menu**, **notifications**, **help**, **global actions**.  
- **Left rail**: collapsible vertical navigation, width **280px** (collapsed **72px**), contains **Projects**, **Global Objects**, **Connections**, **Metadata**, **Monitor**, **Users**, **Settings**.  
- **Main area**: tabbed workspace occupying remaining width; contains **tab bar** and **active tab canvas**.  
- **Right rail**: properties and context panels; default width **360px**, collapsible to **48px** icon strip.  
- **Bottom panel**: data preview and logs; default height **260px**, collapsible to **40px** status bar.  
- **Footer**: thin status bar **24px** for connection status, SLOs, and background job indicators.

### Layout rules and responsive behavior
- **Desktop breakpoint**: ≥1280px uses full layout.  
- **Tablet breakpoint**: 768–1279px left rail collapses to icons; right rail collapses; canvas becomes single column.  
- **Mobile breakpoint**: <768px app shows a simplified navigator and single tab view; pipeline canvas is read‑only or simplified.  
- **Maximize canvas**: when a tab is focused and user toggles "Focus Mode", hide left rail, right rail, and bottom panel; canvas gets full viewport minus header (56px).  
- **Grid system**: 12‑column responsive grid; base gutter **16px**; container max width **1440px**.

### Tab bar and workspace chrome
- **Tab bar height**: **48px**.  
- **Tab width**: dynamic; min **160px**, max **360px**; overflow uses horizontal scroll with left/right chevrons.  
- **Active tab style**: background **#FFFFFF**, bottom border **3px solid #0B66FF** (primary blue), bold label.  
- **Inactive tab style**: background **#F6F7F9**, label color **#333333**.  
- **Tab close**: **X** icon on hover; middle click closes; right‑click opens context menu (Close, Close Others, Close to Right, Duplicate, Pin).  
- **Tab pinning**: pinned tabs fixed left; pinned icon **pin** filled; pinned tabs persist across sessions.  
- **Tab grouping**: allow drag to reorder and drag to create tab groups (visual divider).  
- **Tab restore**: on reload, restore last open tabs and their state.

---

## Object Model Tree and CRUD Behavior
### Tree structure and taxonomy
- **Top level**: **Technology** groups (Cloud, RDBMS, File, NoSQL, Streaming, BI, ML).  
- **Second level**: **Connection** (one per connection string/credential).  
- **Third level**: **Schema / Container**.  
- **Fourth level**: **Table / Object**.  
- **Fifth level**: **Columns / Fields** and object attributes.  
- **All nodes**: support icons, badges, and context menus.

### Node metadata and icons
- **Technology icon**: custom SVG per technology category.  
- **Connection icon**: plug icon with status badge (green/yellow/red).  
- **Schema icon**: folder icon.  
- **Table icon**: table icon.  
- **Column icons**: **PK** (key icon), **FK** (link icon), **UK** (shield icon), **Indexed** (bolt icon), **Nullable** (dash icon).  
- **Badges**: row count, last updated timestamp, sample size.  
- **Icon size**: **16px** for tree nodes; **20px** for top level.

### Tree interactions and CRUD
- **Single click**: select node and show summary in right rail.  
- **Double click**: open node in a new tab (preserve layout).  
- **Right click**: context menu with **Open**, **Open in New Tab**, **Rename**, **Delete**, **New Child**, **Copy Path**, **Properties**, **Export**, **Permissions**.  
- **Inline rename**: F2 or context menu; validation inline.  
- **Create new**: modal with form; default values prefilled from parent.  
- **Delete**: confirmation modal with checkbox "Also delete downstream artifacts" and audit trail entry.  
- **Drag and drop**: reorder within same parent; disallow cross‑technology moves unless explicit "Migrate" flow.  
- **Search within tree**: incremental search with highlight and keyboard navigation.

### Metadata grouping and categories
- **Group by technology**: tree root groups technologies; each technology contains connections.  
- **Metadata tagging**: allow tags and categories; tags visible as small chips next to node label.  
- **Filtering**: multi‑select filters by technology, tag, owner, sensitivity level.

---

## Pipeline Canvas Detailed Specification
### Canvas layout and sizing
- **Canvas area**: default occupies center with generous margins; when focused, canvas uses full width.  
- **Canvas grid**: 24px grid with snap to grid enabled; show faint grid lines at 24px intervals.  
- **Zoom**: 25%–400% with smooth zoom; default 100%. Zoom control in top right of canvas.  
- **Pan**: click‑and‑drag background or use middle mouse button; keyboard arrows pan when spacebar held.  
- **Canvas padding**: 24px from edges.

### Node types and visual design
- **Node card**: rounded rectangle, drop shadow **0 2px 6px rgba(0,0,0,0.08)**, min size **160×56px**, resizable.  
- **Node header**: **40px** height, icon left **20px**, title font **Inter 600 14px #111827**, subtitle 12px #6B7280.  
- **Node body**: shows key properties, sample metrics, and small action icons (edit, preview, duplicate).  
- **Node color coding**: by node type (Source: **#E6F4FF**, Transform: **#FFF7E6**, Target: **#E8FFF0**, Custom: **#F3E8FF**).  
- **Node border**: default **1px solid #E6E9EE**; selected **2px solid #0B66FF**.  
- **Node icons**: 20px SVGs consistent across UI.

### Connectors and edges
- **Connector points**: left and right sides, 12px radius; hover shows highlight.  
- **Edge style**: cubic bezier curved lines, stroke **2px**, color **#9AA6B2**; active edge **#0B66FF**.  
- **Arrowheads**: filled triangle **8px** at target.  
- **Edge labels**: optional small pill with mapping name, font **12px**.  
- **Edge routing**: auto‑routing with collision avoidance; allow manual reroute on drag.

### Component palette and drag behavior
- **Left palette**: collapsible list of components grouped by category (Sources, Transforms, Targets, Utilities).  
- **Palette item size**: **48px** height with icon and label.  
- **Drag preview**: semi‑transparent node preview; drop target highlights.  
- **Auto layout**: optional auto‑arrange to tidy nodes.

### Selection, multi‑select, and grouping
- **Single select**: click node.  
- **Multi‑select**: shift+click or marquee select; selected nodes show group bounding box.  
- **Group**: create named group container with collapsible behavior; group header **28px** height.  
- **Align and distribute**: toolbar actions for align left/center/right and distribute horizontally/vertically.

### Node properties and quick actions
- **Quick toolbar**: appears on node hover with icons for **Edit**, **Preview**, **Run**, **Duplicate**, **Delete**, **Comment**; toolbar floats near cursor for fast access.  
- **Smart action suggestions**: right edge of canvas shows suggested next nodes based on input schema (e.g., "Join with Users" if foreign key detected).  
- **Inline editing**: double click node title to edit; press Tab to jump to next editable field.  
- **Versioning**: node shows version badge; clicking opens version history modal with visual diff of node config.  
- **Node templates**: right-click node → **Save as Template** to create reusable node patterns with preset configs.

### Canvas performance targets
- **Nodes supported**: interactive performance up to **5,000 nodes** with progressive rendering; full fidelity for 0–500 nodes.  
- **Edge updates**: P95 interaction latency ≤ **50ms** for 0–500 nodes.  
- **Initial load**: canvas with 500 nodes should render within **1.5s** on standard enterprise laptop.

---

## Properties Panel and Data Preview
### Enhanced properties panel layout
- **Panel sections**: **Overview**, **Configuration**, **Schema Mapping**, **Advanced**, **Permissions**, **History**, **AI Suggestions**.  
- **Dynamic section loading**: sections load on demand to reduce memory footprint; currently visible section highlighted.  
- **Section header**: sticky within panel; header height **44px**; collapse/expand with chevron icon.  
- **Field layout**: two column form for wide screens; single column on narrow screens.  
- **Field label**: **Inter 500 13px #374151**; field value font **Inter 400 14px #111827**; required fields marked with red asterisk.  
- **Inline validation**: red text **#DC2626** 12px under field with error icon; success green **#16A34A** with checkmark.  
- **Smart defaults**: panel suggests common values based on node type and upstream schema.

### Property types and controls
- **Text**: single line and multi‑line with character counter for descriptions.  
- **Select**: single and multi with search, type-ahead autocomplete, and recently used items pinned.  
- **Toggle**: rounded switch 44×24px with inline label.  
- **Number**: spinner with min/max and unit selectors (e.g., seconds, milliseconds).  
- **Code editor**: embedded monaco editor for SQL/expressions; theme light with line numbers, syntax highlighting, and inline error squiggles; font **Monaco 13px**; autocomplete for column names.  
- **Mapping UI**: drag source columns to target columns; show live preview of transformation expression; suggest common matches (exact name, fuzzy match).  
- **Test button**: run sample transformation with **Last N rows** sampling and show result with row count and execution time.  
- **AI Suggestions**: ML-based column mapping hints and transformation recommendations based on schema similarity.

### Advanced data preview panel
- **Default rows**: show first **100 rows** with pagination and sampling options; remember user's last sampling choice.  
- **Preview height**: default **260px**; resizable to **50%** of viewport; height persists across sessions.  
- **Column headers**: sticky, font **Inter 600 12px**; click to sort; right-click for column actions (hide, pin, move).  
- **Cell font**: **Inter 400 13px**; numeric alignment right; date/time cells show formatted value with ISO tooltip.  
- **Row actions**: copy row, open row details, star favorite rows, flag problematic rows.  
- **Schema view**: toggle to show detailed schema with icons for PK/FK/UK, data types, nullable status, and sample values.  
- **Sampling controls**: top right dropdown with **First N**, **Random N**, **Stratified Sample**, **Last Modified** options.  
- **Data profiling**: small inline stats for visible columns (null count %, distinct values, min/max for numerics).  
- **Export preview**: CSV/JSON/Parquet export button with format options modal.  
- **Search within preview**: Ctrl+F opens in-table search highlighting matching cells; navigate with arrow keys.

---

## Tabs, Window Management, and Object Tabs Behavior
### Tab semantics and lifecycle
- **Open action**: double click or context menu opens object in a new tab.  
- **Tab types**: **Editor Tab** (pipeline, SQL editor), **Viewer Tab** (table preview, schema), **Dashboard Tab** (monitoring).  
- **Tab state**: each tab stores its own layout, unsaved changes indicator (dot), and local undo stack.  
- **Tab persistence**: tabs persist across sessions and devices for the same user.  
- **Tab duplication**: duplicate tab clones state; useful for branching edits.

### Tab content layout rules
- **Per‑object tabs**: each object tab can contain **sub‑tabs** (Overview, Properties, Preview, Lineage, History).  
- **Sub‑tab bar**: inside tab content, sub‑tab bar height **40px**; sub‑tab label font **Inter 600 13px**.  
- **Split view**: allow horizontal or vertical split inside a tab; split handles **8px** thick.  
- **Docking**: allow dragging a tab out to create a new window (desktop only) or to dock side by side.

### Tab interactions and keyboard shortcuts
- **Open new tab**: double click or Ctrl/Cmd+Enter on selected object.  
- **Close tab**: Ctrl/Cmd+W or click X.  
- **Switch tabs**: Ctrl/Cmd+Tab cycles forward; Ctrl/Cmd+Shift+Tab cycles backward.  
- **Pin tab**: Ctrl/Cmd+P or right-click → Pin.  
- **Save**: Ctrl/Cmd+S saves active tab; highlight unsaved changes with orange dot on tab.  
- **Undo/Redo**: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z for tab local edits; show undo stack preview on long-hover.  
- **Find in tab**: Ctrl/Cmd+F opens search within tab; highlight all matches with badge counts.  
- **Toggle properties**: Alt+P shows/hides right panel; Alt+L shows/hides left panel.  
- **Quick preview**: Alt+D shows data preview overlay without opening full preview panel.  
- **Node jump**: Ctrl/Cmd+J opens node jump dialog to navigate canvas by node name.

### Tab UX rules
- **No overwrite**: opening an object always creates a new tab unless user explicitly chooses to reuse an existing tab.  
- **Conflict resolution**: if two users edit same object, show live presence and conflict resolution modal on save.  
- **Autosave**: autosave drafts every **10s**; explicit save commits to version history.  
- **Close with unsaved changes**: prompt with options **Save**, **Discard**, **Cancel**.

---

## Icons Typography Colors and Visual Tokens
### Typography tokens
- **Primary font**: **Inter** for UI text.  
- **Monospace**: **Monaco** or **Fira Code** for code editors.  
- **Font weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).  
- **Base sizes**: body **14px**, small **12px**, large **16px**, headings H1 **28px**, H2 **22px**, H3 **18px**.  
- **Line height**: 1.4 for body, 1.2 for headings.

### Color palette
- **Primary**: **Blue 600** `#0B66FF`  
- **Primary Light**: `#E6F0FF`  
- **Accent**: **Teal 500** `#06B6D4`  
- **Success**: `#16A34A`  
- **Warning**: `#F59E0B`  
- **Danger**: `#DC2626`  
- **Surface**: `#FFFFFF`  
- **Muted surface**: `#F6F7F9`  
- **Text primary**: `#111827`  
- **Text secondary**: `#6B7280`  
- **Border**: `#E6E9EE`  
- **Shadow**: `rgba(2,6,23,0.08)`

### Iconography
- **Style**: flat, 2px stroke, 16–20px SVG icons.  
- **Icon set**: custom enterprise set with consistent stroke width and corner radii.  
- **Status badges**: small circles 8px with color semantics (green/yellow/red).  
- **Spacing**: 8px between icon and label.

### Example CSS tokens snippet
```css
:root {
  --font-base: "Inter", sans-serif;
  --font-mono: "Fira Code", monospace;
  --color-primary: #0B66FF;
  --color-surface: #FFFFFF;
  --color-border: #E6E9EE;
  --font-size-base: 14px;
  --spacing-1: 8px;
  --spacing-2: 16px;
}
```

---

## Advanced UX Features and Power User Enhancements
### Visual Data Lineage and Impact Analysis
- **Lineage view**: toggle to show upstream and downstream dependencies as interactive graph overlay on canvas.  
- **Column-level lineage**: click column in data preview to highlight its lineage path (which source column, which transforms, which targets).  
- **Impact analysis**: right-click node → **Show Impact** to highlight all downstream nodes that will be affected by changes.  
- **Lineage history**: timeline slider showing how lineage evolved over pipeline versions.  
- **Lineage search**: search for column name across entire lineage and jump to node.

### Transform preview and before/after sidebars
- **Side-by-side preview**: when editing a Transform node, optionally show **Before** (input data) and **After** (output data) panes side-by-side.  
- **Column mapping matrix**: visual grid showing source columns mapped to target columns with preview values.  
- **Live transformation result**: as user edits SQL/expression, show live preview update (with debounce).  
- **Row-level changes**: highlight which rows changed, which are new, which are deleted.  
- **Data quality score**: show % of rows passing transform without errors/nulls.

### Smart node suggestions and templates
- **Next node suggestions**: based on selected node's output schema, float a context panel suggesting relevant next nodes (Join with X, Aggregate by Y, etc.).  
- **Template library**: built-in library of common transform patterns (e.g., "Standard Rename", "Type Coercion", "Null Handling Pattern").  
- **Template marketplace**: ability to browse and import community-created templates.  
- **Batch operations**: select multiple nodes with same config → bulk edit or apply template to all.  
- **Node diff**: compare two similar nodes and visualize config differences.

### Enhanced command palette and navigation
- **Command palette** (Ctrl/Cmd+K): global command runner with fuzzy search; categories for **Create**, **Open**, **Edit**, **Run**, **Settings**, **Help**.  
- **Recent actions**: show recently used commands with keyboard shortcuts displayed.  
- **Custom commands**: allow users to record and replay complex workflows.  
- **Object search**: prefix search with `@` to search tree objects; results show full path and preview.  
- **Command history**: reverse search through past commands (Ctrl+R).

### Bookmarks favorites and workspaces
- **Node bookmarks**: star frequently-used nodes, datasets, or transformations for quick access from top of left panel.  
- **Saved queries**: save common preview queries and reuse them across tabs.  
- **Project workspaces**: save workspace layout (open tabs, split panes, zoom level, scroll position) and restore with one click.  
- **Workspace snapshots**: before major changes, create a snapshot; revert to prior layout/state in one click.  
- **Tab groups**: organize related tabs into named groups that can be toggled on/off.

### Dark mode and density options
- **Dark mode**: full dark theme support respecting OS dark mode preference; smooth transition between modes.  
- **Compact density**: toggle to show more content in same space; reduce padding, font sizes, and panel widths by 10–15%.  
- **Code editor themes**: multiple themes available (Dracula, Nord, Solarized, etc.) with user preference saved.  
- **High contrast mode**: WCAG AAA contrast for users with visual impairment.  
- **Custom color schemes**: allow teams to apply brand colors to UI.

### Live collaboration and presence
- **Real-time presence**: show active collaborators in same pipeline with avatars and current action (editing node X, viewing tab Y).  
- **Live cursors**: see collaborator cursors on canvas with name label and color-coding.  
- **Conflict resolution UI**: when two users edit same node, show side-by-side conflict view; choose which version to keep or merge.  
- **Activity timeline**: list of recent changes with authors, timestamps, and ability to jump to changed nodes.  
- **Comments with mentions**: threaded comments on nodes/edges; mention users with @handle; comments show avatar, timestamp, resolve/archive.

### Data quality and monitoring dashboard
- **Quick health check**: header badge showing pipeline health (red/yellow/green); click to expand health details.  
- **Data quality metrics**: dedicated panel showing null %, duplicate %, data type mismatches, recent error rates.  
- **Anomaly detection**: flag unexpected data patterns (sudden NULL spike, value distribution shift).  
- **Performance monitoring**: show average node execution time, peak time, trend over last N runs.  
- **Alert rules**: create rules for data quality thresholds and send notifications when triggers fire.

### Keyboard-first and accessibility enhancements
- **Keyboard navigation**: all actions accessible via keyboard; Tab key navigates logically through UI; arrow keys pan/scroll.  
- **Quick keys**: single-key shortcuts for power users (e.g., `a` to add node, `d` to delete, `r` to run).  
- **Accessibility panel**: toggle to show/hide all keyboard shortcuts, ARIA landmarks, and focus indicators.  
- **Speech control**: optional voice command support for hands-free workflow ("add join node", "run pipeline").  
- **Screen reader optimized**: full ARIA markup; semantic HTML; descriptive alt text for icons and visualizations.

### Undo/Redo and version control visualization
- **Undo timeline**: click the undo count to open a visual timeline of recent actions; jump back to any point.  
- **Version comparison**: compare two pipeline versions side-by-side showing node additions, deletions, and config changes.  
- **Diff view**: detailed SQL/expression diffs between versions with syntax highlighting.  
- **Atomic actions**: group related node changes into a single undo step.  
- **Branch and merge**: branch a pipeline to experiment, then merge changes back to main with conflict resolution.

### Profile and preview optimization
- **Lazy loading profiles**: inline stats in tree nodes show for visible items only; load on scroll.  
- **Cached profiles**: reuse cached data profiles when opening recently-viewed datasets.  
- **Quick profile**: small icon shows basic stats (row count, size) without full profile fetch.  
- **Profile scheduling**: mark datasets for periodic background profiling; results auto-update in tree.  
- **Custom metrics**: allow users to define custom metrics (e.g., distinct account count) and pin them.

---

## Interactions Accessibility and Collaboration
### Interaction patterns
- **Drag and drop**: smooth animations with follow-cursor preview, ghost image, and valid drop zones highlighted; cancel on Esc.  
- **Contextual help**: inline tooltips on hover with 300ms delay; help icon opens contextual docs in sidebar; tutorial overlays for first-time users.  
- **Undo confirmation**: show what action is being undone before applying.  
- **Multi-step operations**: maintain state across dialogs; allow saving partial progress.  
- **Loading states**: skeleton screens for async operations; progress bars for long-running tasks; cancel button if cancellable.  
- **Notifications**: non‑modal toast for background job completion (success green, warn yellow, error red); persistent activity center for history with filtering.  
- **Modals and dialogs**: centered, with overlay dim; escape closes unless unsaved changes present; tab focus trapped; required fields validated before submit.

### Accessibility requirements
- **WCAG 2.1 AA** compliance minimum.  
- **Keyboard only**: all actions reachable via keyboard.  
- **Screen reader**: ARIA roles for tree, canvas nodes, dialogs, and forms.  
- **Contrast**: text contrast ≥ 4.5:1 for body text; UI elements meet contrast thresholds.  
- **Focus states**: visible focus ring **2px** solid `#0B66FF` for interactive elements.  
- **Reduced motion**: respect OS reduced motion settings.

### Collaboration features
- **Live presence**: show avatars and names of collaborators currently editing tab; indicate which node they're editing.  
- **Comments and annotations**: threaded comments on nodes and edges with @ mentions; resolve/reopen comments; see comment thread in side panel.  
- **Live cursors**: show real-time cursor positions of collaborators on canvas with labeled pointers.  
- **Activity feed**: chronological timeline with who changed what when; click to jump to changed node; filter by user or action type.  
- **Change notifications**: receive notifications when collaborators make changes; option to auto-scroll to recent edit.  
- **Permissions and roles**: role-based access control with roles: **Viewer** (read-only), **Editor** (edit own tabs), **Owner** (all access + invite), **Admin** (org-level).  
- **Change requests**: propose changes that other team members must approve before merging (similar to git PR).  
- **Audit trail**: immutable log of all CRUD and run actions with user, timestamp, before/after state.

---

## Security Performance and Operational Requirements
### Security
- **Authentication**: SSO via SAML/OAuth2; optional MFA.  
- **Authorization**: RBAC and attribute based access control for objects and actions.  
- **Encryption**: TLS in transit; encryption at rest for persisted snapshots and index files.  
- **Audit logs**: immutable audit trail for CRUD and run actions.  
- **Secrets management**: integrate with vaults for connection credentials.

### Performance SLOs
- **Tab open latency**: P95 ≤ **300ms** for cached objects; cold load ≤ **1.5s**.  
- **Canvas interaction**: P95 ≤ **50ms** for 0–500 nodes.  
- **Query preview**: first row visible ≤ **200ms** for cached previews; full 100 rows ≤ **1s** for typical small datasets.  
- **Index rebuild**: background reindex jobs should not block UI; progress visible.

### Scalability and storage
- **Metadata scale**: support catalogs with **millions** of objects; tree virtualization required.  
- **Canvas scale**: progressive rendering for very large graphs; cluster nodes into visual groups.  
- **Caching**: local NVMe cache for sidecar deployments; global cache for shared hot sets.  
- **Backups**: nightly snapshots and point‑in‑time restore for project state.

---

## Deliverables Acceptance Criteria and Handoff
### Deliverables
- **High fidelity UI mockups** for desktop (1920×1080, 1440×900), tablet (768×1024), mobile (375×667).  
- **Interactive prototype** for pipeline canvas with drag/drop, zoom, pan, node editing, and lineage visualization.  
- **Design system and component library** with:
  - Tokens file (colors, typography, spacing, shadows, border radius, icon set).  
  - Reusable component specs (Button, Input, Select, Modal, Toast, Tree, etc.) with states (default, hover, active, disabled, loading).  
  - Dark mode and compact density themes.  
- **User flow diagrams** for CRUD operations, data preview, lineage exploration, and collaboration workflows.  
- **Wireframes** for advanced features (lineage view, power user shortcuts, collaboration UI, data quality dashboard).  
- **Accessibility audit report** with WCAG 2.1 AA and AAA compliance results.  
- **Performance benchmark report** with measurements for canvas interaction, preview load, tab open latency.  
- **API contract documentation** for backend endpoints (metadata tree, preview, lineage, run, versioning, activity feed).  
- **QA test plan** including:
  - Unit tests for components.  
  - Integration tests for CRUD workflows.  
  - E2E tests for critical user journeys (create pipeline, add nodes, preview data, run pipeline).  
  - Accessibility tests (keyboard navigation, screen reader, contrast).  
  - Performance tests (canvas load time, interaction latency).  
- **Documentation**:
  - User guide with screenshots and videos.  
  - Keyboard shortcuts cheat sheet.  
  - Admin guide for setting up collaborations and permissions.  
  - Developer guide for extending UI with custom node types.

### Acceptance criteria
- **UI fidelity**: mockups match design tokens within 1px tolerance; all interactive states implemented (hover, focus, disabled, loading).  
- **Functionality**: all CRUD, navigation, and collaboration features work end-to-end with proper error handling and undo support.  
- **Performance**: 
  - Canvas rendering P95 ≤ 50ms for 0–500 nodes.  
  - Tab open latency P95 ≤ 300ms (cached) and ≤ 1.5s (cold load).  
  - Data preview first row visible ≤ 200ms; full 100 rows ≤ 1s.  
  - Lineage computation ≤ 500ms for 500 nodes.  
- **Accessibility**: passes automated and manual WCAG 2.1 AA tests; all keyboard shortcuts documented and working.  
- **Security**: SSO/OAuth2 authentication, RBAC, and audit logging implemented; secrets redacted from UI.  
- **Collaboration**: live presence, comments, activity feed, and conflict resolution working across multiple users.

---

## Appendix Quick Reference
### Key sizes and tokens
- **Header**: 56px  
- **Left rail**: 280px / collapsed 72px  
- **Right rail**: 360px / collapsed 48px  
- **Bottom preview**: 260px / collapsed 40px  
- **Tab bar**: 48px; tab min width 160px, max 360px  
- **Node min size**: 160×56px; header 40px; toolbar appears on hover  
- **Icon sizes**: tree 16px; node 20px; toolbar 18px; status badges 8px  
- **Fonts**: Inter base 14px, small 12px, large 16px; Monaco 13px for code; H1 28px, H2 22px, H3 18px  
- **Spacing base**: 8px unit; use multiples (8, 16, 24, 32, 40, 48)

### Color palette quick reference
| Name | Hex | Usage |
|---|---|---|
| Primary Blue | `#0B66FF` | Links, active states, primary buttons |
| Primary Light | `#E6F0FF` | Backgrounds, hover states |
| Success Green | `#16A34A` | Success messages, valid states |
| Warning Amber | `#F59E0B` | Warnings, pending states |
| Danger Red | `#DC2626` | Errors, destructive actions |
| Text Primary | `#111827` | Body text, labels |
| Text Secondary | `#6B7280` | Hints, secondary text |
| Border | `#E6E9EE` | Dividers, borders |
| Surface | `#FFFFFF` | Backgrounds |
| Muted Surface | `#F6F7F9` | Inactive panels, alt backgrounds |

### Keyboard shortcuts summary
| Action | Shortcut |
|---|---|
| Command palette | Ctrl/Cmd+K |
| Save | Ctrl/Cmd+S |
| Save all | Ctrl/Cmd+Shift+S |
| Close tab | Ctrl/Cmd+W |
| Close all tabs | Ctrl/Cmd+Shift+W |
| Next tab | Ctrl/Cmd+Tab |
| Prev tab | Ctrl/Cmd+Shift+Tab |
| Pin tab | Ctrl/Cmd+P |
| Undo | Ctrl/Cmd+Z |
| Redo | Ctrl/Cmd+Shift+Z |
| Find in tab | Ctrl/Cmd+F |
| Find in tree | Ctrl/Cmd+Shift+F |
| Rename node/item | F2 |
| Delete node/item | Delete |
| Duplicate node | Ctrl/Cmd+D |
| Toggle properties panel | Alt+P |
| Toggle left panel | Alt+L |
| Toggle preview | Alt+D |
| Quick preview overlay | Alt+Shift+D |
| Node jump dialog | Ctrl/Cmd+J |
| Show/hide lineage | Ctrl/Cmd+Shift+L |
| Run selected node | Ctrl/Cmd+Enter |
| Run full pipeline | Ctrl/Cmd+Shift+Enter |
| Pan canvas | Space+drag or middle-click |
| Zoom in | Ctrl/Cmd++ |
| Zoom out | Ctrl/Cmd+- |
| Fit to screen | Ctrl/Cmd+0 |
| Toggle dark mode | Ctrl/Cmd+\ |
| Focus mode | F11 |
| Accessibility help | Ctrl/Cmd+? |

### Power user shortcuts (single-key with focus on canvas)
| Key | Action |
|---|---|
| A | Add node (opens palette) |
| D | Delete selected node |
| E | Edit selected node properties |
| R | Run selected node |
| C | Comment on selected node |
| L | Show lineage for selected node |
| T | Save as template |
| S | Toggle node selection mode |
| Z | Zoom to fit selection |
| ? | Show/hide keyboard help |

### Node type icons and colors
| Node Type | Color | Icon | Common Configs |
|---|---|---|---|
| Source | `#E6F4FF` | Database/file icon | Connection, table, query |
| Transform | `#FFF7E6` | Gear icon | SQL/expression, mapping |
| Join | `#FFF7E6` | Link icon | Join type, keys, output columns |
| Aggregate | `#FFF7E6` | Stack icon | Group by, aggregation functions |
| Filter | `#FFF7E6` | Funnel icon | Where condition |
| Sort | `#FFF7E6` | Arrow icon | Sort columns, order |
| Target | `#E8FFF0` | Download icon | Connection, table, append/overwrite |
| Custom | `#F3E8FF` | Code icon | Custom code (PySpark/SQL) |
| Input | `#DDD` | Parameter icon | Parameter name, type, default |
| Output | `#DDD` | Output icon | Variable name, type |

### Responsive breakpoints
- **Desktop**: ≥1280px — full layout with all panels  
- **Tablet**: 768–1279px — left rail collapses to icons; right rail collapses on demand  
- **Mobile**: <768px — stacked layout; pipeline canvas read-only or simplified; tree and properties in modals

### Performance targets summary
| Operation | P50 | P95 | P99 |
|---|---|---|---|
| Canvas interaction (0–500 nodes) | 20ms | 50ms | 100ms |
| Tree scroll (1000+ items) | 16ms | 40ms | 60ms |
| Tab open (cached) | 100ms | 300ms | 500ms |
| Tab open (cold load) | 800ms | 1500ms | 2000ms |
| Data preview load (100 rows) | 100ms | 200ms | 500ms |
| Full preview (1000 rows) | 500ms | 1000ms | 2000ms |
| Lineage compute (500 nodes) | 200ms | 500ms | 1000ms |
| Search index (1M objects) | 50ms | 200ms | 500ms |

---

**End of specification**