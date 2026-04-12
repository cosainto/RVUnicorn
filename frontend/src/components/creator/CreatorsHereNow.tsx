import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import api from '../../services/api';

interface CreatorPresence {
  id: string;
  type: string;
  note?: string;
  creator: {
    id: string;
    firstName: string;
    username: string;
    profilePicture?: string;
    creatorDisplayName?: string;
    creatorHandle?: string;
    followerCount: number;
  };
  recentContent: { id: string; title: string; thumbnailUrl?: string; contentType: string }[];
}

export default function CreatorsHereNow({ campgroundId }: { campgroundId: string }) {
  const [presences, setPresences] = useState<CreatorPresence[]>([]);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    api.get(`/creator-events/campground-presence/${campgroundId}`).then(({ data }) => setPresences(data.presences || [])).catch(() => {});
  }, [campgroundId]);

  if (presences.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-purple-100 p-3 mb-3">
      <h3 className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1.5">
        <Video className="w-3.5 h-3.5" /> Creators On-Site
      </h3>
      <div className="flex items-center gap-3">
        {presences.slice(0, 3).map((p) => (
          <Link key={p.id} to={`/creators/${p.creator.username}`} className="flex flex-col items-center gap-1 group">
            {p.creator.profilePicture ? (
              <img src={p.creator.profilePicture} className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 group-hover:border-purple-400 transition" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-600">
                {p.creator.firstName[0]}
              </div>
            )}
            <span className="text-[10px] font-semibold text-gray-700 group-hover:text-purple-600 transition">
              @{p.creator.creatorHandle || p.creator.username}
            </span>
            <span className="text-[10px] text-gray-400">
              {p.type === 'HOSTING' ? 'Hosting' : p.type === 'VISITING' ? 'Visiting' : 'Live'}
            </span>
          </Link>
        ))}
        {presences.length > 3 && (
          <span className="text-xs text-gray-400">+{presences.length - 3} more</span>
        )}
      </div>
      <button onClick={() => setShowContent(!showContent)}
        className="mt-2 text-[10px] font-semibold text-purple-600 hover:text-purple-700 transition">
        {showContent ? 'Hide content ↑' : 'See their recent content →'}
      </button>
      {showContent && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {presences.flatMap(p => p.recentContent.map(c => ({ ...c, creatorName: p.creator.creatorDisplayName || p.creator.firstName }))).slice(0, 4).map((c) => (
            <Link key={c.id} to={`/creators/content/${c.id}`} className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-sm transition">
              {c.thumbnailUrl && <img src={c.thumbnailUrl} className="w-full h-20 object-cover" alt="" />}
              <div className="p-2">
                <p className="text-[10px] font-semibold text-gray-800 line-clamp-1">{c.title}</p>
                <p className="text-[10px] text-gray-400">{c.creatorName}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
