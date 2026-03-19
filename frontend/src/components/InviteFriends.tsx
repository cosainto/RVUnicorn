import { useState } from 'react';
import api from '../services/api';

export default function InviteFriends() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sentEmails, setSentEmails] = useState<string[]>([]);

  const send = async () => {
    if (!email.trim() || status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await api.post('/invites/send', { email: email.trim(), personalMessage: message.trim() || undefined });
      setSentEmails(prev => [...prev, email.trim()]);
      setEmail('');
      setMessage('');
      setStatus('sent');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Failed to send invite');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className="bg-gradient-to-br from-orange-950 to-amber-950 rounded-2xl overflow-hidden border border-orange-800/30">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-orange-950/90" />
        <div className="relative px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl flex-shrink-0">🦄</div>
            <div>
              <div className="text-white font-bold text-lg">Invite Friends to the Fire</div>
              <div className="text-orange-300 text-xs">Hitch will personally deliver the invite 🔥</div>
            </div>
          </div>
          <div className="bg-orange-900/40 border border-orange-700/30 rounded-xl px-4 py-3">
            <p className="text-orange-100 text-sm leading-relaxed italic">
              "Hey there! Pull up a chair — your friend thinks you'd love RVUnicorn. 
              Campfire trivia, rig-matched campgrounds, and a whole community of fellow campers awaiting. See you around the fire! 🏕️"
            </p>
            <div className="text-orange-400 text-xs mt-2 font-medium">— Hitch 🦄</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 pb-6 space-y-3">
        <div>
          <label className="text-xs font-semibold text-orange-300 uppercase tracking-wide mb-1.5 block">Friend's email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="friend@email.com"
            className="w-full bg-orange-900/30 border border-orange-700/40 rounded-xl px-4 py-2.5 text-white placeholder-orange-600 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-orange-300 uppercase tracking-wide mb-1.5 block">Personal message <span className="text-orange-600 font-normal">(optional)</span></label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Hey! You'd love this app for RV camping..."
            rows={2}
            className="w-full bg-orange-900/30 border border-orange-700/40 rounded-xl px-4 py-2.5 text-white placeholder-orange-600 text-sm focus:outline-none focus:border-orange-500 resize-none"
          />
        </div>

        <button
          onClick={send}
          disabled={!email.trim() || status === 'sending'}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
            status === 'sent' ? 'bg-green-600 text-white' :
            status === 'error' ? 'bg-red-600 text-white' :
            'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white disabled:opacity-50'
          }`}
        >
          {status === 'sending' ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</> :
           status === 'sent' ? '✅ Invite sent!' :
           status === 'error' ? `❌ ${errorMsg}` :
           <><span>🔥</span> Send Hitch's Invite</>}
        </button>

        {/* Sent history */}
        {sentEmails.length > 0 && (
          <div className="pt-2">
            <div className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">Invites sent</div>
            <div className="space-y-1.5">
              {sentEmails.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-orange-300">
                  <span className="text-green-400">✓</span> {e}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-orange-600 text-xs text-center">
          🏆 Earn the <strong className="text-orange-400">Trail Blazer</strong> badge when your friend joins!
        </p>
      </div>
    </div>
  );
}
