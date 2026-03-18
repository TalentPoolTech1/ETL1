import { jsx as _jsx } from "react/jsx-runtime";
export function Badge({ children, variant = 'primary', size = 'md' }) {
    const variantClasses = {
        primary: 'bg-primary-100 text-primary-800',
        success: 'bg-success-100 text-success-800',
        warning: 'bg-warning-100 text-warning-800',
        danger: 'bg-danger-100 text-danger-800',
        neutral: 'bg-neutral-100 text-neutral-800',
    };
    const sizeClasses = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-2 text-base',
    };
    return (_jsx("span", { className: `inline-block rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]}`, children: children }));
}
