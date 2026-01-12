import { useState, useEffect } from 'react';
import { Upload, X, Trash2, Play, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import ImageUpload from './ImageUpload';

interface RVShowcaseEditProps {
  onSaved?: () => void;
}

export default function RVShowcaseEdit({ onSaved }: RVShowcaseEditProps) {
  const [showcase, setShowcase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    privacy: 'PUBLIC',
    photos: [] as string[],
    videoUrl: '',
  });

  useEffect(() => {
    loadShowcase();
  }, []);

  const loadShowcase = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/rv-showcase/user/${localStorage.getItem('userId')}`);
      setShowcase(data);
      setFormData({
        title: data.title || '',
        description: data.description || '',
        privacy: data.privacy || 'PUBLIC',
        photos: data.photos || [],
        videoUrl: data.videoUrl || '',
      });
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Load showcase error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/rv-showcase', formData);
      alert('RV Showcase saved! 🎉');
      await loadShowcase();
      if (onSaved) onSaved();
    } catch (error) {
      console.error('Save showcase error:', error);
      alert('Failed to save showcase');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete your entire RV showcase? This cannot be undone.')) return;

    try {
      await api.delete('/rv-showcase');
      alert('RV Showcase deleted');
      setShowcase(null);
      setFormData({
        title: '',
        description: '',
        privacy: 'PUBLIC',
        photos: [],
        videoUrl: '',
      });
      if (onSaved) onSaved();
    } catch (error) {
      console.error('Delete showcase error:', error);
      alert('Failed to delete showcase');
    }
  };

  const handleAddPhoto = (url: string) => {
    if (formData.photos.length >= 6) {
      alert('Maximum 6 photos allowed');
      return;
    }
    setFormData({ ...formData, photos: [...formData.photos, url] });
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    setFormData({ ...formData, photos: newPhotos });
  };

  const handleVideoUpload = (url: string) => {
    setFormData({ ...formData, videoUrl: url });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Edit RV Showcase</h2>
        {showcase && (
          <button
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Showcase
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title (Optional)
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="input w-full"
            placeholder="My Dream RV"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="input w-full"
            placeholder="Tell people about your home on wheels..."
          />
        </div>

        {/* Privacy */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Privacy
          </label>
          <select
            value={formData.privacy}
            onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
            className="input w-full"
          >
            <option value="PUBLIC">Public - Anyone can see</option>
            <option value="PRIVATE">Private - Only you can see</option>
          </select>
        </div>

        {/* Video Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Tour (45 seconds max)
          </label>
          {formData.videoUrl ? (
            <div className="relative">
              <video
                src={`${formData.videoUrl}`}
                className="w-full rounded-lg max-h-64"
                controls
              />
              <button
                onClick={() => setFormData({ ...formData, videoUrl: '' })}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <ImageUpload
                onImageUploaded={handleVideoUpload}
                currentImage=""
                label="Upload Video (MP4, max 45 seconds)"
                accept="video/mp4,video/quicktime"
              />
              <p className="text-sm text-gray-500 mt-2 text-center">
                Max file size: 50MB | Duration: 45 seconds
              </p>
            </div>
          )}
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photos ({formData.photos.length}/6)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {formData.photos.map((photo, index) => (
              <div key={index} className="relative aspect-square">
                <img
                  src={`${photo}`}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Add Photo Button */}
            {formData.photos.length < 6 && (
              <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <ImageUpload
                  onImageUploaded={handleAddPhoto}
                  currentImage=""
                  label=""
                  showPreview={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? 'Saving...' : 'Save Showcase'}
          </button>
        </div>
      </div>
    </div>
  );
}
