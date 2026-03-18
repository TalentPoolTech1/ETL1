import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export function Tooltip({ content, children, position = 'top' }) {
    const [isVisible, setIsVisible] = useState(false);
    const positionClasses = {
        top: 'bottom-full mb-2',
        bottom: 'top-full mt-2',
        left: 'right-full mr-2',
        right: 'left-full ml-2',
    };
    return (_jsxs("div", { className: "relative inline-block", children: [_jsx("div", { onMouseEnter: () => setIsVisible(true), onMouseLeave: () => setIsVisible(false), children: children }), isVisible && (_jsxs("div", { className: `absolute ${positionClasses[position]} bg-neutral-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none`, children: [content, _jsx("div", { className: `absolute ${position === 'top'
                            ? 'top-full'
                            : position === 'bottom'
                                ? 'bottom-full'
                                : position === 'left'
                                    ? 'left-full'
                                    : 'right-full'} w-1.5 h-1.5 bg-neutral-900`, style: {
                            borderRadius: '50%',
                        } })] }))] }));
}
