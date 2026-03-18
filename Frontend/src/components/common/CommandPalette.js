import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
export function CommandPalette({ isOpen, onClose, commands, searchText, onSearchChange, }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const filteredCommands = commands.filter(cmd => cmd.description.toLowerCase().includes(searchText.toLowerCase()) ||
        cmd.id.toLowerCase().includes(searchText.toLowerCase()));
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setSelectedIndex(0);
        }
    }, [isOpen]);
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen)
                return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            }
            else if (e.key === 'Enter') {
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
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-12 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl w-96 max-h-96 overflow-hidden flex flex-col", children: [_jsx("input", { ref: inputRef, type: "text", placeholder: "Search commands...", value: searchText, onChange: e => {
                        onSearchChange(e.target.value);
                        setSelectedIndex(0);
                    }, className: "px-4 py-3 border-b border-neutral-200 text-sm focus:outline-none", onKeyDown: e => {
                        if (e.key === 'Escape') {
                            onClose();
                        }
                    } }), _jsx("div", { ref: listRef, className: "flex-1 overflow-y-auto", children: filteredCommands.length === 0 ? (_jsx("div", { className: "px-4 py-8 text-center text-neutral-500 text-sm", children: "No commands found" })) : (_jsx("div", { children: filteredCommands.map((cmd, idx) => (_jsxs("button", { onClick: () => {
                                cmd.action();
                                onClose();
                            }, className: `
                    w-full px-4 py-3 text-left text-sm flex items-center justify-between
                    ${idx === selectedIndex ? 'bg-primary-50' : 'hover:bg-neutral-50'}
                  `, children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-neutral-900", children: cmd.description }), _jsx("p", { className: "text-xs text-neutral-500", children: cmd.category })] }), _jsx("div", { className: "text-xs text-neutral-500 font-mono", children: cmd.keys.join('+') })] }, cmd.id))) })) })] }) }));
}
