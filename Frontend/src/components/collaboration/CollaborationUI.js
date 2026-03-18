import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export function PresenceAwareness({ collaborators }) {
    const activeCollaborators = collaborators.filter(c => c.isActive);
    return (_jsx("div", { className: "flex items-center gap-2", children: activeCollaborators.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex -space-x-2", children: activeCollaborators.slice(0, 3).map(collaborator => (_jsx("div", { className: "w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white", style: { backgroundColor: collaborator.color }, title: collaborator.name, children: collaborator.name.charAt(0).toUpperCase() }, collaborator.id))) }), _jsxs("span", { className: "text-xs text-neutral-600", children: [activeCollaborators.length, " editing"] })] })) }));
}
export function ActivityTimeline({ activities, maxItems = 10 }) {
    const displayActivities = activities.slice(0, maxItems);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Activity" }), _jsx("div", { className: "space-y-2 border-l-2 border-neutral-200 pl-3", children: displayActivities.map(activity => (_jsxs("div", { className: "text-sm", children: [_jsxs("p", { className: "text-neutral-900", children: [_jsx("strong", { children: activity.user }), " ", activity.action, " ", _jsx("code", { className: "bg-neutral-100 px-1 rounded text-xs", children: activity.target })] }), _jsx("p", { className: "text-xs text-neutral-500 mt-1", children: formatTime(activity.timestamp) })] }, activity.id))) })] }));
}
function formatTime(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1)
        return 'just now';
    if (diffMins < 60)
        return `${diffMins}m ago`;
    if (diffHours < 24)
        return `${diffHours}h ago`;
    if (diffDays < 7)
        return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
export function LiveCursor({ userId, userName, color, x, y }) {
    return (_jsxs("div", { className: "absolute pointer-events-none", style: {
            left: `${x}px`,
            top: `${y}px`,
            zIndex: 100,
        }, children: [_jsx("svg", { width: "30", height: "40", viewBox: "0 0 30 40", fill: "none", children: _jsx("path", { d: "M0 0L8 24L12 12L30 32L24 35L6 11L8 8Z", fill: color, stroke: "white", strokeWidth: "2" }) }), _jsx("div", { className: "absolute top-8 left-2 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap", style: { backgroundColor: color }, children: userName })] }));
}
