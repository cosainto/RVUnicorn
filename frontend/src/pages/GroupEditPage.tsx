import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import api from '../services/api';
import ImageUpload from '../components/ImageUpload';

export default function GroupEditPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'PUBLIC',
    coverPhoto: '',
  });

  useEffect(() => {
    loadGroup();
  }, [slug]);

  const loadGroup = async () => {
    try {
      const { data } = await api.get('/groups/' + slug);
      setGroup(data);
      setFormData({
        name: data.name,
        description: data.description || '',
        privacy: data.privacy,
        coverPhoto: data.coverPhoto || '',
      });
    } catch (error) {
      console.error('Load group error:', error);
      alert('Failed to load group');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert('Please enter a group name');
      return;
    }

    try {
      setSaving(true);
      await api.put('/groups/' + slug, formData);
      alert('Group updated!');
      navigate('/groups/' + slug);
    } catch (error) {
      console.error('Update group error:', error);
      alert('Failed to update group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this group? This cannot be undone.')) {
      return;
    }

    try {
      await api.delete('/groups/' + slug);
      alert('Group deleted');
      navigate('/groups');
    } catch (error) {
      console.error('Delete group error:', error);
      alert('Failed to delete group');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <button
          onClick={() => navigate('/groups/' + slug)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Group
        </button>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Manage Group</h1>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cover Photo
            </label>
            {formData.coverPhoto ? (
              <div className="relative">
                <img
                  src={formData.coverPhoto.startsWith('http') ? formData.coverPhoto : '' + formData.coverPhoto}
                  alt="Cover"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={() => setFormData({ ...formData, coverPhoto: '' })}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <ImageUpload
                onImageUploaded={(url) => setFormData({ ...formData, coverPhoto: url })}
                currentImage=""
                label="Upload Cover Photo"
              />
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter group name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              placeholder="What is this group about?"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Privacy
            </label>
            <select
              value={formData.privacy}
              onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="PUBLIC">Public - Anyone can see and join</option>
              <option value="CLOSED">Closed - Anyone can see, but must request to join</option>
              <option value="PRIVATE">Private - Only members can see</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={handleDelete}
              className="btn bg-red-100 text-red-600 hover:bg-red-200 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Group
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
