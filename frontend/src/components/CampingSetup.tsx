import { useState, useEffect } from 'react';
import { Tent, Upload, X, Trash2, Video, Edit, Save, Truck, Ruler, Users, Weight, Image as ImageIcon, Play } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface CampingSetupProps {
  username: string;
  isOwnProfile: boolean;
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  rvType?: string;
  rvMake?: string;
  rvModel?: string;
  rvYear?: number;
  rvLength?: number;
  rvSlideouts?: number;
  rvSleeps?: number;
  rvWeight?: number;
  rvFeatures?: string[];
  rvDescription?: string;
  rvImages?: string[];
  setupVideo?: string;
}

const RV_TYPES = [
  { value: 'CLASS_A', label: 'Class A Motorhome' },
  { value: 'CLASS_B', label: 'Class B Motorhome (Van)' },
  { value: 'CLASS_C', label: 'Class C Motorhome' },
  { value: 'FIFTH_WHEEL', label: 'Fifth Wheel' },
  { value: 'TRAVEL_TRAILER', label: 'Travel Trailer' },
  { value: 'TOY_HAULER', label: 'Toy Hauler' },
  { value: 'POP_UP', label: 'Pop-up Camper' },
  { value: 'TRUCK_CAMPER', label: 'Truck Camper' },
  { value: 'TENT_TRAILER', label: 'Tent Trailer' },
  { value: 'TEARDROP', label: 'Teardrop Trailer' },
];

const COMMON_FEATURES = [
  'Air Conditioning',
  'Heating',
  'Full Kitchen',
  'Microwave',
  'Refrigerator',
  'Freezer',
  'Oven',
  'Stove',
  'Full Bathroom',
  'Shower',
  'Toilet',
  'Outdoor Shower',
  'Generator',
  'Solar Panels',
  'Inverter',
  'Awning',
  'Slide-outs',
  'Leveling Jacks',
  'Queen Bed',
  'King Bed',
  'Bunk Beds',
  'Sofa Bed',
  'Dinette Conversion',
  'TV',
  'DVD Player',
  'Sound System',
  'WiFi Booster',
  'Cell Booster',
  'Backup Camera',
  'Washer/Dryer',
  'Fireplace',
  'Central Vacuum',
  'Satellite Dish',
  'Water Heater',
  'Propane',
  'Black Tank',
  'Gray Tank',
  'Fresh Water Tank',
];

export default function CampingSetup({ username, isOwnProfile }: CampingSetupProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [rvData, setRvData] = useState({
    rvType: '',
    rvMake: '',
    rvModel: '',
    rvYear: '',
    rvLength: '',
    rvSlideouts: '',
    rvSleeps: '',
    rvWeight: '',
    rvFeatures: [] as string[],
    rvDescription: '',
  });

  const [rvImages, setRvImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [rvVideo, setRvVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/profile/${username}`);
      setProfile(data);
      
      // Populate RV data
      setRvData({
        rvType: data.rvType || '',
        rvMake: data.rvMake || '',
        rvModel: data.rvModel || '',
        rvYear: data.rvYear?.toString() || '',
        rvLength: data.rvLength?.toString() || '',
        rvSlideouts: data.rvSlideouts?.toString() || '',
        rvSleeps: data.rvSleeps?.toString() || '',
        rvWeight: data.rvWeight?.toString() || '',
        rvFeatures: data.rvFeatures || [],
        rvDescription: data.rvDescription || '',
      });

      // Set existing images
      setExistingImages(data.rvImages || []);
      
      // Set video preview
      if (data.setupVideo) {
        setVideoPreview(data.setupVideo);
      }
    } catch (error) {
      console.error('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureToggle = (feature: string) => {
    setRvData(prev => ({
      ...prev,
      rvFeatures: prev.rvFeatures.includes(feature)
        ? prev.rvFeatures.filter(f => f !== feature)
        : [...prev.rvFeatures, feature]
    }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = existingImages.length + rvImages.length + files.length;

    if (totalImages > 6) {
      alert('Maximum 6 RV images allowed');
      return;
    }

    setRvImages(prev => [...prev, ...files]);

    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a video
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    // Check file size (500MB max on backend, but let's warn at 200MB)
    if (file.size > 200 * 1024 * 1024) {
      alert('Video file is very large. Please keep videos under 200MB for best results.');
    }

    // Validate video duration (3 minutes max = 180 seconds)
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      if (video.duration > 180) {
        alert('Video must be 3 minutes or less. Your video is ' + Math.round(video.duration / 60) + ' minutes long.');
        return;
      }
      
      setRvVideo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setVideoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    };
    video.src = URL.createObjectURL(file);
  };

  const removeNewImage = (index: number) => {
    setRvImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setRvVideo(null);
    setVideoPreview('');
  };

  const handleSave = async () => {
    try {
      const formData = new FormData();
      
      // Add text fields
      if (rvData.rvType) formData.append('rvType', rvData.rvType);
      if (rvData.rvMake) formData.append('rvMake', rvData.rvMake);
      if (rvData.rvModel) formData.append('rvModel', rvData.rvModel);
      if (rvData.rvYear) formData.append('rvYear', rvData.rvYear);
      if (rvData.rvLength) formData.append('rvLength', rvData.rvLength);
      if (rvData.rvSlideouts) formData.append('rvSlideouts', rvData.rvSlideouts);
      if (rvData.rvSleeps) formData.append('rvSleeps', rvData.rvSleeps);
      if (rvData.rvWeight) formData.append('rvWeight', rvData.rvWeight);
      if (rvData.rvDescription) formData.append('rvDescription', rvData.rvDescription);
      if (rvData.rvFeatures.length > 0) {
        formData.append('rvFeatures', JSON.stringify(rvData.rvFeatures));
      }

      // Add existing images
      if (existingImages.length > 0) {
        formData.append('existingRvImages', JSON.stringify(existingImages));
      }

      // Add new images
      rvImages.forEach(image => {
        formData.append('rvImages', image);
      });

      // Add video
      if (rvVideo) {
        formData.append('rvVideo', rvVideo);
      }

      await api.put('/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setEditing(false);
      setRvImages([]);
      setImagePreviews([]);
      setRvVideo(null);
      await loadProfile();
      alert('RV details saved successfully! 🚐');
    } catch (error) {
      console.error('Save RV details error:', error);
      alert('Failed to save RV details');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading camping setup...</p>
      </div>
    );
  }

  const hasRvDetails = profile?.rvType || profile?.rvMake || profile?.rvModel;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-6 h-6" />
          My RV Details
        </h3>
        {isOwnProfile && (
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            {editing ? (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            ) : (
              <>
                <Edit className="w-4 h-4" />
                Edit Setup
              </>
            )}
          </button>
        )}
      </div>

      {/* View Mode */}
      {!editing && (
        <>
          {!hasRvDetails ? (
            <div className="text-center py-12">
              <Tent className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No RV details yet</p>
              {isOwnProfile && (
                <p className="text-gray-500 text-sm mb-4">
                  Add your RV details to share with the community!
                </p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
              {/* RV Images Gallery */}
              {profile.rvImages && profile.rvImages.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    RV Photos
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {profile.rvImages.map((image, index) => (
                      <div key={index} className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={`${image}`}
                          alt={`RV ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RV Video Tour */}
              {profile.setupVideo && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    RV Tour Video
                  </h3>
                  <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      controls
                      className="w-full h-full"
                      src={`${profile.setupVideo}`}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              )}

              {/* RV Header */}
              <div className="border-b pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {profile.rvYear && `${profile.rvYear} `}
                      {profile.rvMake && `${profile.rvMake} `}
                      {profile.rvModel}
                    </h2>
                    {profile.rvType && (
                      <p className="text-gray-600 mt-1">
                        {RV_TYPES.find(t => t.value === profile.rvType)?.label}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* RV Specs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {profile.rvLength && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Ruler className="w-6 h-6 text-primary-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{profile.rvLength}'</p>
                    <p className="text-sm text-gray-600">Length</p>
                  </div>
                )}
                {profile.rvSleeps && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Users className="w-6 h-6 text-primary-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{profile.rvSleeps}</p>
                    <p className="text-sm text-gray-600">Sleeps</p>
                  </div>
                )}
                {profile.rvSlideouts !== undefined && profile.rvSlideouts !== null && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Tent className="w-6 h-6 text-primary-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{profile.rvSlideouts}</p>
                    <p className="text-sm text-gray-600">Slide-outs</p>
                  </div>
                )}
                {profile.rvWeight && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Weight className="w-6 h-6 text-primary-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{profile.rvWeight.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">lbs</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {profile.rvDescription && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{profile.rvDescription}</p>
                </div>
              )}

              {/* Features */}
              {profile.rvFeatures && profile.rvFeatures.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Features & Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.rvFeatures.map((feature) => (
                      <span
                        key={feature}
                        className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Mode */}
      {editing && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              RV Photos (Max 6)
            </label>
            
            {/* Existing Images */}
            {existingImages.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Current Photos:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {existingImages.map((image, index) => (
                    <div key={index} className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={`${image}`}
                        alt={`RV ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeExistingImage(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">New Photos:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={preview}
                        alt={`New RV ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeNewImage(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(existingImages.length + rvImages.length) < 6 && (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> RV photos
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {existingImages.length + rvImages.length}/6 photos
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Video Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Video className="w-5 h-5" />
              RV Tour Video (Max 3 minutes)
            </label>
            
            {videoPreview ? (
              <div className="relative">
                <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden mb-2">
                  <video
                    controls
                    className="w-full h-full"
                    src={videoPreview}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                <button
                  onClick={removeVideo}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Video
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Play className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> RV tour video
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    MP4, MOV, AVI (max 3 minutes)
                  </p>
                </div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="space-y-4 border-t pt-6">
            {/* RV Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RV Type
              </label>
              <select
                value={rvData.rvType}
                onChange={(e) => setRvData({ ...rvData, rvType: e.target.value })}
                className="input"
              >
                <option value="">Select RV type...</option>
                {RV_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Make, Model, Year */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  value={rvData.rvMake}
                  onChange={(e) => setRvData({ ...rvData, rvMake: e.target.value })}
                  placeholder="e.g., Winnebago"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={rvData.rvModel}
                  onChange={(e) => setRvData({ ...rvData, rvModel: e.target.value })}
                  placeholder="e.g., View"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={rvData.rvYear}
                  onChange={(e) => setRvData({ ...rvData, rvYear: e.target.value })}
                  placeholder="2024"
                  className="input"
                  min="1950"
                  max={new Date().getFullYear() + 1}
                />
              </div>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Length (feet)
                </label>
                <input
                  type="number"
                  value={rvData.rvLength}
                  onChange={(e) => setRvData({ ...rvData, rvLength: e.target.value })}
                  placeholder="32"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sleeps
                </label>
                <input
                  type="number"
                  value={rvData.rvSleeps}
                  onChange={(e) => setRvData({ ...rvData, rvSleeps: e.target.value })}
                  placeholder="4"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slide-outs
                </label>
                <input
                  type="number"
                  value={rvData.rvSlideouts}
                  onChange={(e) => setRvData({ ...rvData, rvSlideouts: e.target.value })}
                  placeholder="2"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  value={rvData.rvWeight}
                  onChange={(e) => setRvData({ ...rvData, rvWeight: e.target.value })}
                  placeholder="8500"
                  className="input"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={rvData.rvDescription}
                onChange={(e) => setRvData({ ...rvData, rvDescription: e.target.value })}
                rows={4}
                placeholder="Tell us about your RV..."
                className="input"
              />
            </div>

            {/* Features */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Features & Amenities
              </label>
              <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {COMMON_FEATURES.map((feature) => (
                    <label key={feature} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rvData.rvFeatures.includes(feature)}
                        onChange={() => handleFeatureToggle(feature)}
                        className="text-primary-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Selected: {rvData.rvFeatures.length} features
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              className="btn btn-primary flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              Save RV Details
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setRvImages([]);
                setImagePreviews([]);
                setRvVideo(null);
                loadProfile();
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
