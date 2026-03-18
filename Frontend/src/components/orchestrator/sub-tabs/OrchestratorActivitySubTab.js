import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Activity } from 'lucide-react';
export function OrchestratorActivitySubTab({ orchId }) {
    return (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 p-5", children: [_jsx(Activity, { className: "w-8 h-8 mb-2 opacity-30" }), _jsx("p", { className: "text-sm", children: "No activity recorded yet for this orchestrator." })] }));
}
