import { useState, useEffect } from 'react';
import api from '../../services/api';
import { formatDistanceToNow, format } from 'date-fns';

const CATEGORIES = [
  'DESTINATION', 'VALUE', 'ADVENTURE', 'SEASONAL', 'DEBATE',
  'OFFGRID', 'STARGAZING', 'HIDDEN_GEMS', 'TRAILS', 'CONTROVERSY',
  'DEALS', 'SLOW_TRAVEL', 'NATURE', 'WISDOM',
];

const CHARACTER_MAP: Record<string, { name: string; emoji: string; loadingMsg: string }> = {
  DESTINATION: { name: 'Hitch', emoji: '🎯', loadingMsg: 'Hitch is writing...' },
  DEBATE: { name: 'Hitch', emoji: '🎯', loadingMsg: 'Hitch is writing...' },
  WISDOM: { name: 'Hitch', emoji: '🎯', loadingMsg: 'Hitch is writing...' },
  VALUE: { name: 'Wallet', emoji: '💸', loadingMsg: 'Wallet is crunching numbers...' },
  DEALS: { name: 'Wallet', emoji: '💸', loadingMsg: 'Wallet is crunching numbers...' },
  CONTROVERSY: { name: 'Wallet', emoji: '💸', loadingMsg: 'Wallet is crunching numbers...' },
  ADVENTURE: { name: 'Scout', emoji: '🧭', loadingMsg: 'Scout is blazing trails...' },
  OFFGRID: { name: 'Scout', emoji: '🧭', loadingMsg: 'Scout is blazing trails...' },
  TRAILS: { name: 'Scout', emoji: '🧭', loadingMsg: 'Scout is blazing trails...' },
  HIDDEN_GEMS: { name: 'Scout', emoji: '🧭', loadingMsg: 'Scout is blazing trails...' },
  SEASONAL: { name: 'Walter', emoji: '🔭', loadingMsg: 'Walter is gazing at the stars...' },
  STARGAZING: { name: 'Walter', emoji: '🔭', loadingMsg: 'Walter is gazing at the stars...' },
  SLOW_TRAVEL: { name: 'Walter', emoji: '🔭', loadingMsg: 'Walter is gazing at the stars...' },
  NATURE: { name: 'Walter', emoji: '🔭', loadingMsg: 'Walter is gazing at the stars...' },
};

interface CampfireThread {
  id: string;
  title: string;
  content: string;
  hookQuestion: string;
  hotTake: string;
  character: string;
  category: string;
  targetAudience?: string;
  rigContext?: string;
  weatherContext?: string;
  status: string;
  scheduledFor?: string;
  publishedAt?: string;
  postId?: string;
  boardId?: string;
  seedReplies: string[];
  destinations: Array<{
    id: string;
    name: string;
    state?: string;
    rigRestriction?: string;
    amenitySummary?: string;
    sentiment?: string;
    highlight?: string;
    campgroundId?: string;
  }>;
  engagement?: { comments: number; votes: number } | null;
  createdAt: string;
}

interface CampgroundOption {
  id: string;
  name: string;
  state?: string;
}

function getNextSaturday9am(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now);
  sat.setDate(now.getDate() + daysUntilSat);
  sat.setHours(9, 0, 0, 0);
  return sat.toISOString().slice(0, 16);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SCHEDULED: 'bg-amber-100 text-amber-700',
    PUBLISHED: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function CampfireThreadAdminPage() {
  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('DESTINATION');
  const [targetAudience, setTargetAudience] = useState('');
  const [rigContext, setRigContext] = useState('');
  const [weatherContext, setWeatherContext] = useState('');
  const [selectedDestinations, setSelectedDestinations] = useState<CampgroundOption[]>([]);
  const [campgroundSearch, setCampgroundSearch] = useState('');
  const [campgroundResults, setCampgroundResults] = useState<CampgroundOption[]>([]);
  const [scheduleFor, setScheduleFor] = useState(getNextSaturday9am());

  // UI state
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<CampfireThread | null>(null);
  const [threads, setThreads] = useState<CampfireThread[]>([]);
  const [loading, setLoading] = useState(true);

  // Load threads on mount
  useEffect(() => {
    loadThreads();
  }, []);

  async function loadThreads() {
    try {
      const { data } = await api.get('/admin/campfire-threads');
      setThreads(data.threads || []);
    } catch (e) {
      console.error('Failed to load threads:', e);
    } finally {
      setLoading(false);
    }
  }

  // Campground search
  useEffect(() => {
    if (campgroundSearch.length < 2) { setCampgroundResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(campgroundSearch)}&limit=8`);
        const items = (data.campgrounds || data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          state: c.state,
        }));
        setCampgroundResults(items.filter((c: CampgroundOption) => !selectedDestinations.find((s) => s.id === c.id)));
      } catch { setCampgroundResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [campgroundSearch, selectedDestinations]);

  async function handleGenerate() {
    if (!title.trim()) return;
    setGenerating(true);
    setPreview(null);
    try {
      const { data } = await api.post('/admin/campfire-threads/generate', {
        title,
        category,
        targetAudience,
        rigContext,
        weatherContext,
        destinationIds: selectedDestinations.map((d) => d.id),
      });
      setPreview(data.thread);
      loadThreads();
    } catch (e: any) {
      alert('Generation failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSchedule(threadId: string) {
    try {
      await api.post(`/admin/campfire-threads/${threadId}/schedule`, {
        scheduledFor: new Date(scheduleFor).toISOString(),
      });
      loadThreads();
      if (preview?.id === threadId) setPreview(null);
    } catch (e: any) {
      alert('Schedule failed: ' + (e.response?.data?.error || e.message));
    }
  }

  async function handlePublishNow(threadId: string) {
    try {
      await api.post(`/admin/campfire-threads/${threadId}/publish-now`);
      loadThreads();
      if (preview?.id === threadId) setPreview(null);
    } catch (e: any) {
      alert('Publish failed: ' + (e.response?.data?.error || e.message));
    }
  }

  async function handleDelete(threadId: string) {
    if (!confirm('Delete this draft?')) return;
    try {
      await api.delete(`/admin/campfire-threads/${threadId}`);
      loadThreads();
      if (preview?.id === threadId) setPreview(null);
    } catch (e: any) {
      alert('Delete failed: ' + (e.response?.data?.error || e.message));
    }
  }

  const charInfo = CHARACTER_MAP[category];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">🔥 Weekly Campfire Thread Engine</h1>

      {/* Preview Panel */}
      {preview && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{CHARACTER_MAP[preview.character]?.emoji || '🔥'}</span>
            <div>
              <h2 className="font-bold text-lg text-gray-900">{CHARACTER_MAP[preview.character]?.name || preview.character}</h2>
              <p className="text-sm text-gray-500">Preview — {preview.title}</p>
            </div>
          </div>

          {/* Hook question */}
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg mb-4">
            <p className="font-semibold text-gray-800">{preview.hookQuestion}</p>
          </div>

          {/* Hot take */}
          <p className="text-gray-700 italic mb-4">
            🔥 <strong>{CHARACTER_MAP[preview.character]?.name}'s Hot Take:</strong>{' '}
            {preview.hotTake}
          </p>

          {/* Body */}
          <div className="prose prose-sm max-w-none text-gray-700 mb-4 whitespace-pre-wrap">
            {preview.content}
          </div>

          {/* Destinations */}
          {preview.destinations.length > 0 && (
            <div className="border-t pt-4 mb-4">
              <h3 className="font-semibold text-gray-800 mb-3">📍 Featured Spots</h3>
              <div className="grid gap-3">
                {preview.destinations.map((d) => (
                  <div key={d.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{d.name}</span>
                      {d.state && <span className="text-xs text-gray-500">— {d.state}</span>}
                      {d.sentiment && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          d.sentiment === 'POSITIVE' ? 'bg-green-100 text-green-700' :
                          d.sentiment === 'MIXED' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>{d.sentiment}</span>
                      )}
                    </div>
                    {d.rigRestriction && <p className="text-xs text-orange-600">🚐 {d.rigRestriction}</p>}
                    {d.amenitySummary && <p className="text-xs text-gray-600">{d.amenitySummary}</p>}
                    {d.highlight && <p className="text-xs text-gray-600">⭐ {d.highlight}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seed Replies */}
          {preview.seedReplies.length > 0 && (
            <div className="border-t pt-4 mb-4">
              <h3 className="font-semibold text-gray-800 mb-2">💬 Seed Questions</h3>
              <div className="flex flex-wrap gap-2">
                {preview.seedReplies.map((q, i) => (
                  <span key={i} className="bg-orange-50 text-orange-700 text-sm px-3 py-1.5 rounded-full border border-orange-200">{q}</span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <input type="datetime-local" value={scheduleFor} onChange={(e) => setScheduleFor(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <button onClick={() => handleSchedule(preview.id)}
                className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-600 transition">
                Schedule
              </button>
            </div>
            <button onClick={() => handlePublishNow(preview.id)}
              className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition">
              Publish Now
            </button>
            <button onClick={handleGenerate}
              className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-300 transition">
              Regenerate
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT — Creator Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Create Thread</h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Best Fall Foliage Campgrounds in the Southeast"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
              {charInfo && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <span className="text-lg">{charInfo.emoji}</span>
                  <span className="font-medium">{charInfo.name}</span> will write this thread
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Target Audience</label>
              <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. Class A Owners, Solo Travelers"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Rig Context</label>
              <input type="text" value={rigContext} onChange={(e) => setRigContext(e.target.value)} placeholder="e.g. Fifth-wheel and Class A friendly"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Weather / Season Context</label>
              <input type="text" value={weatherContext} onChange={(e) => setWeatherContext(e.target.value)} placeholder="e.g. Fall foliage season"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Destinations</label>
              <input type="text" value={campgroundSearch} onChange={(e) => setCampgroundSearch(e.target.value)} placeholder="Search campgrounds..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              {campgroundResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto bg-white shadow-lg">
                  {campgroundResults.map((cg) => (
                    <button key={cg.id} onClick={() => { setSelectedDestinations([...selectedDestinations, cg]); setCampgroundSearch(''); setCampgroundResults([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition border-b border-gray-50 last:border-0">
                      {cg.name} {cg.state && <span className="text-gray-400">— {cg.state}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedDestinations.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedDestinations.map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2 py-1 rounded-full border border-amber-200">
                      {d.name}
                      <button onClick={() => setSelectedDestinations(selectedDestinations.filter((s) => s.id !== d.id))} className="hover:text-red-500">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Schedule For</label>
              <input type="datetime-local" value={scheduleFor} onChange={(e) => setScheduleFor(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>

            <button onClick={handleGenerate} disabled={generating || !title.trim()}
              className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {generating ? (charInfo?.loadingMsg || 'Generating...') : 'Generate Draft'}
            </button>
          </div>
        </div>

        {/* RIGHT — Thread History */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Thread History</h2>

          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : threads.length === 0 ? (
            <p className="text-sm text-gray-400">No threads yet. Generate your first one!</p>
          ) : (
            <div className="space-y-3">
              {threads.map((t) => {
                const ch = CHARACTER_MAP[t.character] || { emoji: '🔥', name: t.character };
                return (
                  <div key={t.id} className="border border-gray-100 rounded-xl p-4 hover:border-amber-200 transition">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ch.emoji}</span>
                        <span className="text-sm font-semibold text-gray-700">{ch.name}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <span className="text-xs text-gray-400">
                        {t.publishedAt
                          ? format(new Date(t.publishedAt), 'MMM d, yyyy')
                          : t.scheduledFor
                          ? `Scheduled: ${format(new Date(t.scheduledFor), 'MMM d, h:mm a')}`
                          : formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-1">{t.title}</p>

                    {t.engagement && (
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <span>💬 {t.engagement.comments} comments</span>
                        <span>👍 {t.engagement.votes} votes</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {t.status === 'DRAFT' && (
                        <>
                          <button onClick={() => setPreview(t)} className="text-xs text-amber-600 hover:text-amber-700 font-semibold">View</button>
                          <button onClick={() => handleSchedule(t.id)} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">Schedule</button>
                          <button onClick={() => handlePublishNow(t.id)} className="text-xs text-green-600 hover:text-green-700 font-semibold">Publish</button>
                          <button onClick={() => handleDelete(t.id)} className="text-xs text-red-500 hover:text-red-600 font-semibold">Delete</button>
                        </>
                      )}
                      {t.status === 'SCHEDULED' && (
                        <>
                          <button onClick={() => setPreview(t)} className="text-xs text-amber-600 hover:text-amber-700 font-semibold">View</button>
                          <button onClick={() => handlePublishNow(t.id)} className="text-xs text-green-600 hover:text-green-700 font-semibold">Publish Now</button>
                          <button onClick={() => handleDelete(t.id)} className="text-xs text-red-500 hover:text-red-600 font-semibold">Cancel</button>
                        </>
                      )}
                      {t.status === 'PUBLISHED' && t.postId && (
                        <a href={`/community?post=${t.postId}`} className="text-xs text-amber-600 hover:text-amber-700 font-semibold">View Post</a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
