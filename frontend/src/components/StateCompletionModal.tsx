import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Copy, Check, Share2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC'
};

interface Props {
  stateCode: string;
  stateNumber: number;
  onClose: () => void;
}

export default function StateCompletionModal({ stateCode, stateNumber, onClose }: Props) {
  const { user } = useAuth() as any;
  const [tagline, setTagline] = useState('');
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  const stateName = STATE_NAMES[stateCode] || stateCode;
  const username = user?.username || '';
  const shareUrl = `https://www.rvunicorn.com/join?ref=${username}`;
  const shareText = `State #${stateNumber}: ${stateName}! 🗺 ${tagline || 'Another pin on the map.'}\n${stateNumber} states explored and counting on my RVUnicorn journey.\nJoin me → ${shareUrl}`;

  useEffect(() => {
    api.post('/sharing/generate-tagline', { stateName, stateNumber }).then(r => setTagline(r.data.tagline)).catch(() => setTagline(`${stateName} — another chapter written.`));
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  const handleCopy = () => { navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `State #${stateNumber}: ${stateName}`, text: shareText, url: shareUrl }); } catch {}
    } else handleCopy();
    api.post('/sharing/record-share', { shareType: 'state_completion', platform: 'native' }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.92)' }}>
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-full" style={{
              left: `${Math.random() * 100}%`, top: '-10px',
              background: i % 2 === 0 ? '#E8A838' : '#D4621A',
              animation: `confettiFall ${1.5 + Math.random() * 1.5}s ease-in ${Math.random() * 0.5}s forwards`,
            }} />
          ))}
        </div>
      )}

      <div className="w-full max-w-md rounded-2xl overflow-hidden relative" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.2)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10"><X className="w-5 h-5" style={{ color: 'rgba(245,240,232,0.3)' }} /></button>

        <div className="p-8 text-center">
          {/* State number */}
          <p className="text-[14px] font-semibold mb-2" style={{ color: '#E8A838' }}>State #{stateNumber}</p>
          <h1 className="text-5xl font-bold mb-3" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>{stateName}</h1>

          {/* Tagline */}
          {tagline && <p className="text-[18px] italic mb-6" style={{ fontFamily: "'Playfair Display',serif", color: 'rgba(245,240,232,0.5)' }}>{tagline}</p>}

          {/* Stats */}
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <span className="text-2xl font-bold block" style={{ color: '#E8A838' }}>{stateNumber}</span>
              <span className="text-[10px] uppercase" style={{ color: 'rgba(245,240,232,0.4)', letterSpacing: '0.08em' }}>States</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold block" style={{ color: '#E8A838' }}>{50 - stateNumber}</span>
              <span className="text-[10px] uppercase" style={{ color: 'rgba(245,240,232,0.4)', letterSpacing: '0.08em' }}>To Go</span>
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2 justify-center mb-4">
            <button onClick={handleShare} className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-bold" style={{ background: '#E8622A', color: 'white' }}>
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-medium" style={{ border: '1px solid rgba(232,168,56,0.3)', color: copied ? '#10B981' : '#E8A838' }}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <button onClick={onClose} className="text-[12px]" style={{ color: 'rgba(245,240,232,0.3)' }}>Maybe Later</button>
        </div>
      </div>

      <style>{`@keyframes confettiFall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
    </div>
  );
}
