import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Bell } from 'lucide-react';
import api from '../services/api';
import CampgroundSelector from '../components/CampgroundSelector';
import ImageUpload from '../components/ImageUpload';

export default function EventEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifyAttendees, setNotifyAttendees] = useState(true);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    imageUrl: '',
    campgroundId: null as string | null,
  });

  useEffect(() => {
    loadEvent();
  }, [id]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/events/${id}`);
      
      const startDate = new Date(data.startDate).toISOString().split('T')[0];
      const endDate = data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : startDate;
      
      setFormData({
        title: data.title,
        description: data.description || '',
        startDate,
        endDate,
        location: data.location || '',
        imageUrl: data.imageUrl || '',
        campgroundId: data.campgroundId || null,
      });
    } catch (error) {
      console.error('Load event error:', error);
      alert('Failed to load event');
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const handleCampgroundSelect = (campgroundId: string | null, campgroundName: string, location: string) => {
    setFormData({
      ...formData,
      campgroundId,
      location: campgroundId ? `${campgroundName}, ${location}` : formData.location,
    });
  };

  const handleManualLocationChange = (location: string) => {
    setFormData({
      ...formData,
      location,
      campgroundId: null,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.startDate) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      
      await api.put(`/events/${id}`, {
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        location: formData.location,
        campgroundId: formData.campgroundId,
        imageUrl: formData.imageUrl,
        notifyAttendees,
      });

      if (notifyAttendees) {
        alert('✅ Event updated! All attendees have been notified of the changes.');
      } else {
        alert('✅ Event updated successfully!');
      }
      
      navigate(`/events/${id}`);
    } catch (error) {
      console.error('Update event error:', error);
      alert('Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/events/${id}`)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Event
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Edit Event</h1>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="input w-full"
            placeholder="Summer Camping Trip"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="input w-full"
            placeholder="Tell attendees about this event..."
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date *
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date *
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
              className="input w-full"
            />
          </div>
        </div>

        {/* Campground Selector */}
        <CampgroundSelector
          selectedCampgroundId={formData.campgroundId}
          manualLocation={formData.campgroundId ? '' : formData.location}
          onCampgroundSelect={handleCampgroundSelect}
          onManualLocationChange={handleManualLocationChange}
        />

        {/* Image Upload */}
        <ImageUpload
          onImageUploaded={(url) => setFormData({ ...formData, imageUrl: url })}
          currentImage={formData.imageUrl}
          label="Cover Image"
        />

        {/* Notify Attendees */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyAttendees}
              onChange={(e) => setNotifyAttendees(e.target.checked)}
              className="w-5 h-5 rounded text-primary-600"
            />
            <Bell className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              Notify all attendees about these changes
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/events/${id}`)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
