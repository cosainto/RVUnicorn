import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight, MapPin, Plus, Trash2, GripVertical, Save, Globe } from 'lucide-react';
import api from '../../services/api';

const RIG_TYPES = [
  { value: 'ANY', label: 'Any Rig' },
  { value: 'CLASS_A', label: 'Class A' },
  { value: 'CLASS_B', label: 'Class B / Van' },
  { value: 'CLASS_C', label: 'Class C' },
  { value: 'FIFTH_WHEEL', label: 'Fifth Wheel' },
  { value: 'TRAVEL_TRAILER', label: 'Travel Trailer' },
];

interface Stop {
  name: string;
  campgroundId?: string;
  lat?: number;
  lon?: number;
  notes: string;
}

export default function TripKitEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Basics
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rigType, setRigType] = useState('ANY');
  const [estimatedDays, setEstimatedDays] = useState<number | ''>('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // Step 2 — Stops
  const [stops, setStops] = useState<Stop[]>([{ name: '', notes: '' }]);
  const [stopSearch, setStopSearch] = useState('');
  const [stopResults, setStopResults] = useState<any[]>([]);
  const [searchingIdx, setSearchingIdx] = useState<number | null>(null);

  // Step 3 — Content
  const [myContent, setMyContent] = useState<any[]>([]);
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());

  // Load existing kit if editing
  useEffect(() => {
    if (id) {
      api.get(`/trip-kits/${id}`).then(({ data }) => {
        const kit = data.kit;
        setTitle(kit.title);
        setDescription(kit.description || '');
        setRigType(kit.rigType || 'ANY');
        setEstimatedDays(kit.estimatedDays || '');
        setCoverImageUrl(kit.coverImageUrl || '');
        setStops(kit.stops?.map((s: any) => ({ name: s.name, campgroundId: s.campgroundId, lat: s.lat, lon: s.lon, notes: s.notes || '' })) || []);
        setSelectedContentIds(new Set(kit.contentPieces?.map((c: any) => c.contentId) || []));
      }).catch(() => {});
    }
  }, [id]);

  // Load creator's content for step 3
  useEffect(() => {
    if (step === 3) {
      api.get('/creators/stats').then(async () => {
        // Get the creator's own profile to find their ID, then content
        const { data: profile } = await api.get('/auth/me');
        const { data: contentData } = await api.get(`/creators/content/${profile.id || profile.user?.id}`);
        setMyContent(contentData.content || contentData || []);
      }).catch(() => {});
    }
  }, [step]);

  // Campground search for stops
  useEffect(() => {
    if (stopSearch.length < 2) { setStopResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/trip-intelligence/destination-search?q=${encodeURIComponent(stopSearch)}`);
        setStopResults(data.results || []);
      } catch { setStopResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [stopSearch]);

  function addStop() {
    setStops([...stops, { name: '', notes: '' }]);
  }

  function removeStop(idx: number) {
    setStops(stops.filter((_, i) => i !== idx));
  }

  function selectStopResult(idx: number, result: any) {
    const updated = [...stops];
    updated[idx] = { name: result.name + (result.state ? `, ${result.state}` : ''), campgroundId: result.type === 'CAMPGROUND' ? result.id : undefined, lat: result.lat, lon: result.lon, notes: updated[idx].notes };
    setStops(updated);
    setStopSearch('');
    setStopResults([]);
    setSearchingIdx(null);
  }

  function toggleContent(contentId: string) {
    const next = new Set(selectedContentIds);
    if (next.has(contentId)) next.delete(contentId);
    else next.add(contentId);
    setSelectedContentIds(next);
  }

  async function handleSave(publish: boolean) {
    if (!title.trim()) return alert('Title is required');
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        rigType,
        estimatedDays: estimatedDays || null,
        coverImageUrl: coverImageUrl || null,
        tags: [],
        stops: stops.filter(s => s.name.trim()).map((s, i) => ({
          name: s.name,
          campgroundId: s.campgroundId || null,
          lat: s.lat || null,
          lon: s.lon || null,
          notes: s.notes || null,
          order: i,
        })),
        campgroundIds: stops.filter(s => s.campgroundId).map(s => s.campgroundId!),
        contentIds: Array.from(selectedContentIds),
      };

      let kitId = id;
      if (id) {
        await api.patch(`/trip-kits/${id}`, payload);
      } else {
        const { data } = await api.post('/trip-kits', payload);
        kitId = data.kit.id;
      }

      if (publish && kitId) {
        await api.patch(`/trip-kits/${kitId}`, { status: 'PUBLISHED' });
      }

      navigate('/creator/dashboard');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save trip kit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>{id ? 'Edit Trip Kit' : 'Create Trip Kit'} — RVUnicorn</title></Helmet>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-gray-900">{id ? 'Edit Trip Kit' : 'Create Trip Kit'}</h1>
          <div className="w-5" />
        </div>
      </div>

      {/* Step indicator */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{s}</div>
              {s < 4 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-amber-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Basics */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Trip Kit Basics</h2>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ultimate Utah Canyon Loop"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes this route special?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Rig Type</label>
                <select value={rigType} onChange={(e) => setRigType(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {RIG_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Estimated Days</label>
                <input type="number" min={1} max={30} value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Cover Image URL</label>
              <input type="text" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <button onClick={() => setStep(2)} disabled={!title.trim()}
              className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
              Next: Add Stops <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2 — Stops */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Add Stops</h2>
            <div className="space-y-3">
              {stops.map((stop, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                  <GripVertical className="w-4 h-4 text-gray-300 mt-2 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      {stop.name ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-sm font-medium text-gray-900">{stop.name}</span>
                          <button onClick={() => { const updated = [...stops]; updated[idx] = { ...updated[idx], name: '', campgroundId: undefined }; setStops(updated); }}
                            className="text-xs text-gray-400 hover:text-red-500">change</button>
                        </div>
                      ) : (
                        <>
                          <input type="text" value={searchingIdx === idx ? stopSearch : ''} placeholder="Search campground or location..."
                            onFocus={() => setSearchingIdx(idx)}
                            onChange={(e) => { setSearchingIdx(idx); setStopSearch(e.target.value); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          {searchingIdx === idx && stopResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-20 max-h-40 overflow-y-auto">
                              {stopResults.map((r: any) => (
                                <button key={r.id} onClick={() => selectStopResult(idx, r)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition border-b border-gray-50 last:border-0">
                                  {r.type === 'CAMPGROUND' ? '🏕️' : '📍'} {r.name}{r.state ? `, ${r.state}` : ''}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <textarea value={stop.notes} onChange={(e) => { const updated = [...stops]; updated[idx].notes = e.target.value; setStops(updated); }}
                      placeholder="Creator note (optional)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" rows={2} />
                  </div>
                  {stops.length > 1 && (
                    <button onClick={() => removeStop(idx)} className="text-gray-300 hover:text-red-500 transition mt-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {stops.length < 20 && (
              <button onClick={addStop} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:border-amber-300 hover:text-amber-600 transition flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Stop
              </button>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition">Back</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-amber-600 transition flex items-center justify-center gap-2">
                Next: Link Content <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Link Content */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Link Your Content</h2>
            <p className="text-xs text-gray-500">Select content that's relevant to this trip kit.</p>
            {myContent.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No published content found.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {myContent.map((c: any) => (
                  <button key={c.id} onClick={() => toggleContent(c.id)}
                    className={`text-left rounded-xl border-2 overflow-hidden transition ${
                      selectedContentIds.has(c.id) ? 'border-amber-400 bg-amber-50' : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    {c.thumbnailUrl && <img src={c.thumbnailUrl} className="w-full h-20 object-cover" alt="" />}
                    <div className="p-2">
                      <p className="text-xs font-semibold text-gray-800 line-clamp-2">{c.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.contentType}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition">Back</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-amber-600 transition flex items-center justify-center gap-2">
                Next: Preview <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Preview + Publish */}
        {step === 4 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Preview & Publish</h2>
            <div className="bg-gray-50 rounded-xl p-4">
              {coverImageUrl && <img src={coverImageUrl} className="w-full h-40 object-cover rounded-lg mb-3" alt="" />}
              <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
              {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>{stops.filter(s => s.name).length} stops</span>
                {estimatedDays && <span>{estimatedDays} days</span>}
                <span>{rigType === 'ANY' ? 'Any Rig' : rigType.replace('_', ' ')}</span>
                <span>{selectedContentIds.size} linked content</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition">Back</button>
              <button onClick={() => handleSave(false)} disabled={saving}
                className="px-6 py-3 rounded-xl font-bold text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 transition disabled:opacity-50 flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Draft
              </button>
              <button onClick={() => handleSave(true)} disabled={saving}
                className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                <Globe className="w-4 h-4" /> {saving ? 'Publishing...' : 'Publish Kit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
