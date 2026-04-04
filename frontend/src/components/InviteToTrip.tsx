import { useState } from 'react';
import { Copy, Check, Share2, MessageCircle, Mail } from 'lucide-react';
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
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'link' | 'email'>('link');

  const tripUrl = `https://rvunicorn.com/trips/${tripId}`;
  const shareText = `${user?.firstName || 'A friend'} invited you to join "${tripTitle}" on RVUnicorn! 🏕️`;

  const handleCopy = () => {
    navigator.clipboard.writeText(tripUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: tripTitle, text: shareText, url: tripUrl });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const handleSendEmail = async () => {
    if (!email) return;
    setSending(true);
    try {
      await api.post('/invites/send', { email, personalMessage: message || `Join me on "${tripTitle}"! ${tripUrl}` });
      setSent(true);
      setEmail('');
      setMessage('');
      setTimeout(() => setSent(false), 3000);
    } catch {}
    finally { setSending(false); }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + tripUrl)}`, '_blank');
  };

  const handleText = () => {
    window.open(`sms:?body=${encodeURIComponent(shareText + ' ' + tripUrl)}`, '_blank');
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.18)' }}>
      {/* Header */}
      <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(232,168,56,0.1)' }}>
        <img src={HITCH_IMG} alt="Hitch" className="w-8 h-8 rounded-full object-cover" />
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: '#F5F0E8' }}>Invite Friends to This Trip</h3>
          <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>The more the merrier — Hitch says so</p>
        </div>
        {onClose && <button onClick={onClose} className="text-[11px]" style={{ color: 'rgba(245,240,232,0.3)' }}>Close</button>}
      </div>

      {/* Quick share buttons */}
      <div className="p-4 flex gap-2">
        <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold transition" style={{ background: '#1B2E50', color: copied ? '#10B981' : '#F5F0E8' }}>
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

      {/* Email invite */}
      <div className="px-4 pb-4">
        <div className="p-3 rounded-xl" style={{ background: '#1B2E50' }}>
          <p className="text-[11px] font-semibold mb-2" style={{ color: '#E8A838' }}>
            <Mail className="w-3 h-3 inline mr-1" />Send an invite email
          </p>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="friend@email.com"
            className="w-full px-3 py-2 rounded-lg text-[12px] mb-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(232,168,56,0.1)', color: '#F5F0E8' }} />
          <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a personal message (optional)"
            className="w-full px-3 py-2 rounded-lg text-[12px] mb-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(232,168,56,0.1)', color: '#F5F0E8' }} />
          <button onClick={handleSendEmail} disabled={!email || sending}
            className="w-full py-2 rounded-lg text-[12px] font-semibold disabled:opacity-40" style={{ background: '#E8622A', color: 'white' }}>
            {sent ? 'Invite Sent! 🎉' : sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
        <p className="text-[10px] text-center mt-2" style={{ color: 'rgba(245,240,232,0.2)' }}>They'll get a branded email from Hitch with your invite</p>
      </div>
    </div>
  );
}
