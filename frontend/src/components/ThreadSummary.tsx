import { useState, useEffect } from 'react';
import api from '../services/api';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

export default function ThreadSummary({ postId, commentCount }: { postId: string; commentCount: number }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ commentCount: number; generatedAt: string } | null>(null);

  useEffect(() => {
    if (commentCount < 15) return;
    api.get(`/community/posts/${postId}/summary`).then(r => {
      if (r.data.summary) { setSummary(r.data.summary); setMeta({ commentCount: r.data.commentCount, generatedAt: r.data.generatedAt }); }
    }).catch(() => {});
  }, [postId, commentCount]);

  if (!summary) return null;

  return (
    <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(27,46,80,0.5)', borderLeft: '3px solid #E8A838' }}>
      <div className="flex items-center gap-2 mb-2">
        <img src={HITCH_IMG} alt="Hitch" className="w-5 h-5 rounded-full object-cover" />
        <span className="text-[11px] font-bold" style={{ color: '#E8A838' }}>{'\u26A1'} Hitch Summary</span>
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: '#F5F0E8' }}>{summary}</p>
      <p className="text-[10px] mt-2" style={{ color: 'rgba(245,240,232,0.3)' }}>
        Based on {meta?.commentCount || commentCount} replies · Updated {meta?.generatedAt ? new Date(meta.generatedAt).toLocaleDateString() : 'recently'}
      </p>
    </div>
  );
}
