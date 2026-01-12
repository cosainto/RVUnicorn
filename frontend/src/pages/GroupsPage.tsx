import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Lock, Globe, UserCheck, X, Search, Tag } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload';

interface Group {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverPhoto?: string;
  tags?: string[];
  privacy: string;
  createdById: string;
  createdBy: {
    firstName: string;
    lastName: string;
    username: string;
  };
  _count: {
    members: number;
    posts: number;
    events: number;
  };
}

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'PUBLIC',
    coverPhoto: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async (search?: string, tag?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (tag) params.append('tag', tag);
      const { data } = await api.get(`/groups?${params.toString()}`);
      setGroups(data);
    } catch (error) {
      console.error('Load groups error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!formData.name) {
      alert('Please enter a group name');
      return;
    }

    try {
      await api.post('/groups', formData);
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        privacy: 'PUBLIC',
        coverPhoto: '',
        tags: [],
      });
      setTagInput('');
      await loadGroups();
      alert('Group created! 🎉');
    } catch (error) {
      console.error('Create group error:', error);
      alert('Failed to create group');
    }
  };

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case 'PUBLIC':
        return <Globe className="w-4 h-4 text-green-600" />;
      case 'CLOSED':
        return <UserCheck className="w-4 h-4 text-yellow-600" />;
      case 'PRIVATE':
        return <Lock className="w-4 h-4 text-red-600" />;
      default:
        return <Globe className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-600 mt-1">Join communities of camping enthusiasts</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Group
        </button>
        <Link to="/groups/invites" className="btn btn-secondary flex items-center gap-2">
          <Users className="w-5 h-5" />
          My Invites
        </Link>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search groups by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadGroups(searchQuery, selectedTag)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                loadGroups(searchQuery, e.target.value);
              }}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Tags</option>
              <optgroup label="🚐 RV Types">
                <option value="Motorhomes">Motorhomes</option>
                <option value="Travel Trailers">Travel Trailers</option>
                <option value="Fifth Wheels">Fifth Wheels</option>
                <option value="Camper Vans">Camper Vans</option>
                <option value="Class A">Class A</option>
                <option value="Class B">Class B</option>
                <option value="Class C">Class C</option>
              </optgroup>
              <optgroup label="🏭 RV Brands">
                <option value="Airstream">Airstream</option>
                <option value="Winnebago">Winnebago</option>
                <option value="Jayco">Jayco</option>
                <option value="Forest River">Forest River</option>
                <option value="Thor Motor Coach">Thor Motor Coach</option>
                <option value="Grand Design RV">Grand Design RV</option>
                <option value="Coachmen">Coachmen</option>
                <option value="Keystone RV">Keystone RV</option>
                <option value="Newmar">Newmar</option>
                <option value="Tiffin">Tiffin</option>
                <option value="Entegra Coach">Entegra Coach</option>
                <option value="Fleetwood RV">Fleetwood RV</option>
                <option value="Heartland RV">Heartland RV</option>
                <option value="Lance Campers">Lance Campers</option>
                <option value="Oliver Travel Trailers">Oliver Travel Trailers</option>
                <option value="nuCamp">nuCamp</option>
                <option value="Storyteller Overland">Storyteller Overland</option>
                <option value="EarthRoamer">EarthRoamer</option>
              </optgroup>
              <optgroup label="⛺ Camping Gear Brands">
                <option value="REI Co-op">REI Co-op</option>
                <option value="Coleman">Coleman</option>
                <option value="Big Agnes">Big Agnes</option>
                <option value="MSR">MSR</option>
                <option value="The North Face">The North Face</option>
                <option value="Kelty">Kelty</option>
                <option value="YETI">YETI</option>
                <option value="Patagonia">Patagonia</option>
                <option value="Columbia">Columbia</option>
              </optgroup>
              <optgroup label="🔥 Cooking & Grills">
                <option value="Blackstone">Blackstone</option>
                <option value="Weber">Weber</option>
                <option value="Camp Chef">Camp Chef</option>
                <option value="Traeger">Traeger</option>
                <option value="Jetboil">Jetboil</option>
              </optgroup>
              <optgroup label="⚡ Power & Solar">
                <option value="Jackery">Jackery</option>
                <option value="Goal Zero">Goal Zero</option>
                <option value="EcoFlow">EcoFlow</option>
                <option value="Bluetti">Bluetti</option>
                <option value="Renogy">Renogy</option>
              </optgroup>
              <optgroup label="🏕️ Campground Networks">
                <option value="KOA">KOA</option>
                <option value="Thousand Trails">Thousand Trails</option>
                <option value="Hipcamp">Hipcamp</option>
                <option value="Harvest Hosts">Harvest Hosts</option>
                <option value="Boondockers Welcome">Boondockers Welcome</option>
              </optgroup>
              <optgroup label="🔧 RV Parts & Accessories">
                <option value="Dometic">Dometic</option>
                <option value="Thetford">Thetford</option>
                <option value="Lippert">Lippert</option>
                <option value="Camco">Camco</option>
              </optgroup>
              <optgroup label="🎯 Lifestyle">
                <option value="Full-Time RV">Full-Time RV</option>
                <option value="Boondocking">Boondocking</option>
                <option value="Family Camping">Family Camping</option>
                <option value="Pets">Pets</option>
                <option value="Hiking">Hiking</option>
                <option value="Fishing">Fishing</option>
                <option value="Overlanding">Overlanding</option>
                <option value="Weekend Warriors">Weekend Warriors</option>
              </optgroup>
            </select>
            <button
              onClick={() => loadGroups(searchQuery, selectedTag)}
              className="btn btn-primary"
            >
              Search
            </button>
            {(searchQuery || selectedTag) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag('');
                  loadGroups();
                }}
                className="btn btn-secondary"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/groups/${group.slug}`}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition"
            >
              {/* Cover Photo */}
              <div className="h-48 bg-gradient-to-br from-green-100 to-blue-100 relative">
                {group.coverPhoto ? (
                  <img
                    src={`${group.coverPhoto}`}
                    alt={group.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users className="w-20 h-20 text-green-300" />
                  </div>
                )}
                {/* Privacy Badge */}
                <div className="absolute top-3 right-3 bg-white rounded-full p-2 shadow">
                  {getPrivacyIcon(group.privacy)}
                </div>
              </div>

              {/* Group Info */}
              <div className="p-5">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{group.name}</h3>
                {group.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {group.description}
                  </p>
                )}

                {/* Tags */}
                {group.tags && group.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {group.tags.slice(0, 3).map((tag: string, index: number) => (
                      <span key={index} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {tag}
                      </span>
                    ))}
                    {group.tags.length > 3 && (
                      <span className="text-gray-400 text-xs">+{group.tags.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{group._count.members} members</span>
                  </div>
                  <div>
                    {group._count.posts} posts
                  </div>
                </div>

                {/* Privacy Label */}
                <div className="text-xs text-gray-500">
                  {group.privacy === 'PUBLIC' && '🌍 Public Group'}
                  {group.privacy === 'CLOSED' && '🔒 Closed Group - Request to Join'}
                  {group.privacy === 'PRIVATE' && '🔐 Private Group - Invite Only'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Groups Yet</h3>
          <p className="text-gray-600 mb-4">Be the first to create a camping group!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Create Group
          </button>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 rounded-t-lg sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Create Group</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="RV Adventurers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="input w-full"
                  placeholder="Tell people what this group is about..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Privacy
                </label>
                <select
                  value={formData.privacy}
                  onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
                  className="input w-full"
                >
                  <option value="PUBLIC">🌍 Public - Anyone can join</option>
                  <option value="CLOSED">🔒 Closed - Anyone can request to join</option>
                  <option value="PRIVATE">🔐 Private - Invite only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cover Photo (Optional)
                </label>
                <ImageUpload
                  onImageUploaded={(url) => setFormData({ ...formData, coverPhoto: url })}
                  currentImage={formData.coverPhoto}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (Optional)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag, index) => (
                    <span key={index} className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, tags: formData.tags.filter((_, i) => i !== index) })}
                        className="text-primary-500 hover:text-primary-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        if (!formData.tags.includes(tagInput.trim())) {
                          setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
                        }
                        setTagInput('');
                      }
                    }}
                    placeholder="Add a tag and press Enter"
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
                        setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
                        setTagInput('');
                      }
                    }}
                    className="btn btn-secondary"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Suggested: Airstream, Winnebago, Full-Time RV, Boondocking, Family Camping, YETI, Blackstone, KOA, Pets, Overlanding</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateGroup}
                  className="btn btn-primary flex-1"
                >
                  Create Group
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
