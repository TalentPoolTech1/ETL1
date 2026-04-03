import React from 'react';

interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isActive: boolean;
  lastSeen?: string;
}

interface PresenceAwarenessProps {
  collaborators: Collaborator[];
}

export function PresenceAwareness({ collaborators }: PresenceAwarenessProps) {
  const activeCollaborators = collaborators.filter(c => c.isActive);

  return (
    <div className="flex items-center gap-2">
      {activeCollaborators.length > 0 && (
        <>
          <div className="flex -space-x-2">
            {activeCollaborators.slice(0, 3).map(collaborator => (
              <div
                key={collaborator.id}
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white"
                style={{ backgroundColor: collaborator.color }}
                title={collaborator.name}
              >
                {collaborator.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          <span className="text-xs text-neutral-600">
            {activeCollaborators.length} editing
          </span>
        </>
      )}
    </div>
  );
}

interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: Date;
  icon: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
  maxItems?: number;
}

export function ActivityTimeline({ activities, maxItems = 10 }: ActivityTimelineProps) {
  const displayActivities = activities.slice(0, maxItems);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-900">Activity</h3>
      <div className="space-y-2 border-l-2 border-slate-800 pl-3">
        {displayActivities.map(activity => (
          <div key={activity.id} className="text-sm">
            <p className="text-neutral-900">
              <strong>{activity.user}</strong> {activity.action} <code className="bg-neutral-100 px-1 rounded text-xs">{activity.target}</code>
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {formatTime(activity.timestamp)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

interface LiveCursorProps {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
}

export function LiveCursor({ userId, userName, color, x, y }: LiveCursorProps) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 100,
      }}
    >
      <svg width="30" height="40" viewBox="0 0 30 40" fill="none">
        <path
          d="M0 0L8 24L12 12L30 32L24 35L6 11L8 8Z"
          fill={color}
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      <div
        className="absolute top-8 left-2 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: color }}
      >
        {userName}
      </div>
    </div>
  );
}
