import React, { useState, useEffect, useRef } from 'react';
import { ShortcutCommand } from '@/hooks/useKeyboardShortcuts';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: ShortcutCommand[];
  searchText: string;
  onSearchChange: (text: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  commands,
  searchText,
  onSearchChange,
}: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCommands = commands.filter(cmd =>
    cmd.description.toLowerCase().includes(searchText.toLowerCase()) ||
    cmd.id.toLowerCase().includes(searchText.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-12 z-50">
      <div className="bg-[#161b25] rounded-lg shadow-xl w-96 max-h-96 overflow-hidden flex flex-col">
        {/* Search */}
        <input
          ref={inputRef}
          type="text"
          placeholder="Search commands..."
          value={searchText}
          onChange={e => {
            onSearchChange(e.target.value);
            setSelectedIndex(0);
          }}
          className="px-4 py-3 border-b border-slate-800 text-sm focus:outline-none"
          onKeyDown={e => {
            if (e.key === 'Escape') {
              onClose();
            }
          }}
        />

        {/* Command list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-neutral-500 text-sm">
              No commands found
            </div>
          ) : (
            <div>
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  className={`
                    w-full px-4 py-3 text-left text-sm flex items-center justify-between
                    ${idx === selectedIndex ? 'bg-primary-50' : 'hover:bg-neutral-50'}
                  `}
                >
                  <div>
                    <p className="font-medium text-neutral-900">{cmd.description}</p>
                    <p className="text-xs text-neutral-500">{cmd.category}</p>
                  </div>
                  <div className="text-xs text-neutral-500 font-mono">
                    {cmd.keys.join('+')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
