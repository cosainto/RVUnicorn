import { useState, useEffect } from 'react';
import { Compass } from 'lucide-react';
import api from '../../services/api';
import ActionCard from './ActionCard';
import CreateInstanceSheet from './CreateInstanceSheet';

interface DoThisNowItem {
  actionable: any;
  hitchReason: string;
  activeInstance: any | null;
  friendsWhoDidThis: any[];
}

interface DoThisNowSectionProps {
  campgroundName?: string;
}

export default function DoThisNowSection({ campgroundName }: DoThisNowSectionProps) {
  const [items, setItems] = useState<DoThisNowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createFor, setCreateFor] = useState<{ id: string; title: string; type: string } | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const { data } = await api.get('/actionable/do-this-now');
      setItems(data || []);
    } catch (e) {
      console.error('Failed to load do-this-now:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null; // Don't show skeleton — absence is cleaner
  if (items.length === 0) return null; // Hide when no activities

  const getTimeOfDay = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Morning';
    if (h >= 12 && h < 17) return 'Afternoon';
    if (h >= 17 && h < 21) return 'Evening';
    return 'Night';
  };

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Compass size={18} className="text-campfire-500" />
          <h3 className="font-bold text-gray-900">Do This Now</h3>
        </div>
        <span className="text-xs text-gray-500">
          {campgroundName && `At ${campgroundName} · `}{getTimeOfDay()}
        </span>
      </div>

      {/* Horizontal scroll of compact ActionCards */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {items.map((item) => (
          <div key={item.actionable.id} className="flex-shrink-0">
            <ActionCard
              actionable={item.actionable}
              hitchReason={item.hitchReason}
              activeInstance={item.activeInstance}
              friendsWhoDidThis={item.friendsWhoDidThis}
              context="basecamp"
              compact
              onStartActivity={() =>
                setCreateFor({
                  id: item.actionable.id,
                  title: item.actionable.title,
                  type: item.actionable.activityType,
                })
              }
            />
          </div>
        ))}
      </div>

      {/* Create instance sheet */}
      {createFor && (
        <CreateInstanceSheet
          actionableId={createFor.id}
          activityTitle={createFor.title}
          activityType={createFor.type}
          campgroundName={campgroundName}
          onClose={() => setCreateFor(null)}
          onCreated={(instanceId) => {
            setCreateFor(null);
            window.location.href = `/activities/${instanceId}`;
          }}
        />
      )}
    </div>
  );
}
