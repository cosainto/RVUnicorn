import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Flame, Camera, Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface PlaybookContent {
  id: string;
  phase: string;
  title: string;
  description?: string;
  contentId?: string;
  actionableId?: string;
  sortOrder: number;
}

interface Playbook {
  id: string;
  eventId: string;
  packingList: string[];
  whatToExpect?: string;
  hitchWelcome?: string;
  beforeContent: PlaybookContent[];
  duringContent: PlaybookContent[];
  afterContent: PlaybookContent[];
  creator?: { id: string; firstName: string; profilePicture?: string };
}

interface EventPlaybookTabProps {
  eventId: string;
  organizerId: string;
  isLive?: boolean;
  isEnded?: boolean;
  campgroundId?: string;
}

export default function EventPlaybookTab({
  eventId,
  organizerId,
  isLive = false,
  isEnded = false,
}: EventPlaybookTabProps) {
  const { user } = useAuth();
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [liveFeed, setLiveFeed] = useState<any[]>([]);

  // Editing
  const [editing, setEditing] = useState(false);
  const [whatToExpect, setWhatToExpect] = useState('');
  const [packingInput, setPackingInput] = useState('');
  const [packingList, setPackingList] = useState<string[]>([]);

  // Add content
  const [addingPhase, setAddingPhase] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const isOrganizer = user?.id === organizerId;
  const storageKey = `playbook-${eventId}-checked`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setCheckedItems(new Set(JSON.parse(stored)));
  }, [storageKey]);

  const loadPlaybook = useCallback(async () => {
    try {
      const { data } = await api.get(`/actionable/events/${eventId}/playbook`);
      setPlaybook(data);
      setWhatToExpect(data.whatToExpect || '');
      setPackingList(data.packingList || []);
    } catch (e: any) {
      if (e.response?.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadLiveFeed = useCallback(async () => {
    if (!isLive) return;
    try {
      const { data } = await api.get(`/actionable/events/${eventId}/playbook/live-feed`);
      setLiveFeed(data.items || []);
    } catch (e) {
      console.error('Failed to load live feed:', e);
    }
  }, [eventId, isLive]);

  useEffect(() => {
    loadPlaybook();
  }, [loadPlaybook]);

  useEffect(() => {
    if (isLive) {
      loadLiveFeed();
      const interval = setInterval(loadLiveFeed, 60000);
      return () => clearInterval(interval);
    }
  }, [isLive, loadLiveFeed]);

  const toggleCheck = (item: string) => {
    const updated = new Set(checkedItems);
    if (updated.has(item)) updated.delete(item);
    else updated.add(item);
    setCheckedItems(updated);
    localStorage.setItem(storageKey, JSON.stringify([...updated]));
  };

  const handleCreatePlaybook = async () => {
    try {
      const { data } = await api.post(`/actionable/events/${eventId}/playbook`, {
        packingList: [],
        whatToExpect: '',
      });
      setPlaybook(data);
      setNotFound(false);
      setEditing(true);
    } catch (e) {
      console.error('Failed to create playbook:', e);
    }
  };

  const handleSavePlaybook = async () => {
    try {
      await api.post(`/actionable/events/${eventId}/playbook`, {
        whatToExpect,
        packingList,
      });
      setEditing(false);
      loadPlaybook();
    } catch (e) {
      console.error('Failed to save playbook:', e);
    }
  };

  const handleAddPacking = () => {
    if (!packingInput.trim()) return;
    setPackingList([...packingList, packingInput.trim()]);
    setPackingInput('');
  };

  const handleAddContent = async (phase: string) => {
    if (!newTitle.trim()) return;
    try {
      await api.post(`/actionable/events/${eventId}/playbook/content`, {
        phase,
        title: newTitle,
        description: newDesc || null,
      });
      setAddingPhase(null);
      setNewTitle('');
      setNewDesc('');
      loadPlaybook();
    } catch (e) {
      console.error('Failed to add content:', e);
    }
  };

  const handleDeleteContent = async (contentItemId: string) => {
    try {
      await api.delete(`/actionable/events/${eventId}/playbook/content/${contentItemId}`);
      loadPlaybook();
    } catch (e) {
      console.error('Failed to delete content:', e);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-3"><div className="bg-gray-100 rounded-lg h-24" /></div>;
  }

  // No playbook yet
  if (notFound) {
    if (!isOrganizer) return null; // Hide tab for attendees
    return (
      <div className="bg-white rounded-xl p-6 text-center">
        <ClipboardList size={32} className="mx-auto text-gray-400 mb-3" />
        <h3 className="font-semibold text-gray-900 mb-1">Set up your Event Playbook</h3>
        <p className="text-sm text-gray-500 mb-4">
          Help attendees prepare with a packing list, what to expect, and activity guides.
        </p>
        <button
          onClick={handleCreatePlaybook}
          className="bg-campfire-500 text-white font-medium px-6 py-2 rounded-lg hover:bg-campfire-600 transition-colors"
        >
          Set up your playbook →
        </button>
      </div>
    );
  }

  if (!playbook) return null;

  return (
    <div className="space-y-6">
      {/* BEFORE phase */}
      <div>
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
          <ClipboardList size={18} className="text-primary-600" />
          Before You Arrive
        </h3>

        {/* Packing list */}
        {(playbook.packingList.length > 0 || editing) && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Packing List</h4>
            {editing ? (
              <div>
                <div className="space-y-1 mb-2">
                  {packingList.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{item}</span>
                      <button
                        onClick={() => setPackingList(packingList.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={packingInput}
                    onChange={(e) => setPackingInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPacking()}
                    placeholder="Add item..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button onClick={handleAddPacking} className="text-primary-600 text-sm font-medium">
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {playbook.packingList.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkedItems.has(item)}
                      onChange={() => toggleCheck(item)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span className={checkedItems.has(item) ? 'line-through text-gray-400' : 'text-gray-700'}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* What to expect */}
        {(playbook.whatToExpect || editing) && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">What to Expect</h4>
            {editing ? (
              <textarea
                value={whatToExpect}
                onChange={(e) => setWhatToExpect(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Describe what attendees should expect..."
              />
            ) : (
              <p className="text-sm text-gray-600">{playbook.whatToExpect}</p>
            )}
          </div>
        )}

        {/* Before content items */}
        {renderContentList(playbook.beforeContent, 'BEFORE')}
      </div>

      {/* DURING phase */}
      {isLive && (
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
            <Flame size={18} className="text-campfire-500" />
            Happening Now
          </h3>
          {liveFeed.length > 0 ? (
            <div className="space-y-2">
              {liveFeed.map((item: any, i: number) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-gray-100 text-sm">
                  {item.type === 'COMPLETION' && (
                    <p>
                      <span className="font-medium">{item.user?.firstName}</span> completed{' '}
                      <span className="font-medium">{item.actionable?.title}</span>
                    </p>
                  )}
                  {item.type === 'ACTIVE_INSTANCE' && (
                    <p>
                      {item.actionable?.title} — {item._count?.participants} people participating
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Nothing happening yet — check back soon!</p>
          )}
          {renderContentList(playbook.duringContent, 'DURING')}
        </div>
      )}

      {/* AFTER phase */}
      {isEnded && (
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
            <Camera size={18} className="text-twilight-500" />
            Memories
          </h3>
          {renderContentList(playbook.afterContent, 'AFTER')}
        </div>
      )}

      {/* Organizer edit controls */}
      {isOrganizer && (
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSavePlaybook}
                className="flex-1 bg-primary-600 text-white text-sm font-medium py-2 rounded-lg"
              >
                Save Changes
              </button>
              <button
                onClick={() => { setEditing(false); loadPlaybook(); }}
                className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-primary-600 font-medium px-4 py-2 border border-primary-200 rounded-lg hover:bg-primary-50"
            >
              Edit Playbook
            </button>
          )}
        </div>
      )}

      {/* Add content sheet */}
      {addingPhase && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddingPhase(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5">
            <h3 className="font-bold text-gray-900 mb-4">
              Add {addingPhase.charAt(0) + addingPhase.slice(1).toLowerCase()} Content
            </h3>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAddContent(addingPhase)}
                className="flex-1 bg-primary-600 text-white text-sm font-medium py-2 rounded-lg"
              >
                Add
              </button>
              <button
                onClick={() => setAddingPhase(null)}
                className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderContentList(items: PlaybookContent[], phase: string) {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-lg p-3 border border-gray-100 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{item.title}</p>
              {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
            </div>
            {isOrganizer && (
              <button
                onClick={() => handleDeleteContent(item.id)}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {isOrganizer && (
          <button
            onClick={() => setAddingPhase(phase)}
            className="w-full text-sm text-primary-600 font-medium py-2 border border-dashed border-primary-300 rounded-lg hover:bg-primary-50 flex items-center justify-center gap-1"
          >
            <Plus size={14} /> Add Content
          </button>
        )}
      </div>
    );
  }
}
