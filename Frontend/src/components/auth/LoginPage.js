import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { setAuthStart, setAuthSuccess, setAuthFailure } from '@/store/slices/authSlice';
import apiClient from '@/services/api';
export function LoginPage() {
    const dispatch = useAppDispatch();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        dispatch(setAuthStart());
        try {
            const response = await apiClient.login(email, password);
            const { token, user } = response.data.data;
            localStorage.setItem('authToken', token);
            localStorage.setItem('userId', user.userId);
            dispatch(setAuthSuccess({
                user: { id: user.userId, email: user.email, fullName: user.fullName },
                permissions: [],
            }));
            window.history.replaceState({}, '', '/');
        }
        catch (err) {
            const msg = err?.response?.data?.message ||
                err?.response?.data?.userMessage ||
                'Invalid email or password';
            setError(msg);
            dispatch(setAuthFailure(msg));
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-[#0d0f1a]", children: _jsx("div", { className: "w-full max-w-sm", children: _jsxs("div", { className: "bg-[#161929] border border-[#2a2f4a] rounded-2xl p-8 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-center mb-8", children: [_jsx("div", { className: "w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mr-3", children: _jsx("svg", { className: "w-5 h-5 text-white", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" }) }) }), _jsx("span", { className: "text-white text-xl font-semibold tracking-tight", children: "ETL1 Platform" })] }), _jsx("h1", { className: "text-white text-lg font-medium text-center mb-6", children: "Sign in to your account" }), error && (_jsx("div", { className: "bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-5", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-slate-400 mb-1.5", children: "Email address" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", required: true, value: email, onChange: e => setEmail(e.target.value), className: "w-full bg-[#0d0f1a] border border-[#2a2f4a] text-white rounded-lg px-3.5 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition", placeholder: "you@example.com" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-slate-400 mb-1.5", children: "Password" }), _jsx("input", { id: "password", type: "password", autoComplete: "current-password", required: true, value: password, onChange: e => setPassword(e.target.value), className: "w-full bg-[#0d0f1a] border border-[#2a2f4a] text-white rounded-lg px-3.5 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2 mt-2", children: loading ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-4 w-4 text-white", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })] }), "Signing in\u2026"] })) : ('Sign in') })] })] }) }) }));
}
export default LoginPage;
