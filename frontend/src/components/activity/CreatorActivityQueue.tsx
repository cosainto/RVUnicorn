import { useState, useEffect } from 'react';
import { Check, Pencil, X, Sparkles } from 'lucide-react';
import api from '../../services/api';

const ACTIVITY_EMOJI: Record<string, string> = {
  HIKE: '🥾', KAYAK: '🚣', SWIM: '🏊', FISH: '🎣', BIKE: '🚲',
  STARGAZING: '🔭', CAMPFIRE: '🔥', PHOTOGRAPHY: '📸',
  WILDLIFE: '🦅', OFFROAD: '🚗', SOCIAL: '👥', FOOD: '🍽️', OTHER: '🎯',
};

const ACTIVITY_TYPES = [
  'HIKE', 'KAYAK', 'SWIM', 'FISH', 'BIKE', 'STARGAZING',
  'CAMPFIRE', 'PHOTOGRAPHY', 'WILDLIFE', 'OFFROAD', 'SOCIAL', 'FOOD', 'OTHER',
];

const DIFFICULTIES = ['EASY', 'MODERATE', 'HARD', 'ANY'];

interface PendingActivity {
  id: string;
  activityType: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  difficulty?: string;
  whatToBring: string[];
  bestTimeOfDay?: string;
  bestSeason: string[];
  kidsOk: boolean;
  dogsOk: boolean;
  hitchConfidence?: number;
  campground?: { id: string; name: string };
  contentId?: string;
}

export default function CreatorActivityQueue() {
  const [pending, setPending] = useState<PendingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PendingActivity>>({});

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    try {
      const { data } = await api.get('/actionable/creator/pending');
      setPending(data || []);
    } catch (e) {
      console.error('Failed to load pending:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string, edits?: Partial<PendingActivity>) => {
    try {
      await api.patch(`/actionable/${id}/confirm`, edits || {});
      setPending((prev) => prev.filter((p) => p.id !== id));
      setEditingId(null);
    } catch (e) {
      console.error('Confirm failed:', e);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.delete(`/actionable/${id}`);
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error('Remove failed:', e);
    }
  };

  const startEdit = (activity: PendingActivity) => {
    setEditingId(activity.id);
    setEditForm({
      activityType: activity.activityType,
      title: activity.title,
      description: activity.description,
      durationMinutes: activity.durationMinutes,
      difficulty: activity.difficulty,
      whatToBring: activity.whatToBring,
      bestTimeOfDay: activity.bestTimeOfDay,
      kidsOk: activity.kidsOk,
      dogsOk: activity.dogsOk,
    });
  };

  if (loading || pending.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-amber-500" />
        <h3 className="font-bold text-gray-900">Hitch Found Activities</h3>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          {pending.length} pending
        </span>
      </div>

      <div className="space-y-3">
        {pending.map((activity) => (
          <div key={activity.id} className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs text-amber-600 font-medium mb-2">
              🎯 Hitch found an activity in your post
              {activity.hitchConfidence && (
                <span className="ml-2 text-gray-400">
                  ({Math.round(activity.hitchConfidence * 100)}% confidence)
                </span>
              )}
            </p>

            {activity.campground && (
              <p className="text-xs text-gray-500 mb-2">at {activity.campground.name}</p>
            )}

            {editingId === activity.id ? (
              /* Edit form */
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Activity Type</label>
                  <select
                    value={editForm.activityType || ''}
                    onChange={(e) => setEditForm({ ...editForm, activityType: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-1"
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ACTIVITY_EMOJI[t]} {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Title</label>
                  <input
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Duration (min)</label>
                    <input
                      type="number"
                      value={editForm.durationMinutes || ''}
                      onChange={(e) => setEditForm({ ...editForm, durationMinutes: parseInt(e.target.value) || undefined })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Difficulty</label>
                    <select
                      value={editForm.difficulty || 'ANY'}
                      onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-1"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(activity.id, editForm)}
                    className="flex-1 bg-green-600 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Check size={14} /> Save & Publish
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Display view */
              <>
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">
                    {ACTIVITY_EMOJI[activity.activityType]} {activity.title}
                  </p>
                  {activity.description && (
                    <p className="text-sm text-gray-600">{activity.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                    {activity.durationMinutes && <span>{activity.durationMinutes} min</span>}
                    {activity.difficulty && activity.difficulty !== 'ANY' && (
                      <span>· {activity.difficulty}</span>
                    )}
                    {activity.bestTimeOfDay && activity.bestTimeOfDay !== 'ANY' && (
                      <span>· {activity.bestTimeOfDay}</span>
                    )}
                  </div>
                  {activity.whatToBring?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <span className="text-xs text-gray-500">What to bring:</span>
                      {activity.whatToBring.map((item, i) => (
                        <span key={i} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleConfirm(activity.id)}
                    className="flex items-center gap-1 bg-green-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-green-700"
                  >
                    <Check size={14} /> Looks right — Publish
                  </button>
                  <button
                    onClick={() => startEdit(activity)}
                    className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                  >
                    <Pencil size={14} /> Edit first
                  </button>
                  <button
                    onClick={() => handleRemove(activity.id)}
                    className="flex items-center gap-1 text-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
