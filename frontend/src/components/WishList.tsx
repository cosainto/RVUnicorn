import { useState, useEffect } from 'react';
import { Plus, X, Heart, MapPin, Calendar, Check, Trash2, Edit2, Users, Globe } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from './ImageUpload';

interface WishListItem {
  id: string;
  state: string;
  campgroundName: string;
  imageUrl?: string;
  targetDate?: string;
  notes?: string;
  isCompleted: boolean;
  isPublic: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  activities: WishListActivity[];
  collaborators: WishListCollaborator[];
}

interface WishListActivity {
  id: string;
  name: string;
  imageUrl?: string;
  notes?: string;
  isCompleted: boolean;
  taggedUsers: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      profilePicture?: string;
    };
  }[];
}

interface WishListCollaborator {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  canEdit: boolean;
}

const STATE_NAMES: { [key: string]: string } = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

const US_STATES = Object.keys(STATE_NAMES).sort();

export default function WishList() {
  const { user } = useAuth();
  const [wishList, setWishList] = useState<WishListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WishListItem | null>(null);
  const [editingActivity, setEditingActivity] = useState<WishListActivity | null>(null);
  
  const [destinationForm, setDestinationForm] = useState({
    state: '',
    campgroundName: '',
    imageUrl: '',
    targetDate: '',
    notes: '',
  });

  const [activityForm, setActivityForm] = useState({
    name: '',
    imageUrl: '',
    notes: '',
  });

  useEffect(() => {
    loadWishList();
  }, []);

  const loadWishList = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/wishlist');
      setWishList(data);
    } catch (error) {
      console.error('Load wish list error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDestination = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!destinationForm.state || !destinationForm.campgroundName) {
      alert('Please fill in required fields');
      return;
    }

    try {
      await api.post('/wishlist', {
        ...destinationForm,
        activities: [],
      });

      alert('✅ Added to wish list!');
      setShowDestinationModal(false);
      setDestinationForm({
        state: '',
        campgroundName: '',
        imageUrl: '',
        targetDate: '',
        notes: '',
      });
      loadWishList();
    } catch (error) {
      console.error('Add destination error:', error);
      alert('Failed to add destination');
    }
  };

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activityForm.name || !selectedItem) {
      alert('Please enter activity name');
      return;
    }

    try {
      if (editingActivity) {
        await api.put(`/wishlist/activities/${editingActivity.id}`, activityForm);
        alert('✅ Activity updated!');
      } else {
        await api.post(`/wishlist/${selectedItem.id}/activities`, activityForm);
        alert('✅ Activity added!');
      }
      
      setShowActivityModal(false);
      setActivityForm({ name: '', imageUrl: '', notes: '' });
      setEditingActivity(null);
      loadWishList();
    } catch (error) {
      console.error('Activity error:', error);
      alert('Failed to save activity');
    }
  };

  const handleToggleDestinationComplete = async (id: string, isCompleted: boolean) => {
    try {
      await api.put(`/wishlist/${id}`, { isCompleted: !isCompleted });
      loadWishList();
    } catch (error) {
      console.error('Toggle complete error:', error);
    }
  };

  const handleToggleActivityComplete = async (activityId: string, isCompleted: boolean) => {
    try {
      await api.put(`/wishlist/activities/${activityId}`, { isCompleted: !isCompleted });
      loadWishList();
    } catch (error) {
      console.error('Toggle activity error:', error);
    }
  };

  const handleDeleteDestination = async (id: string) => {
    if (!confirm('Remove this destination from your wish list?')) return;

    try {
      await api.delete(`/wishlist/${id}`);
      loadWishList();
    } catch (error) {
      console.error('Delete destination error:', error);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('Remove this activity?')) return;

    try {
      await api.delete(`/wishlist/activities/${activityId}`);
      loadWishList();
    } catch (error) {
      console.error('Delete activity error:', error);
    }
  };

  const handleTogglePrivacy = async (id: string, isPublic: boolean) => {
    try {
      await api.put(`/wishlist/${id}/privacy`, { isPublic: !isPublic });
      loadWishList();
    } catch (error) {
      console.error('Toggle privacy error:', error);
    }
  };

  const openAddActivity = (item: WishListItem) => {
    setSelectedItem(item);
    setEditingActivity(null);
    setActivityForm({ name: '', imageUrl: '', notes: '' });
    setShowActivityModal(true);
  };

  const openEditActivity = (item: WishListItem, activity: WishListActivity) => {
    setSelectedItem(item);
    setEditingActivity(activity);
    setActivityForm({
      name: activity.name,
      imageUrl: activity.imageUrl || '',
      notes: activity.notes || '',
    });
    setShowActivityModal(true);
  };

  const groupedByState = wishList.reduce((acc, item) => {
    if (!acc[item.state]) acc[item.state] = [];
    acc[item.state].push(item);
    return acc;
  }, {} as { [key: string]: WishListItem[] });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading wish list...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-pink-500 to-red-500 p-3 rounded-xl shadow-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Camping Bucket List</h2>
            <p className="text-sm text-gray-600">Dream destinations & adventures! ✨</p>
          </div>
        </div>
        <button
          onClick={() => setShowDestinationModal(true)}
          className="btn btn-primary flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Destination
        </button>
      </div>

      {/* Wish List Grid */}
      {Object.keys(groupedByState).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedByState)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([state, items]) => (
              <div key={state} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    {STATE_NAMES[state]}
                  </h3>
                  <p className="text-sm opacity-90">{items.length} destination{items.length !== 1 ? 's' : ''}</p>
                </div>

                <div className="p-4 space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`border-2 rounded-lg overflow-hidden transition ${
                        item.isCompleted
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      {/* Destination Header */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            <button
                              onClick={() => handleToggleDestinationComplete(item.id, item.isCompleted)}
                              className={`w-6 h-6 rounded flex items-center justify-center border-2 transition flex-shrink-0 ${
                                item.isCompleted
                                  ? 'bg-green-500 border-green-500'
                                  : 'bg-white border-gray-300 hover:border-green-500'
                              }`}
                            >
                              {item.isCompleted && <Check className="w-4 h-4 text-white" />}
                            </button>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className={`font-bold text-xl ${item.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                  {item.campgroundName}
                                </h4>
                                {item.isPublic && (
                                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-semibold">
                                    Public
                                  </span>
                                )}
                              </div>

                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.campgroundName}
                                  className="w-full h-48 object-cover rounded-lg mb-3"
                                />
                              )}

                              {item.targetDate && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>Target: {new Date(item.targetDate).toLocaleDateString()}</span>
                                </div>
                              )}

                              {item.notes && (
                                <p className="text-sm text-gray-600 italic mb-3">"{item.notes}"</p>
                              )}

                              {item.collaborators.length > 0 && (
                                <div className="flex items-center gap-2 mb-3">
                                  <Users className="w-4 h-4 text-gray-500" />
                                  <div className="flex -space-x-2">
                                    {item.collaborators.slice(0, 3).map((collab) => (
                                      <div
                                        key={collab.user.id}
                                        className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
                                        title={`${collab.user.firstName} ${collab.user.lastName}`}
                                      >
                                        {collab.user.profilePicture ? (
                                          <img
                                            src={collab.user.profilePicture}
                                            alt={collab.user.firstName}
                                            className="w-full h-full rounded-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-xs text-gray-600">
                                            {collab.user.firstName[0]}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <span className="text-xs text-gray-600">
                                    {item.collaborators.length} collaborator{item.collaborators.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-1">
                            <button
                              onClick={() => handleTogglePrivacy(item.id, item.isPublic)}
                              className={`p-1 rounded transition ${
                                item.isPublic
                                  ? 'text-green-600 hover:text-green-700'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                              title={item.isPublic ? 'Public - Click to make private' : 'Private - Click to make public'}
                            >
                              <Globe className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDestination(item.id)}
                              className="text-red-500 hover:text-red-700 transition p-1"
                              title="Delete destination"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Activities Pinterest Board */}
                        {item.activities.length > 0 && (
                          <div className="border-t pt-3">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-semibold text-gray-700">Things to Do:</h5>
                              <button
                                onClick={() => openAddActivity(item)}
                                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                Add Activity
                              </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {item.activities.map((activity) => (
                                <div
                                  key={activity.id}
                                  className={`relative group rounded-lg overflow-hidden border-2 transition ${
                                    activity.isCompleted
                                      ? 'bg-green-50 border-green-300'
                                      : 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 hover:shadow-lg'
                                  }`}
                                >
                                  {/* Activity Image */}
                                  {activity.imageUrl && (
                                    <div className="relative h-32 overflow-hidden">
                                      <img
                                        src={activity.imageUrl}
                                        alt={activity.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition"
                                      />
                                      {activity.isCompleted && (
                                        <div className="absolute inset-0 bg-green-500 bg-opacity-40 flex items-center justify-center">
                                          <Check className="w-8 h-8 text-white" />
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Activity Content */}
                                  <div className="p-3">
                                    <div className="flex items-start gap-2 mb-2">
                                      <button
                                        onClick={() => handleToggleActivityComplete(activity.id, activity.isCompleted)}
                                        className={`w-4 h-4 rounded flex items-center justify-center border-2 transition flex-shrink-0 mt-0.5 ${
                                          activity.isCompleted
                                            ? 'bg-green-500 border-green-500'
                                            : 'bg-white border-gray-300 hover:border-green-500'
                                        }`}
                                      >
                                        {activity.isCompleted && <Check className="w-3 h-3 text-white" />}
                                      </button>
                                      <p className={`text-sm font-medium flex-1 ${activity.isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                        {activity.name}
                                      </p>
                                    </div>

                                    {activity.notes && (
                                      <p className="text-xs text-gray-600 italic mb-2">"{activity.notes}"</p>
                                    )}

                                    {activity.taggedUsers.length > 0 && (
                                      <div className="flex -space-x-1 mb-2">
                                        {activity.taggedUsers.slice(0, 3).map((tag) => (
                                          <div
                                            key={tag.user.id}
                                            className="w-5 h-5 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
                                            title={`${tag.user.firstName} ${tag.user.lastName}`}
                                          >
                                            {tag.user.profilePicture ? (
                                              <img
                                                src={tag.user.profilePicture}
                                                alt={tag.user.firstName}
                                                className="w-full h-full rounded-full object-cover"
                                              />
                                            ) : (
                                              <span className="text-xs text-gray-600">
                                                {tag.user.firstName[0]}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Hover Actions */}
                                    <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                                      <button
                                        onClick={() => openEditActivity(item, activity)}
                                        className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteActivity(activity.id)}
                                        className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add First Activity Button */}
                        {item.activities.length === 0 && (
                          <div className="border-t pt-3">
                            <button
                              onClick={() => openAddActivity(item)}
                              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition flex items-center justify-center gap-2"
                            >
                              <Plus className="w-5 h-5" />
                              <span>Add Activities</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No destinations yet</h3>
          <p className="text-gray-600 mb-4">Start building your camping bucket list!</p>
          <button onClick={() => setShowDestinationModal(true)} className="btn btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Add First Destination
          </button>
        </div>
      )}

      {/* Destination Modal */}
      {showDestinationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white p-6 rounded-t-xl sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Heart className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">Add Destination</h2>
                </div>
                <button
                  onClick={() => setShowDestinationModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitDestination} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  State *
                </label>
                <select
                  value={destinationForm.state}
                  onChange={(e) => setDestinationForm({ ...destinationForm, state: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">Select a state...</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{STATE_NAMES[state]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Campground / Destination *
                </label>
                <input
                  type="text"
                  value={destinationForm.campgroundName}
                  onChange={(e) => setDestinationForm({ ...destinationForm, campgroundName: e.target.value })}
                  className="input w-full"
                  placeholder="Yosemite National Park"
                  required
                />
              </div>

              <ImageUpload
                onImageUploaded={(url) => setDestinationForm({ ...destinationForm, imageUrl: url })}
                currentImage={destinationForm.imageUrl}
                label="Destination Image"
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Target Visit Date (Optional)
                </label>
                <input
                  type="date"
                  value={destinationForm.targetDate}
                  onChange={(e) => setDestinationForm({ ...destinationForm, targetDate: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={destinationForm.notes}
                  onChange={(e) => setDestinationForm({ ...destinationForm, notes: e.target.value })}
                  rows={2}
                  className="input w-full"
                  placeholder="Why you want to visit..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={!destinationForm.state || !destinationForm.campgroundName}
                >
                  ✨ Add Destination
                </button>
                <button
                  type="button"
                  onClick={() => setShowDestinationModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 rounded-t-xl sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plus className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">
                    {editingActivity ? 'Edit Activity' : 'Add Activity'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowActivityModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitActivity} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Activity Name *
                </label>
                <input
                  type="text"
                  value={activityForm.name}
                  onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })}
                  className="input w-full"
                  placeholder="Half Dome hike"
                  required
                />
              </div>

              <ImageUpload
                onImageUploaded={(url) => setActivityForm({ ...activityForm, imageUrl: url })}
                currentImage={activityForm.imageUrl}
                label="Activity Image"
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                  rows={2}
                  className="input w-full"
                  placeholder="Details about this activity..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={!activityForm.name}
                >
                  {editingActivity ? '💾 Save Changes' : '✨ Add Activity'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
