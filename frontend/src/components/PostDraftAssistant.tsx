import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import api from '../services/api';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

interface PostDraftAssistantProps {
  boardName?: string;
  onDraftGenerated: (title: string, body: string) => void;
}

export default function PostDraftAssistant({ boardName, onDraftGenerated }: PostDraftAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!idea.trim()) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/community/generate-draft', {
        trigger: 'assist', userIdea: idea, boardName,
      });
      onDraftGenerated(data.title || '', data.body);
      setExpanded(false);
      setIdea('');
    } catch {}
    finally { setGenerating(false); }
  };

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="flex items-center gap-1.5 text-[11px] font-medium mb-2 transition hover:opacity-80" style={{ color: '#E8A838' }}>
        <img src={HITCH_IMG} alt="Hitch" className="w-4 h-4 rounded-full object-cover" />
        <Sparkles className="w-3 h-3" />
        Help me write this
      </button>
    );
  }

  return (
    <div className="mb-3 p-3 rounded-xl" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)' }}>
      <div className="flex items-center gap-2 mb-2">
        <img src={HITCH_IMG} alt="Hitch" className="w-5 h-5 rounded-full object-cover" />
        <p className="text-[11px] font-bold" style={{ color: '#E8A838' }}>Hitch Draft Assistant</p>
      </div>
      <input value={idea} onChange={e => setIdea(e.target.value)} placeholder="What do you want to ask or share? (rough idea is fine)"
        className="w-full px-3 py-2 rounded-lg text-[12px] mb-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(232,168,56,0.1)', color: '#F5F0E8' }}
        onKeyDown={e => e.key === 'Enter' && handleGenerate()} />
      <div className="flex gap-2">
        <button onClick={handleGenerate} disabled={!idea.trim() || generating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40" style={{ background: '#E8622A', color: 'white' }}>
          {generating ? 'Writing...' : 'Generate Draft'}
        </button>
        <button onClick={() => setExpanded(false)} className="text-[11px]" style={{ color: 'rgba(245,240,232,0.3)' }}>Cancel</button>
      </div>
    </div>
  );
}
