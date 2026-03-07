import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  addNode,
  deleteNode,
  selectNode,
  clearSelection,
} from '@/store/slices/pipelineSlice';
import { toggleFocusMode, toggleBottomPanel, toggleLeftRail } from '@/store/slices/uiSlice';
import { v4 as uuid } from 'uuid';

export interface ShortcutCommand {
  id: string;
  keys: string[];
  description: string;
  category: 'editor' | 'navigation' | 'view' | 'file';
  action: () => void;
}

export function useKeyboardShortcuts() {
  const dispatch = useAppDispatch();
  const { selectedNodeIds, nodes } = useAppSelector(state => state.pipeline);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  const commands: ShortcutCommand[] = [
    // Editor commands
    {
      id: 'add-source',
      keys: ['Ctrl', 'Shift', 'S'],
      description: 'Add Source Node',
      category: 'editor',
      action: () => {
        const newNode = {
          id: uuid(),
          type: 'source' as const,
          name: `Source ${Object.keys(nodes).length + 1}`,
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          width: 160,
          height: 56,
          config: {},
          inputs: [],
          outputs: [{ id: uuid(), name: 'output', type: 'any' }],
          version: 1,
        };
        dispatch(addNode(newNode));
      },
    },
    {
      id: 'add-transform',
      keys: ['Ctrl', 'Shift', 'T'],
      description: 'Add Transform Node',
      category: 'editor',
      action: () => {
        const newNode = {
          id: uuid(),
          type: 'transform' as const,
          name: `Transform ${Object.keys(nodes).length + 1}`,
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          width: 160,
          height: 56,
          config: {},
          inputs: [{ id: uuid(), name: 'input', type: 'any' }],
          outputs: [{ id: uuid(), name: 'output', type: 'any' }],
          version: 1,
        };
        dispatch(addNode(newNode));
      },
    },
    {
      id: 'add-target',
      keys: ['Ctrl', 'Shift', 'E'],
      description: 'Add Target Node',
      category: 'editor',
      action: () => {
        const newNode = {
          id: uuid(),
          type: 'target' as const,
          name: `Target ${Object.keys(nodes).length + 1}`,
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          width: 160,
          height: 56,
          config: {},
          inputs: [{ id: uuid(), name: 'input', type: 'any' }],
          outputs: [],
          version: 1,
        };
        dispatch(addNode(newNode));
      },
    },
    {
      id: 'delete-selected',
      keys: ['Delete'],
      description: 'Delete Selected Node(s)',
      category: 'editor',
      action: () => {
        selectedNodeIds.forEach(id => dispatch(deleteNode(id)));
        dispatch(clearSelection());
      },
    },
    {
      id: 'select-all',
      keys: ['Ctrl', 'A'],
      description: 'Select All Nodes',
      category: 'editor',
      action: () => {
        Object.keys(nodes).forEach(id => {
          dispatch(selectNode({ id, multiSelect: true }));
        });
      },
    },
    {
      id: 'deselect-all',
      keys: ['Escape'],
      description: 'Deselect All',
      category: 'editor',
      action: () => {
        dispatch(clearSelection());
      },
    },
    // Navigation
    {
      id: 'command-palette',
      keys: ['Ctrl', 'K'],
      description: 'Open Command Palette',
      category: 'navigation',
      action: () => {
        setShowCommandPalette(prev => !prev);
      },
    },
    {
      id: 'toggle-focus-mode',
      keys: ['F11'],
      description: 'Toggle Focus Mode',
      category: 'view',
      action: () => {
        dispatch(toggleFocusMode());
      },
    },
    {
      id: 'toggle-bottom-panel',
      keys: ['Ctrl', 'J'],
      description: 'Toggle Bottom Panel',
      category: 'view',
      action: () => {
        dispatch(toggleBottomPanel());
      },
    },
    {
      id: 'toggle-left-sidebar',
      keys: ['Ctrl', 'B'],
      description: 'Toggle Left Sidebar',
      category: 'view',
      action: () => {
        dispatch(toggleLeftRail());
      },
    },
    {
      id: 'save-pipeline',
      keys: ['Ctrl', 'S'],
      description: 'Save Pipeline',
      category: 'file',
      action: () => {
        console.log('Save triggered');
      },
    },
    {
      id: 'run-pipeline',
      keys: ['Ctrl', 'Enter'],
      description: 'Run Pipeline',
      category: 'file',
      action: () => {
        console.log('Run triggered');
      },
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for each command
      commands.forEach(cmd => {
        const isMatch = matchesKeyCombination(e, cmd.keys);
        if (isMatch) {
          e.preventDefault();
          cmd.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, nodes, showCommandPalette]);

  return {
    commands,
    showCommandPalette,
    setShowCommandPalette,
    commandSearch,
    setCommandSearch,
  };
}

function matchesKeyCombination(e: KeyboardEvent, keys: string[]): boolean {
  const keyLower = e.key.toLowerCase();
  const hasCtrl = keys.includes('Ctrl') ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
  const hasShift = keys.includes('Shift') ? e.shiftKey : !e.shiftKey;
  const mainKey = keys[keys.length - 1].toLowerCase();

  return hasCtrl && hasShift && keyLower === mainKey;
}
