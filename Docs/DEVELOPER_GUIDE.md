# Frontend Developer Quick Reference

## Structure Quick Lookup

### Adding a new UI component
1. Create in `src/components/common/YourComponent.tsx`
2. Export from component module
3. Use in pages/layouts

### Adding Redux state
1. Create slice in `src/store/slices/yourSlice.ts`
2. Import and add to store in `src/store/index.ts`
3. Use with `useAppSelector` and `useAppDispatch` hooks

### Adding an API endpoint
1. Add method to `src/services/api.ts`
2. Call from service/component with `api.yourMethod()`

### Adding a keyboard shortcut
1. Add to `KEYBOARD_SHORTCUTS` in `src/utils/keyboard.ts`
2. Listen for it in component with `isShortcutPressed(e, KEYBOARD_SHORTCUTS.YOUR_SHORTCUT)`

## Common Patterns

### Using Redux
```typescript
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectNode } from '@/store/slices/pipelineSlice';

export function MyComponent() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector(state => state.pipeline.nodes);
  
  return (
    <button onClick={() => dispatch(selectNode({ id: 'node-1' }))}>
      Select Node
    </button>
  );
}
```

### Using API
```typescript
import { api } from '@/services/api';

async function loadPipeline(id: string) {
  try {
    const response = await api.getPipeline(id);
    console.log(response.data);
  } catch (error) {
    console.error('Failed to load pipeline', error);
  }
}
```

### Styling with Tailwind
```typescript
// Use className with theme tokens
<div className="px-4 py-2 bg-primary-50 text-primary-900 rounded-md border border-primary-300">
```

### Keyboard Shortcuts
```typescript
import { KEYBOARD_SHORTCUTS, isShortcutPressed } from '@/utils/keyboard';

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (isShortcutPressed(e, KEYBOARD_SHORTCUTS.SAVE)) {
      e.preventDefault();
      handleSave();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

## File Organization

```
src/
├── components/
│   ├── common/          # Reusable components
│   ├── layout/          # Page shells and layouts
│   ├── canvas/          # Canvas-specific components
│   ├── tabs/            # Tab management
│   ├── properties/      # Properties panel
│   └── preview/         # Data preview
├── pages/               # Full pages (future)
├── store/               # Redux state
├── services/            # API, WebSocket, etc.
├── utils/               # Utilities
├── types/               # TypeScript definitions
├── styles/              # Global styles
└── App.tsx              # Root component
```

## Debug Tips

### Inspect Redux State
```typescript
// In browser console
import { store } from '/src/store'
console.log(store.getState())
```

### Monitor Component Rerenders
```typescript
// Add to top of component
console.log('ComponentName rendered');
```

### Tailwind Classes Not Working
- Make sure file path is in `tailwind.config.js` content array
- Clear node_modules/.vite if CSS is cached
- Restart dev server

## Performance Checklist

- [ ] Large lists use virtualization (react-window)
- [ ] Components use React.memo if receiving stable props
- [ ] Redux selectors are memoized
- [ ] Expensive computations moved to utils
- [ ] Lazy loaded components for code splitting

## Testing

```bash
# Unit tests
npm run test

# With UI
npm run test:ui

# Example test
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/common/Button';

it('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

## Common Issues

| Issue | Solution |
|-------|----------|
| CSS not applying | Check tailwind.config.js content paths |
| Redux state not updating | Check action.payload matches reducer expectations |
| Component not rerendering | Verify selector dependency array, check React.memo |
| API calls failing | Check VITE_API_URL in .env, CORS headers on backend |
| Memory leak warning | Remove event listeners in useEffect cleanup |

---

**Need help? Check the component source code and existing implementations first!**
