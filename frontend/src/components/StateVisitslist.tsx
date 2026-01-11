import { useState, useEffect } from 'react';
import { MapPin, Calendar, Users, Plus, X, Edit2, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface StateVisit {
  id: string;
  state: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  campsite?: {
    id: string;
    name: string;
    slug: string;
  };
  event?: {
    id: string;
    title: string;
  };
  attendees: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
    };
  }[];
  createdAt: string;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

export default function StateVisitsList() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<StateVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<StateVisit | null>(null);

  const [formData, setFormData] = useState({
    state: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  useEffect(() => {
    loadVisits();
  }, []);

  const loadVisits = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/profile/${user?.username}/state-visits`);
      setVisits(data);
    } catch (error) {
      console.error('Load state visits error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.state || !formData.startDate) {
      alert('Please fill in required fields');
      return;
    }

    try {
      if (editingVisit) {
        await api.put(`/profile/state-visits/${editingVisit.id}`, formData);
        alert('Visit updated! ✅');
      } else {
        await api.post('/profile/state-visits', formData);
        alert('Visit added! 🗺️');
      }

      setShowAddModal(false);
      setEditingVisit(null);
      setFormData({
        state: '',
        startDate: '',
        endDate: '',
        notes: '',
      });
      await loadVisits();
    } catch (error) {
      console.error('Save visit error:', error);
      alert('Failed to save visit');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this state visit?')) return;

    try {
      await api.delete(`/profile/state-visits/${id}`);
      await loadVisits();
      alert('Visit deleted');
    } catch (error) {
      console.error('Delete visit error:', error);
      alert('Failed to delete visit');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading state visits...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">State Visits</h2>
          <p className="text-gray-600">Track where you've been camping</p>
        </div>
        <button
          onClick={() => {
            setEditingVisit(null);
            setFormData({
              state: '',
              startDate: '',
              endDate: '',
              notes: '',
            });
            setShowAddModal(true);
          }}
          className="btn btn-primary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Visit
        </button>
      </div>

      {/* Visits List */}
      {visits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visits.map((visit) => (
            <div key={visit.id} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  <h3 className="font-bold text-gray-900">{visit.state}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingVisit(visit);
                      setFormData({
                        state: visit.state,
                        startDate: visit.startDate.split('T')[0],
                        endDate: visit.endDate?.split('T')[0] || '',
                        notes: visit.notes || '',
                      });
                      setShowAddModal(true);
                    }}
                    className="p-1 text-gray-600 hover:text-primary-600 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(visit.id)}
                    className="p-1 text-gray-600 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(visit.startDate).toLocaleDateString()}
                    {visit.endDate && ` - ${new Date(visit.endDate).toLocaleDateString()}`}
                  </span>
                </div>

                {visit.campsite && (
                  <p className="text-gray-600">
                    📍 {visit.campsite.name}
                  </p>
                )}

                {visit.event && (
                  <p className="text-gray-600">
                    🎉 {visit.event.title}
                  </p>
                )}

                {visit.notes && (
                  <p className="text-gray-600 italic text-xs mt-2">{visit.notes}</p>
                )}

                {visit.attendees.length > 1 && (
                  <div className="flex items-center gap-1 text-gray-600 pt-2 border-t border-gray-200">
                    <Users className="w-4 h-4" />
                    <span className="text-xs">{visit.attendees.length} people</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No state visits recorded yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            Add Your First Visit
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {editingVisit ? 'Edit State Visit' : 'Add State Visit'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingVisit(null);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select a state</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="input"
                  placeholder="Where did you stay? What did you do?"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingVisit ? 'Save Changes' : 'Add Visit'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingVisit(null);
                  }}
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
