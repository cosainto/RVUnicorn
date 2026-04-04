import { useState, useEffect } from 'react';

const CHARACTER_COLORS: Record<string, string> = {
  HITCH: '#E8A838',
  WALLET: '#2ECC71',
  WALTER: '#7B68EE',
  SCOUT: '#D4621A',
};

const CHARACTER_IMAGES: Record<string, string> = {
  HITCH: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
  WALLET: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218458/rvunicorn/guides/wallet_guide.png',
  WALTER: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261024/rvunicorn/characters/walter.png',
  SCOUT: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261023/rvunicorn/characters/scout.png',
};

// Render @mentions in bold with character colors
function renderMentions(text: string) {
  const parts = text.split(/(@(?:Hitch|Wallet|Walter|Scout))/gi);
  return parts.map((part, i) => {
    const match = part.match(/^@(Hitch|Wallet|Walter|Scout)$/i);
    if (match) {
      const char = match[1].toUpperCase();
      return <strong key={i} style={{ color: CHARACTER_COLORS[char] || '#E8A838' }}>{part}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Companion Message Bubble ──
export function CompanionMessage({ character, content }: { character: string; content: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t); }, []);

  const color = CHARACTER_COLORS[character] || '#E8A838';
  const image = CHARACTER_IMAGES[character];
  const name = character.charAt(0) + character.slice(1).toLowerCase();

  return (
    <div className="flex items-start gap-2 max-w-[70%] transition-all duration-300" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)' }}>
      <img src={image} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
      <div>
        <span className="text-[10px] font-bold block mb-0.5" style={{ color }}>{name}</span>
        <div className="rounded-xl rounded-tl-none px-3 py-2 text-[13px] leading-relaxed" style={{ background: '#1B2E50', color: '#F5F0E8' }}>
          {renderMentions(content)}
        </div>
        <span className="text-[9px] mt-0.5 block" style={{ color: 'rgba(245,240,232,0.3)' }}>
          {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ── User Message Bubble ──
export function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[70%] rounded-2xl rounded-br-sm px-3 py-2 text-[13px] leading-relaxed" style={{ background: 'rgba(232,168,56,0.15)', color: '#F5F0E8' }}>
        {renderMentions(content)}
      </div>
    </div>
  );
}

// ── Typing Indicator ──
export function CompanionTyping({ character }: { character: string }) {
  const color = CHARACTER_COLORS[character] || '#E8A838';
  const image = CHARACTER_IMAGES[character];
  const name = character.charAt(0) + character.slice(1).toLowerCase();

  return (
    <div className="flex items-center gap-2">
      <img src={image} alt={name} className="w-7 h-7 rounded-full object-cover" />
      <div className="flex items-center gap-1 px-3 py-2 rounded-xl" style={{ background: '#1B2E50' }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: color, animationDelay: `${i * 0.15}s` }} />
        ))}
        <span className="text-[10px] ml-1.5" style={{ color: 'rgba(245,240,232,0.4)' }}>{name} is thinking...</span>
      </div>
    </div>
  );
}

// ── Quiet Mode Banner ──
export function QuietModeBanner({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <div className="transition-all duration-300 overflow-hidden" style={{ maxHeight: visible ? '60px' : '0', opacity: visible ? 1 : 0 }}>
      <div className="flex items-center justify-between px-3 py-2 rounded-lg text-[11px]" style={{ background: 'rgba(232,168,56,0.08)', color: 'rgba(232,168,56,0.7)', border: '1px solid rgba(232,168,56,0.15)' }}>
        <span>Campfire's picking up — companions are stepping back {'\u{1F525}'}</span>
        <button onClick={onDismiss} className="ml-2 hover:opacity-70">✕</button>
      </div>
    </div>
  );
}

// ── @Mention Autocomplete ──
export function MentionAutocomplete({ query, onSelect }: { query: string; onSelect: (name: string) => void }) {
  const characters = [
    { name: 'Hitch', desc: 'Mentor & Trail Guide', key: 'HITCH' },
    { name: 'Wallet', desc: 'Deal Hunter', key: 'WALLET' },
    { name: 'Walter', desc: 'Nature & Stars', key: 'WALTER' },
    { name: 'Scout', desc: 'Adventure Guide', key: 'SCOUT' },
  ].filter(c => c.name.toLowerCase().startsWith(query.toLowerCase()));

  if (characters.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-10" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.2)' }}>
      {characters.map(c => (
        <button key={c.key} onClick={() => onSelect(c.name)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#1B2E50] transition">
          <img src={CHARACTER_IMAGES[c.key]} alt={c.name} className="w-6 h-6 rounded-full object-cover" />
          <div>
            <span className="text-[12px] font-bold" style={{ color: CHARACTER_COLORS[c.key] }}>{c.name}</span>
            <span className="text-[10px] ml-1.5" style={{ color: 'rgba(245,240,232,0.4)' }}>{c.desc}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
