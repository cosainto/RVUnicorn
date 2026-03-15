import { useState, useEffect } from "react";
import { RefreshCw, Edit, X, Check, Sparkles } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const TONES = [
  { id: "campfire",  emoji: "🏕️", label: "Campfire Storyteller" },
  { id: "comedian",  emoji: "😂", label: "Road Trip Comedian" },
  { id: "adventure", emoji: "🧭", label: "Adventure Seeker" },
  { id: "vineyard",  emoji: "🍷", label: "Vineyard Voyager" },
  { id: "hophead",   emoji: "🍺", label: "Eternal Hoptimist" },
  { id: "nature",    emoji: "🌲", label: "Nature Whisperer" },
];

const TONE_TITLES: Record<string, string> = {
  campfire:  "🔥 Campfire Chronicles",
  comedian:  "😂 Tales from the Road",
  adventure: "🧭 Trail Dispatch",
  vineyard:  "🍷 Vineyard Voyager",
  hophead:   "🍺 Hoptimist Files",
  nature:    "🌲 Field Notes",
};

export default function HitchProfileSummary({ username }: { username: string }) {
  const { user } = useAuth();
  const isOwn = (user as any)?.username === username;

  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [aiDisabled, setAiDisabled] = useState(false);
  const [showTones, setShowTones] = useState(false);
  const [selectedTone, setSelectedTone] = useState("campfire");

  const fetchSummary = async (tone?: string) => {
    setLoading(true);
    try {
      const t = tone || selectedTone;
      const { data } = await api.get(`/hitch/profile-summary/${username}?tone=${t}`);
      setSummary(data.summary || "");
      setEditText(data.summary || "");
    } catch {
      setSummary("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const disabled = localStorage.getItem(`ai_bio_disabled_${username}`);
    const saved = localStorage.getItem(`ai_bio_${username}`);
    if (disabled) { setAiDisabled(true); setLoading(false); return; }
    if (saved) { setSummary(saved); setEditText(saved); setLoading(false); return; }
    fetchSummary();
  }, [username]);

  const handleRegenerate = (tone?: string) => {
    const t = tone || selectedTone;
    setSelectedTone(t);
    setShowTones(false);
    localStorage.removeItem(`ai_bio_${username}`);
    fetchSummary(t);
  };

  const handleSaveEdit = () => {
    setSummary(editText);
    localStorage.setItem(`ai_bio_${username}`, editText);
    setEditing(false);
  };

  const handleDisableAI = () => {
    localStorage.setItem(`ai_bio_disabled_${username}`, "1");
    setAiDisabled(true);
  };

  const handleEnableAI = () => {
    localStorage.removeItem(`ai_bio_disabled_${username}`);
    localStorage.removeItem(`ai_bio_${username}`);
    setAiDisabled(false);
    fetchSummary();
  };

  const preview = summary.length > 160 ? summary.substring(0, 160) + "..." : summary;
  const title = TONE_TITLES[selectedTone] || "🔥 Campfire Chronicles";

  if (aiDisabled && isOwn) return (
    <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
      <span>AI bio is off</span>
      <button onClick={handleEnableAI} className="text-primary-500 hover:text-primary-700 font-semibold transition">Turn back on</button>
    </div>
  );

  if (aiDisabled) return null;

  return (
    <div className="mt-4 bg-gradient-to-r from-primary-50 to-purple-50 rounded-2xl border border-primary-100 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-primary-700">{title}</span>
        {isOwn && (
          <button onClick={() => setShowTones(s => !s)}
            className="text-xs text-primary-400 hover:text-primary-600 transition">
            Change style
          </button>
        )}
      </div>

      {/* Tone picker */}
      {showTones && isOwn && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TONES.map(t => (
            <button key={t.id} onClick={() => handleRegenerate(t.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${selectedTone === t.id ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 bg-primary-100 rounded animate-pulse" />
          <div className="h-3 bg-primary-100 rounded w-4/5 animate-pulse" />
          <div className="h-3 bg-primary-100 rounded w-3/5 animate-pulse" />
        </div>
      ) : editing ? (
        <div className="space-y-2">
          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4}
            className="w-full text-sm text-gray-700 bg-white border border-primary-200 rounded-xl p-2 resize-none focus:outline-none focus:border-primary-400" />
          <div className="flex gap-2">
            <button onClick={handleSaveEdit} className="flex items-center gap-1 text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition">
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-700 leading-relaxed">
            {expanded ? summary : preview}
          </p>
          {summary.length > 160 && (
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-primary-600 font-semibold mt-1 hover:text-primary-800 transition">
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </>
      )}

      {/* Controls - only for own profile */}
      {isOwn && !loading && !editing && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-primary-100">
          <button onClick={() => handleRegenerate()}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium transition">
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
          <button onClick={() => { setEditing(true); setEditText(summary); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium transition">
            <Edit className="w-3 h-3" /> Edit
          </button>
          <button onClick={() => { setEditing(true); setEditText(""); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium transition">
            <Sparkles className="w-3 h-3" /> Start fresh
          </button>
          <button onClick={handleDisableAI}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 font-medium transition ml-auto">
            Turn off AI bio
          </button>
        </div>
      )}
    </div>
  );
}
