import { useState } from 'react';
import { Copy, Check, Share2, MessageCircle, Mail, UserPlus, X, AtSign } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface InviteToTripProps {
  tripId: string;
  tripTitle: string;
  onClose?: () => void;
}

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

export default function InviteToTrip({ tripId, tripTitle, onClose }: InviteToTripProps) {
  const { user } = useAuth() as any;
  const [usernames, setUsernames] = useState<string[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tripUrl = `https://rvunicorn.com/trips/${tripId}`;
  const shareText = `${user?.firstName || 'A friend'} invited you to join "${tripTitle}" on RVUnicorn! 🏕️`;

  const handleCopy = () => {
    navigator.clipboard.writeText(tripUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: tripTitle, text: shareText, url: tripUrl }); } catch {}
    } else {
      handleCopy();
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + tripUrl)}`, '_blank');
  };

  const handleText = () => {
    window.open(`sms:?body=${encodeURIComponent(shareText + ' ' + tripUrl)}`, '_blank');
  };

  const addUsername = () => {
    const v = usernameInput.trim().replace(/^@/, '');
    if (!v) return;
    if (!usernames.includes(v)) setUsernames(prev => [...prev, v]);
    setUsernameInput('');
  };

  const addEmail = () => {
    const v = emailInput.trim().toLowerCase();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError('That email looks off — double-check it');
      return;
    }
    if (!emails.includes(v)) setEmails(prev => [...prev, v]);
    setEmailInput('');
    setError(null);
  };

  const handleSendInvites = async () => {
    setError(null);
    setResult(null);
    if (usernames.length === 0 && emails.length === 0) {
      setError('Add at least one username or email');
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post(`/events/${tripId}/invite`, {
        usernames,
        emails,
        message: message.trim() || undefined,
      });
      const parts: string[] = [];
      if (data.summary?.invited) parts.push(`${data.summary.invited} member${data.summary.invited === 1 ? '' : 's'} invited`);
      if (data.summary?.emailed) parts.push(`${data.summary.emailed} email${data.summary.emailed === 1 ? '' : 's'} sent`);
      if (data.summary?.alreadyInvited) parts.push(`${data.summary.alreadyInvited} already invited`);
      if (data.summary?.notFound) parts.push(`${data.summary.notFound} not found`);
      setResult(parts.length ? parts.join(' · ') + ' 🎉' : 'Sent!');
      setUsernames([]);
      setEmails([]);
      setMessage('');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to send invites');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.18)' }}>
      {/* Header */}
      <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(232,168,56,0.1)' }}>
        <img src={HITCH_IMG} alt="Hitch" className="w-8 h-8 rounded-full object-cover" />
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: '#F5F0E8' }}>Invite to "{tripTitle}"</h3>
          <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Bring members or anyone with an email — they'll get the full trip details</p>
        </div>
        {onClose && <button onClick={onClose} className="text-[11px]" style={{ color: 'rgba(245,240,232,0.3)' }}>Close</button>}
      </div>

      {/* Quick share buttons */}
      <div className="p-4 flex gap-2 flex-wrap">
        <button onClick={handleCopy} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold transition" style={{ background: '#1B2E50', color: copied ? '#10B981' : '#F5F0E8' }}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button onClick={handleWhatsApp} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold" style={{ background: '#25D366', color: 'white' }}>
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </button>
        <button onClick={handleText} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold" style={{ background: '#1B2E50', color: '#F5F0E8' }}>
          <MessageCircle className="w-3.5 h-3.5" /> Text
        </button>
        <button onClick={handleShare} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold" style={{ background: '#E8622A', color: 'white' }}>
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      </div>

      {/* Unified invite form */}
      <div className="px-4 pb-4 space-y-3">
        {/* Internal — usernames */}
        <div className="p-3 rounded-xl" style={{ background: '#1B2E50' }}>
          <p className="text-[11px] font-semibold mb-2 flex items-center gap-1" style={{ color: '#E8A838' }}>
            <UserPlus className="w-3 h-3" /> Invite RVUnicorn members
          </p>
          <div className="flex gap-2 mb-2">
            <div className="flex-1 flex items-center px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(232,168,56,0.1)' }}>
              <AtSign className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(245,240,232,0.4)' }} />
              <input
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUsername(); } }}
                placeholder="username"
                className="flex-1 px-2 py-2 bg-transparent text-[12px] focus:outline-none"
                style={{ color: '#F5F0E8' }}
              />
            </div>
            <button
              onClick={addUsername}
              disabled={!usernameInput.trim()}
              className="px-3 py-2 rounded-lg text-[11px] font-semibold disabled:opacity-40"
              style={{ background: 'rgba(232,168,56,0.15)', color: '#E8A838' }}
            >
              Add
            </button>
          </div>
          {usernames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {usernames.map(u => (
                <span key={u} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px]" style={{ background: 'rgba(232,168,56,0.18)', color: '#F5F0E8' }}>
                  @{u}
                  <button onClick={() => setUsernames(prev => prev.filter(x => x !== u))} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* External — emails */}
        <div className="p-3 rounded-xl" style={{ background: '#1B2E50' }}>
          <p className="text-[11px] font-semibold mb-2 flex items-center gap-1" style={{ color: '#E8A838' }}>
            <Mail className="w-3 h-3" /> Invite by email
          </p>
          <div className="flex gap-2 mb-2">
            <input
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
              type="email"
              placeholder="friend@email.com"
              className="flex-1 px-3 py-2 rounded-lg text-[12px]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(232,168,56,0.1)', color: '#F5F0E8' }}
            />
            <button
              onClick={addEmail}
              disabled={!emailInput.trim()}
              className="px-3 py-2 rounded-lg text-[11px] font-semibold disabled:opacity-40"
              style={{ background: 'rgba(232,168,56,0.15)', color: '#E8A838' }}
            >
              Add
            </button>
          </div>
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {emails.map(em => (
                <span key={em} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px]" style={{ background: 'rgba(232,168,56,0.18)', color: '#F5F0E8' }}>
                  {em}
                  <button onClick={() => setEmails(prev => prev.filter(x => x !== em))} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Personal message */}
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Add a personal note (optional) — gets included in the invite"
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-[12px] resize-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(232,168,56,0.1)', color: '#F5F0E8' }}
        />

        <button
          onClick={handleSendInvites}
          disabled={sending || (usernames.length === 0 && emails.length === 0)}
          className="w-full py-2.5 rounded-lg text-[13px] font-semibold disabled:opacity-40"
          style={{ background: '#E8622A', color: 'white' }}
        >
          {sending ? 'Sending…' : `Send ${usernames.length + emails.length || ''} Invite${usernames.length + emails.length === 1 ? '' : 's'}`}
        </button>

        {result && <p className="text-[11px] text-center" style={{ color: '#10B981' }}>{result}</p>}
        {error && <p className="text-[11px] text-center" style={{ color: '#F87171' }}>{error}</p>}
        <p className="text-[10px] text-center" style={{ color: 'rgba(245,240,232,0.25)' }}>
          Members get an in-app notification. Email invites get a branded message with the trip date, location, and your note.
        </p>
      </div>
    </div>
  );
}
