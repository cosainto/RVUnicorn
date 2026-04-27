import React, { useState, useEffect } from 'react';
import api from '../../services/api';

interface ActivityItem {
  type: string;
  icon: string;
  description: string;
  timestamp: string;
}

interface Props {
  rigId: string;
  rigName?: string;
  isOwner: boolean;
  cn: Record<string, string>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return weeks + 'w ago';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RigActivityFeed({ rigId, rigName, isOwner, cn }: Props) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/rigs/${rigId}/activity`)
      .then(r => setActivities(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rigId]);

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
        <div className="h-4 w-48 rounded lifestyle-shimmer mb-3" />
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full lifestyle-shimmer" />
              <div className="h-3 w-40 rounded lifestyle-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Hide for visitors when empty
  if (activities.length === 0 && !isOwner) return null;

  return (
    <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
      <h3 className="text-sm font-bold mb-3" style={{ color: cn.cream }}>
        Activity Around {rigName || 'This Rig'}
      </h3>

      {activities.length === 0 ? (
        <p className="text-xs" style={{ color: cn.muted }}>
          No recent activity — take {rigName || 'your rig'} out!
        </p>
      ) : (
        <div className="space-y-2">
          {activities.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2"
              style={{ borderBottom: i < activities.length - 1 ? `1px solid ${cn.border}30` : undefined }}
            >
              <span className="text-sm flex-shrink-0 w-6 text-center">{a.icon}</span>
              <p className="text-xs flex-1 min-w-0" style={{ color: cn.cream }}>{a.description}</p>
              <span className="text-[10px] flex-shrink-0 whitespace-nowrap" style={{ color: cn.muted }}>
                {timeAgo(a.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
