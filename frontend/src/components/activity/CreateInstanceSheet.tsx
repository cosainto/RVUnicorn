import { useState } from 'react';
import { X, Clock, Users, MessageSquare } from 'lucide-react';
import api from '../../services/api';

interface CreateInstanceSheetProps {
  actionableId: string;
  activityTitle: string;
  activityType?: string;
  campgroundName?: string;
  onClose: () => void;
  onCreated: (instanceId: string) => void;
}

export default function CreateInstanceSheet({
  actionableId,
  activityTitle,
  campgroundName,
  onClose,
  onCreated,
}: CreateInstanceSheetProps) {
  const [scheduledTime, setScheduledTime] = useState('');
  const [note, setNote] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [isOpenInvite, setIsOpenInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const setQuickTime = (hoursFromNow: number, label?: string) => {
    const d = new Date();
    if (label === 'evening') {
      d.setHours(18, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    } else if (label === 'tomorrow_morning') {
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
    } else {
      d.setTime(d.getTime() + hoursFromNow * 60 * 60 * 1000);
    }
    // Format for datetime-local input
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    setScheduledTime(local.toISOString().slice(0, 16));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post(`/actionable/${actionableId}/instances`, {
        scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : null,
        note: note || null,
        maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
        isOpenInvite,
      });
      onCreated(data.id);
    } catch (e) {
      console.error('Failed to create instance:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Organize Activity</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Activity info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="font-medium text-gray-900">{activityTitle}</p>
          {campgroundName && (
            <p className="text-sm text-gray-500 mt-0.5">at {campgroundName}</p>
          )}
        </div>

        {/* When */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
            <Clock size={14} /> When
          </label>
          <div className="flex gap-2 mb-2 flex-wrap">
            <button
              type="button"
              onClick={() => setQuickTime(1)}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
            >
              In 1hr
            </button>
            <button
              type="button"
              onClick={() => setQuickTime(2)}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
            >
              In 2hrs
            </button>
            <button
              type="button"
              onClick={() => setQuickTime(0, 'evening')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
            >
              This evening
            </button>
            <button
              type="button"
              onClick={() => setQuickTime(0, 'tomorrow_morning')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
            >
              Tomorrow morning
            </button>
          </div>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Note */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
            <MessageSquare size={14} /> Details
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Where to meet, what to bring, any details for the group..."
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Max people */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
            <Users size={14} /> Max people (optional)
          </label>
          <input
            type="number"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            placeholder="No limit"
            min={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Open invite toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Open invite</p>
            <p className="text-xs text-gray-500">
              Anyone at {campgroundName || 'this campground'} can join
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpenInvite(!isOpenInvite)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isOpenInvite ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                isOpenInvite ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-campfire-500 text-white font-semibold py-3 rounded-xl hover:bg-campfire-600 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Start Activity'}
        </button>
      </div>
    </div>
  );
}
