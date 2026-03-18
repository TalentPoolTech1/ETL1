import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';
export function ThemeProvider({ children }) {
    const { theme, density } = useAppSelector(state => state.ui);
    useEffect(() => {
        // Apply theme to document root
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        root.setAttribute('data-density', density);
        // Apply Tailwind dark mode class if needed
        if (theme === 'dark') {
            root.classList.add('dark');
        }
        else {
            root.classList.remove('dark');
        }
    }, [theme, density]);
    return _jsx(_Fragment, { children: children });
}
