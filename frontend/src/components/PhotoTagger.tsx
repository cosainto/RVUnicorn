import { useState, useEffect, ReactNode } from 'react';
import { X, UserPlus, Search } from 'lucide-react';
import api from '../services/api';

interface Tag {
  id: string;
  taggedUserId: string;
  taggedById: string;
  positionX: number | null;
  positionY: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  taggedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture: string | null;
  };
}

interface Friend {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
}

interface PhotoTaggerProps {
  mediaId: string;
  isOwner: boolean;
  children: ReactNode;
  onTagsChange?: () => void;
}

export default function PhotoTagger({ mediaId, isOwner, children, onTagsChange }: PhotoTaggerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [showTagMode, setShowTagMode] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTags();
    if (isOwner) fetchFriends();
  }, [mediaId, isOwner]);

  const fetchTags = async () => {
    try {
      const { data } = await api.get(`/media-albums/media/${mediaId}/tags`);
      setTags(data);
    } catch (error) {
      console.log('Could not fetch tags');
    }
  };

  const fetchFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data.map((f: any) => f.friend || f));
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showTagMode || !isOwner) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setPendingPosition({ x, y });
  };

  const handleTagUser = async (userId: string) => {
    if (!pendingPosition) return;

    try {
      setLoading(true);
      await api.post(`/media-albums/media/${mediaId}/tags`, {
        taggedUserId: userId,
        positionX: pendingPosition.x,
        positionY: pendingPosition.y,
      });
      
      await fetchTags();
      setPendingPosition(null);
      setShowTagMode(false);
      onTagsChange?.();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to tag user');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await api.delete(`/media-albums/media/${mediaId}/tags/${tagId}`);
      setTags(tags.filter(t => t.id !== tagId));
      onTagsChange?.();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const filteredFriends = friends.filter(f => 
    !tags.some(t => t.taggedUserId === f.id) &&
    (f.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     f.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     f.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative">
      {/* Tag Mode Toggle (Owner only) */}
      {isOwner && (
        <button
          onClick={() => {
            setShowTagMode(!showTagMode);
            setPendingPosition(null);
          }}
          className={`absolute top-2 left-2 z-20 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition ${
            showTagMode 
              ? 'bg-blue-600 text-white' 
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          {showTagMode ? 'Tagging...' : 'Tag'}
        </button>
      )}

      {/* Click Area for Tagging */}
      <div 
        onClick={handleImageClick}
        className={`relative ${showTagMode ? 'cursor-crosshair' : ''}`}
      >
        {children}
        
        {/* Existing Tags */}
        {tags.filter(t => t.status === 'APPROVED' && t.positionX && t.positionY).map(tag => (
          <div
            key={tag.id}
            className="absolute z-10 transform -translate-x-1/2 -translate-y-full"
            style={{ left: `${tag.positionX}%`, top: `${tag.positionY}%` }}
          >
            <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap flex items-center gap-1">
              <span>{tag.taggedUser?.firstName} {tag.taggedUser?.lastName}</span>
              {isOwner && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag.id); }}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="w-0 h-0 mx-auto border-l-4 border-r-4 border-t-4 border-transparent border-t-black/80" />
          </div>
        ))}

        {/* Pending Tag Position */}
        {pendingPosition && (
          <div
            className="absolute z-20 w-6 h-6 bg-blue-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
            style={{ left: `${pendingPosition.x}%`, top: `${pendingPosition.y}%` }}
          />
        )}
      </div>

      {/* Friend Selector Modal */}
      {pendingPosition && (
        <div className="absolute top-4 right-4 z-30 w-64 bg-white rounded-xl shadow-xl border p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-sm">Tag a friend</span>
            <button onClick={() => setPendingPosition(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredFriends.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No friends to tag</p>
            ) : (
              filteredFriends.map(friend => (
                <button
                  key={friend.id}
                  onClick={() => handleTagUser(friend.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition text-left"
                >
                  <img
                    src={friend.profilePicture || '/default-avatar.png'}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {friend.firstName} {friend.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">@{friend.username}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tags List (below image) */}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map(tag => (
            <span 
              key={tag.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                tag.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                tag.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-500 line-through'
              }`}
            >
              {tag.taggedUser?.firstName} {tag.taggedUser?.lastName}
              {tag.status === 'PENDING' && <span className="text-yellow-600">(pending)</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
