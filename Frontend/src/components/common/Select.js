import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
export function Select({ value, onChange, options, label, placeholder = 'Select...', disabled = false, }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const containerRef = useRef(null);
    const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(searchText.toLowerCase()));
    const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!containerRef.current?.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    return (_jsxs("div", { ref: containerRef, className: "relative", children: [label && (_jsx("label", { className: "text-sm font-medium text-neutral-700 block mb-1", children: label })), _jsxs("button", { onClick: () => !disabled && setIsOpen(!isOpen), disabled: disabled, className: "w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-left text-sm flex items-center justify-between disabled:bg-neutral-50 disabled:text-neutral-500", children: [_jsx("span", { children: selectedLabel }), _jsx("span", { className: `transition-transform ${isOpen ? 'rotate-180' : ''}`, children: "\u25BC" })] }), isOpen && (_jsxs("div", { className: "absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-300 rounded-md shadow-lg z-50 max-h-48 overflow-hidden flex flex-col", children: [_jsx("input", { type: "text", placeholder: "Search...", value: searchText, onChange: e => setSearchText(e.target.value), className: "px-3 py-2 border-b border-neutral-200 text-sm focus:outline-none", autoFocus: true }), _jsx("div", { className: "overflow-y-auto flex-1", children: filteredOptions.map(opt => (_jsx("button", { onClick: () => {
                                onChange(opt.value);
                                setIsOpen(false);
                                setSearchText('');
                            }, className: "w-full px-3 py-2 text-left text-sm hover:bg-primary-50 hover:text-primary-700", children: opt.label }, opt.value))) })] }))] }));
}
