import { useState } from 'react';
import { Check } from 'lucide-react';
import api from '../services/api';

interface Props {
  eventId: string;
  initialData?: any;
  onSave?: () => void;
  onSkip?: () => void;
}

export default function RSVPSiteForm({ eventId, initialData, onSave, onSkip }: Props) {
  const [siteNumber, setSiteNumber] = useState(initialData?.siteNumber || '');
  const [loopArea, setLoopArea] = useState(initialData?.loopArea || '');
  const [siteVisibility, setSiteVisibility] = useState(initialData?.siteVisibility || 'ATTENDEES');
  const [hasDogs, setHasDogs] = useState(initialData?.hasDogs || false);
  const [isOpenToVisitors, setIsOpenToVisitors] = useState(initialData?.isOpenToVisitors || false);
  const [digitalFlag, setDigitalFlag] = useState(initialData?.digitalFlag || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.patch(`/events/${eventId}/rsvp-presence`, {
        siteNumber: siteNumber.trim() || null,
        loopArea: loopArea.trim() || null,
        siteVisibility,
        hasDogs,
        isOpenToVisitors,
        digitalFlag: digitalFlag.trim() || null,
      });
      setSaved(true);
      onSave?.();
    } catch {}
    finally { setSaving(false); }
  };

  if (saved) return (
    <div className="text-center py-6">
      <div className="text-3xl mb-2">🏕️</div>
      <p className="font-bold text-gray-900">You're on the map!</p>
      <p className="text-sm text-gray-500 mt-1">Your campmates can now find you.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-gray-900 mb-1">Tell your campmates where to find you 🏕️</h3>
        <p className="text-xs text-gray-500">This is optional — you can add it later.</p>
      </div>

      {/* Site info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Site Number</label>
          <input value={siteNumber} onChange={e => setSiteNumber(e.target.value)} placeholder="e.g. 42"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Loop / Area</label>
          <input value={loopArea} onChange={e => setLoopArea(e.target.value)} placeholder="e.g. Loop A"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Who can see your location?</label>
        <div className="space-y-2">
          {[
            { val: 'ATTENDEES', emoji: '🟢', label: 'All attendees', desc: 'Everyone at this event can see your rig and site' },
            { val: 'FRIENDS', emoji: '👥', label: 'Friends only', desc: 'Only your RVUnicorn friends can see you' },
            { val: 'HIDDEN', emoji: '🕶️', label: 'Incognito', desc: "You'll see the map but won't appear on it" },
          ].map(opt => (
            <button key={opt.val} onClick={() => setSiteVisibility(opt.val)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${siteVisibility === opt.val ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
              <span className="text-lg">{opt.emoji}</span>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${siteVisibility === opt.val ? 'text-orange-700' : 'text-gray-800'}`}>{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
              {siteVisibility === opt.val && <Check className="w-5 h-5 text-orange-500" />}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">You can change this anytime from the event page</p>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className={`w-10 h-6 rounded-full transition ${hasDogs ? 'bg-orange-500' : 'bg-gray-200'} relative`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition ${hasDogs ? 'left-[18px]' : 'left-0.5'}`} />
          </div>
          <span className="text-sm text-gray-700">🐾 Traveling with dogs</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className={`w-10 h-6 rounded-full transition ${isOpenToVisitors ? 'bg-orange-500' : 'bg-gray-200'} relative`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition ${isOpenToVisitors ? 'left-[18px]' : 'left-0.5'}`} />
          </div>
          <span className="text-sm text-gray-700">🔥 Open to visitors — let campmates know they can stop by</span>
        </label>
      </div>

      {/* Digital flag */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Digital Flag (optional)</label>
        <input value={digitalFlag} onChange={e => setDigitalFlag(e.target.value.slice(0, 60))} placeholder="Coffee is on ☕ · Working until 4 PM · Come say hi!"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <p className="text-[10px] text-gray-400 text-right mt-0.5">{digitalFlag.length}/60</p>
      </div>

      <div className="space-y-2">
        <button onClick={handleSubmit} disabled={saving}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition">
          {saving ? 'Saving...' : 'Save My Spot'}
        </button>
        {onSkip && <button onClick={onSkip} className="w-full text-sm text-gray-400 hover:text-gray-600 text-center">Skip for now</button>}
      </div>
    </div>
  );
}
