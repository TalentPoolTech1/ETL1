import { jsx as _jsx } from "react/jsx-runtime";
export function Spinner({ size = 'md', color = 'primary' }) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-6 h-6 border-2',
        lg: 'w-8 h-8 border-3',
    };
    const colorClass = color === 'primary' ? 'border-primary-600' : 'border-neutral-600';
    return (_jsx("div", { className: `inline-block ${sizeClasses[size]} border-t-transparent border-solid rounded-full animate-spin ${colorClass}` }));
}
