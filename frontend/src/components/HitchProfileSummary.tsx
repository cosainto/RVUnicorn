import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "./ToastProvider";

export default function HitchProfileSummary({ username }: { username: string }) {
  const { user } = useAuth();
  const { addLocalToast } = useToast();
  const isOwn = (user as any)?.username === username;

  const [bio, setBio] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [typewriterText, setTypewriterText] = useState("");
  const [showTypewriter, setShowTypewriter] = useState(false);
  const pollCount = useRef(0);

  // Fetch bio from server (cached, no Claude call if hash matches)
  const fetchBio = async () => {
    try {
      const { data } = await api.get(`/hitch/profile-summary/${username}`);
      if (data.summary) {
        setBio(data.summary);
        setGeneratedAt(data.generatedAt || null);
        setLoading(false);
        return true;
      }
      return false;
    } catch {
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    pollCount.current = 0;
    setLoading(true);
    setBio(null);

    fetchBio().then(found => {
      if (!found) {
        // Bio doesn't exist yet — poll up to 5 times (background generation may be running)
        const interval = setInterval(async () => {
          pollCount.current++;
          const got = await fetchBio();
          if (got || pollCount.current >= 5) {
            clearInterval(interval);
            setLoading(false);
          }
        }, 3000);
        return () => clearInterval(interval);
      }
    });
  }, [username]);

  // Manual regenerate (owner only)
  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data } = await api.post(`/hitch/profile-summary/${username}/regenerate`);
      if (data.summary) {
        // Typewriter animation
        setShowTypewriter(true);
        setTypewriterText("");
        const text = data.summary;
        let i = 0;
        const tw = setInterval(() => {
          i++;
          setTypewriterText(text.slice(0, i));
          if (i >= text.length) {
            clearInterval(tw);
            setTimeout(() => {
              setBio(text);
              setGeneratedAt(data.generatedAt || new Date().toISOString());
              setShowTypewriter(false);
            }, 300);
          }
        }, 20);
      }
    } catch (e: any) {
      if (e?.response?.status === 429) {
        addLocalToast("You've regenerated 3 times today — come back tomorrow", 'warning');
      } else if (e?.response?.status === 403) {
        addLocalToast("You can only regenerate your own bio", 'error');
      } else {
        addLocalToast("Failed to regenerate bio", 'error');
      }
    } finally {
      setRegenerating(false);
    }
  };

  // Relative time helper
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="mt-4 rounded-2xl p-5" style={{ background: '#F5F0E8', borderLeft: '3px solid #E8A838' }}>
        <div className="h-4 w-40 rounded animate-pulse mb-3" style={{ background: '#E2D9C8' }} />
        <div className="h-3 w-full rounded animate-pulse mb-2" style={{ background: '#E2D9C8' }} />
        <div className="h-3 w-4/5 rounded animate-pulse mb-2" style={{ background: '#E2D9C8' }} />
        <div className="h-3 w-3/5 rounded animate-pulse" style={{ background: '#E2D9C8' }} />
      </div>
    );
  }

  // No bio yet after polling
  if (!bio && !showTypewriter) {
    return (
      <div className="mt-4 rounded-2xl p-5" style={{ background: '#F5F0E8', borderLeft: '3px solid #E8A838' }}>
        <p className="text-sm font-bold mb-1" style={{ color: '#C9A84C' }}>🔥 Campfire Chronicles</p>
        <p className="text-sm italic" style={{ color: '#8B9BB4' }}>
          This member's Campfire Chronicles is being written...
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl p-5 relative" style={{ background: '#F5F0E8', borderLeft: '3px solid #E8A838' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: '#C9A84C' }}>🔥 Campfire Chronicles</span>

        {/* Regenerate button — owner only */}
        {isOwn && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="w-7 h-7 rounded-full flex items-center justify-center transition hover:brightness-110"
            style={{ border: '1px solid #C9A84C', color: '#C9A84C' }}
            title="Regenerate your bio"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Bio text */}
      <p
        className="text-sm leading-relaxed"
        style={{
          color: '#1A2B45',
          opacity: regenerating && !showTypewriter ? 0.5 : 1,
          transition: 'opacity 300ms',
        }}
      >
        {showTypewriter ? typewriterText : bio}
        {showTypewriter && <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse" style={{ background: '#C9A84C' }} />}
      </p>

      {/* Last updated — owner only */}
      {isOwn && generatedAt && !showTypewriter && (
        <p className="text-[10px] mt-2" style={{ color: '#8B9BB4' }}>
          Last updated {timeAgo(generatedAt)}
        </p>
      )}
    </div>
  );
}
