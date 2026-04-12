import { useState, useEffect } from 'react';
import { X, UserPlus, Search } from 'lucide-react';
import api from '../services/api';

interface Tag {
  id: string;
  photoId: string;
  userId: string;
  x: number | null;
  y: number | null;
  user: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null };
}

interface EventPhotoTaggerProps {
  photoId: string;
  photoUrl: string;
  canTag: boolean;
  onClose: () => void;
}

export default function EventPhotoTagger({ photoId, photoUrl, canTag, onClose }: EventPhotoTaggerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagging, setTagging] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTags(); }, [photoId]);

  async function loadTags() {
    try {
      const { data } = await api.get(`/photo-tags/${photoId}/tags`);
      setTags(data.userTags || []);
    } catch {}
  }

  async function loadFriends() {
    try {
      const { data } = await api.get('/friends');
      setFriends((data || []).map((f: any) => f.friend || f));
    } catch {}
  }

  function startTagging() {
    setTagging(true);
    if (friends.length === 0) loadFriends();
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!tagging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPos({ x, y });
  }

  async function tagUser(userId: string) {
    if (!pendingPos) return;
    setSaving(true);
    try {
      await api.post(`/photo-tags/${photoId}/tag/user`, { userId, x: pendingPos.x, y: pendingPos.y });
      await loadTags();
      setPendingPos(null);
      setTagging(false);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to tag');
    }
    setSaving(false);
  }

  async function removeTag(userId: string) {
    try {
      await api.delete(`/photo-tags/${photoId}/tag/user/${userId}`);
      setTags(prev => prev.filter(t => t.userId !== userId));
    } catch {}
  }

  const filtered = friends.filter(f =>
    !tags.some(t => t.userId === f.id) &&
    (`${f.firstName} ${f.lastName} ${f.username}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white z-50"><X className="w-8 h-8" /></button>

      <div className="max-w-4xl w-full relative" onClick={e => e.stopPropagation()}>
        {/* Tag button */}
        {canTag && (
          <button onClick={startTagging}
            className={`absolute top-3 left-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              tagging ? 'bg-blue-600 text-white' : 'bg-black/60 text-white hover:bg-black/80'
            }`}>
            <UserPlus className="w-4 h-4" />
            {tagging ? 'Tap photo to tag' : 'Tag People'}
          </button>
        )}

        {/* Photo with tag overlay */}
        <div className={`relative ${tagging ? 'cursor-crosshair' : ''}`} onClick={handleImageClick}>
          <img src={photoUrl} alt="" className="w-full max-h-[75vh] object-contain rounded-xl" />

          {/* Existing tags */}
          {tags.filter(t => t.x != null && t.y != null).map(tag => (
            <div key={tag.id} className="absolute z-20 transform -translate-x-1/2 -translate-y-full"
              style={{ left: `${tag.x}%`, top: `${tag.y}%` }}>
              <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap flex items-center gap-1">
                <span>{tag.user.firstName} {tag.user.lastName}</span>
                {canTag && (
                  <button onClick={(e) => { e.stopPropagation(); removeTag(tag.userId); }} className="hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="w-0 h-0 mx-auto border-l-4 border-r-4 border-t-4 border-transparent border-t-black/80" />
            </div>
          ))}

          {/* Pending tag dot */}
          {pendingPos && (
            <div className="absolute z-20 w-6 h-6 bg-blue-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
              style={{ left: `${pendingPos.x}%`, top: `${pendingPos.y}%` }} />
          )}
        </div>

        {/* Friend selector */}
        {pendingPos && (
          <div className="absolute top-16 right-4 z-40 w-64 bg-white rounded-xl shadow-2xl border p-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-sm text-gray-900">Tag a friend</span>
              <button onClick={() => setPendingPos(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search friends..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" autoFocus />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No friends to tag</p>
              ) : filtered.map(f => (
                <button key={f.id} onClick={() => tagUser(f.id)} disabled={saving}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition text-left disabled:opacity-50">
                  {f.profilePicture ? (
                    <img src={f.profilePicture} className="w-7 h-7 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{f.firstName[0]}</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.firstName} {f.lastName}</p>
                    <p className="text-[10px] text-gray-400">@{f.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags list below photo */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/20 text-white">
                {tag.user.firstName} {tag.user.lastName}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
