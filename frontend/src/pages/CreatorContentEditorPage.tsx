// ============================================
// CREATOR CONTENT EDITOR
// Save as: frontend/src/pages/CreatorContentEditorPage.tsx
// ============================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Image,
  Video,
  FileText,
  Link,
  X,
  Plus,
  Search,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ContentFormData {
  contentType: string;
  title: string;
  description: string;
  body: string;
  thumbnailUrl: string;
  videoUrl: string;
  embedUrl: string;
  embedPlatform: string;
  category: string;
  tags: string[];
  campgroundId: string;
  isSponsored: boolean;
  sponsorName: string;
  affiliateLinks: { label: string; url: string }[];
  photos: { imageUrl: string; caption: string }[];
  gearItems: { name: string; description: string; imageUrl: string; affiliateUrl: string }[];
  taggedUserIds: string[];
  collaboratorIds: string[];
  status: string;
  linkedRecipeId: string;
}

const CONTENT_TYPES = [
  { id: 'VIDEO', label: 'Video', icon: Video, description: 'Upload or embed a video' },
  { id: 'SHORT', label: 'Short', icon: Video, description: 'Quick video clip (under 60s)' },
  { id: 'BLOG', label: 'Blog Post', icon: FileText, description: 'Write an article' },
  { id: 'PHOTO_GALLERY', label: 'Photo Gallery', icon: Image, description: 'Share multiple photos' },
  { id: 'EMBED', label: 'External Link', icon: Link, description: 'Share from YouTube, TikTok, etc.' },
];

const CATEGORIES = [
  // Gear & Reviews
  { id: 'GEAR_REVIEWS', label: 'Gear Reviews' },
  { id: 'CAMPGROUND_REVIEWS', label: 'Campground Reviews' },
  
  // Travel & Trips
  { id: 'TRAVEL_DAYS', label: 'Travel Days' },
  { id: 'WEEKEND_TRIPS', label: 'Weekend Trips' },
  { id: 'NATIONAL_PARKS', label: 'National Parks' },
  { id: 'STATE_PARKS', label: 'State Parks' },
  
  // RV Life
  { id: 'FULL_TIME_RV', label: 'Full-Time RV Life' },
  { id: 'FIRST_TIME_RVERS', label: 'First Time RVers' },
  { id: 'SOLO_CAMPING', label: 'Solo Camping' },
  { id: 'WORKAMPING', label: 'Workamping' },
  
  // Cooking & Food
  { id: 'COOKING', label: 'Cooking & Camp Kitchen' },
  { id: 'BBQ_GRILLING', label: 'BBQ & Grilling' },
  { id: 'BLACKSTONE_RECIPES', label: 'Blackstone Recipes' },
  { id: 'SMOKER_RECIPES', label: 'Smoker Recipes' },
  { id: 'CAMPFIRE_COOKING', label: 'Campfire Cooking' },
  { id: 'DUTCH_OVEN_RECIPES', label: 'Dutch Oven Recipes' },
  
  // Activities & Outdoors
  { id: 'HIKING_TRAILS', label: 'Hiking & Trails' },
  { id: 'FISHING', label: 'Fishing' },
  { id: 'KAYAKING_WATER_SPORTS', label: 'Kayaking & Water Sports' },
  { id: 'MOUNTAIN_BIKING', label: 'Mountain Biking' },
  { id: 'STARGAZING', label: 'Stargazing & Astronomy' },
  { id: 'WILDLIFE', label: 'Wildlife & Nature' },
  { id: 'GAMES_ACTIVITIES', label: 'Games & Activities' },
  
  // RV Tech & Maintenance
  { id: 'RV_MAINTENANCE', label: 'RV Maintenance & Repairs' },
  { id: 'RV_MODS', label: 'RV Mods & Upgrades' },
  { id: 'SOLAR_POWER', label: 'Solar & Power Systems' },
  { id: 'TOWING_TIPS', label: 'Towing Tips' },
  { id: 'VINTAGE_RETRO_RVS', label: 'Vintage & Retro RVs' },
  
  // Camping Styles
  { id: 'BOONDOCKING', label: 'Boondocking & Off-Grid' },
  { id: 'LUXURY_CAMPING', label: 'Luxury & Glamping' },
  { id: 'BUDGET_TRAVEL', label: 'Budget Travel' },
  
  // Family & Community
  { id: 'FAMILY_CAMPING', label: 'Family & Kids Camping' },
  { id: 'PET_FRIENDLY', label: 'Pet-Friendly Camping' },
  { id: 'GROUP_RALLY_EVENTS', label: 'Group & Rally Events' },
  
  // Entertainment & Stories
  { id: 'SCARY_STORIES', label: 'Scary Stories & Campfire Tales' },
  { id: 'MUSIC_ENTERTAINMENT', label: 'Music & Entertainment' },
  { id: 'HISTORY_LOCAL_CULTURE', label: 'History & Local Culture' },
  
  // Tips & Safety
  { id: 'TIPS_HACKS', label: 'Tips & Hacks' },
  { id: 'SAFETY_SECURITY', label: 'Safety & Security' },
  { id: 'WEATHER_STORMS', label: 'Weather & Storms' },
  
  // Media
  { id: 'PHOTOGRAPHY', label: 'Photography & Videography' },
  { id: 'SEASONAL', label: 'Seasonal & Holiday' },
];

// Cooking-related categories for recipe linking
const COOKING_CATEGORIES = [
  'COOKING',
  'BBQ_GRILLING', 
  'BLACKSTONE_RECIPES',
  'SMOKER_RECIPES',
  'CAMPFIRE_COOKING',
  'DUTCH_OVEN_RECIPES',
];

const EMBED_PLATFORMS = [
  { id: 'YOUTUBE', label: 'YouTube', pattern: /youtube\.com|youtu\.be/ },
  { id: 'TIKTOK', label: 'TikTok', pattern: /tiktok\.com/ },
  { id: 'INSTAGRAM', label: 'Instagram', pattern: /instagram\.com/ },
];

export default function CreatorContentEditorPage() {
  const { contentId } = useParams<{ contentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEditing = !!contentId;

  const [step, setStep] = useState(isEditing ? 2 : 1);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [campgroundSearch, setCampgroundSearch] = useState('');
  const [campgroundResults, setCampgroundResults] = useState<any[]>([]);
  const [selectedCampground, setSelectedCampground] = useState<any>(null);
  
  // Recipe linking state
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeResults, setRecipeResults] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);

  const [formData, setFormData] = useState<ContentFormData>({
    contentType: '',
    title: '',
    description: '',
    body: '',
    thumbnailUrl: '',
    videoUrl: '',
    embedUrl: '',
    embedPlatform: '',
    category: '',
    tags: [],
    campgroundId: '',
    isSponsored: false,
    sponsorName: '',
    affiliateLinks: [],
    photos: [],
    gearItems: [],
    taggedUserIds: [],
    collaboratorIds: [],
    status: 'DRAFT',
    linkedRecipeId: '',
  });

  useEffect(() => {
    if (isEditing) {
      fetchContent();
    }
  }, [contentId]);

  const fetchContent = async () => {
    try {
      const response = await api.get(`/creators/content/${user?.id}/${contentId}`);
      const content = response.data;
      setFormData({
        contentType: content.contentType,
        title: content.title || '',
        description: content.description || '',
        body: content.body || '',
        thumbnailUrl: content.thumbnailUrl || '',
        videoUrl: content.videoUrl || '',
        embedUrl: content.embedUrl || '',
        embedPlatform: content.embedPlatform || '',
        category: content.category || '',
        tags: content.tags || [],
        campgroundId: content.campgroundId || '',
        isSponsored: content.isSponsored,
        sponsorName: content.sponsorName || '',
        affiliateLinks: content.affiliateLinks || [],
        photos: content.photos || [],
        gearItems: content.gearItems || [],
        taggedUserIds: content.taggedUsers?.map((t: any) => t.userId) || [],
        collaboratorIds: content.collaborators?.map((c: any) => c.collaboratorId) || [],
        status: content.status,
      });
      if (content.campground) {
        setSelectedCampground(content.campground);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCampgroundSearch = async (query: string) => {
    setCampgroundSearch(query);
    if (query.length < 2) {
      setCampgroundResults([]);
      return;
    }
    try {
      const response = await api.get(`/campgrounds?search=${encodeURIComponent(query)}&limit=5`);
      setCampgroundResults(response.data.campgrounds);    
    } catch (error) {
      console.error('Error searching campgrounds:', error);
    }
  };

  const selectCampground = (campground: any) => {
    setSelectedCampground(campground);
    setFormData({ ...formData, campgroundId: campground.id });
    setCampgroundResults([]);
    setCampgroundSearch('');
  };

  // Recipe search and selection
  const handleRecipeSearch = async (query: string) => {
    setRecipeSearch(query);
    if (query.length < 2) {
      setRecipeResults([]);
      return;
    }
    try {
      const response = await api.get("/recipes?search=" + encodeURIComponent(query) + "&limit=5");
      setRecipeResults(response.data.recipes || response.data || []);
    } catch (error) {
      console.error('Error searching recipes:', error);
    }
  };

  const selectRecipe = (recipe: any) => {
    setSelectedRecipe(recipe);
    setFormData({ ...formData, linkedRecipeId: recipe.id });
    setRecipeResults([]);
    setRecipeSearch('');
  };

  // Check if category is cooking-related
  const isCookingCategory = COOKING_CATEGORIES.includes(formData.category);

  const handleEmbedUrl = (url: string) => {
    setFormData(prev => ({ ...prev, embedUrl: url }));
    // Auto-detect platform
    for (const platform of EMBED_PLATFORMS) {
      if (platform.pattern.test(url)) {
        setFormData(prev => ({ ...prev, embedPlatform: platform.id }));
        break;
      }
    }
  };

  // Extract YouTube video ID and auto-set thumbnail
  const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/,
      /youtube\.com\/shorts\/([^&?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleVideoUrl = (url: string) => {
    const videoId = getYouTubeVideoId(url);
    
    setFormData(prev => {
      const updates: any = { videoUrl: url };
      
      // Auto-extract YouTube thumbnail if no thumbnail is set
      if (videoId && !prev.thumbnailUrl) {
        updates.thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
      
      return { ...prev, ...updates };
    });
  };

  const addPhoto = () => {
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, { imageUrl: '', caption: '' }],
    }));
  };

  const updatePhoto = (index: number, field: 'imageUrl' | 'caption', value: string) => {
    const updated = [...formData.photos];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, photos: updated });
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const addGearItem = () => {
    setFormData(prev => ({
      ...prev,
      gearItems: [...prev.gearItems, { name: '', description: '', imageUrl: '', affiliateUrl: '' }],
    }));
  };

  const updateGearItem = (index: number, field: string, value: string) => {
    const updated = [...formData.gearItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, gearItems: updated });
  };

  const removeGearItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      gearItems: prev.gearItems.filter((_, i) => i !== index),
    }));
  };

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleSubmit = async (publishNow: boolean) => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        status: publishNow ? 'PUBLISHED' : 'DRAFT',
        taggedUsers: formData.taggedUserIds.map(id => ({ id })),
      };

      if (isEditing) {
        await api.put(`/creators/content/${contentId}`, payload);
      } else {
        await api.post('/creators/content', payload);
      }

      navigate('/creator/dashboard');
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Failed to save content');
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Content' : 'Create Content'}
            </h1>
            <button
              onClick={() => navigate('/creator/dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Step Indicator */}
          {!isEditing && (
            <div className="mt-4 flex items-center gap-4">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200'
                }`}>1</span>
                <span className="text-sm font-medium">Content Type</span>
              </div>
              <div className="flex-grow h-0.5 bg-gray-200" />
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200'
                }`}>2</span>
                <span className="text-sm font-medium">Details</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Step 1: Content Type Selection */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">What type of content are you creating?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setFormData({ ...formData, contentType: type.id });
                    setStep(2);
                  }}
                  className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
                >
                  <type.icon className="w-8 h-8 text-primary-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-gray-900">{type.label}</h3>
                    <p className="text-sm text-gray-500">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Content Details */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Give your content a title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Brief description of your content"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                  <input
                    type="url"
                    value={formData.thumbnailUrl}
                    onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Content-Type Specific Fields */}
            {(formData.contentType === 'VIDEO' || formData.contentType === 'SHORT') && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Video</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => handleVideoUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}

            {formData.contentType === 'EMBED' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">External Link</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Embed URL</label>
                    <input
                      type="url"
                      value={formData.embedUrl}
                      onChange={(e) => handleEmbedUrl(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Paste YouTube, TikTok, or Instagram URL"
                    />
                  </div>
                  {formData.embedPlatform && (
                    <p className="text-sm text-green-600">
                      ✓ Detected: {EMBED_PLATFORMS.find(p => p.id === formData.embedPlatform)?.label}
                    </p>
                  )}
                </div>
              </div>
            )}

            {formData.contentType === 'BLOG' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Blog Content</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content (Markdown supported)</label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    rows={15}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                    placeholder="Write your blog post here..."
                  />
                </div>
              </div>
            )}

            {formData.contentType === 'PHOTO_GALLERY' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
                <div className="space-y-4">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-grow space-y-2">
                        <input
                          type="url"
                          value={photo.imageUrl}
                          onChange={(e) => updatePhoto(index, 'imageUrl', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Image URL"
                        />
                        <input
                          type="text"
                          value={photo.caption}
                          onChange={(e) => updatePhoto(index, 'caption', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Caption (optional)"
                        />
                      </div>
                      <button
                        onClick={() => removePhoto(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addPhoto}
                    className="flex items-center gap-2 px-4 py-2 text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50"
                  >
                    <Plus className="w-5 h-5" />
                    Add Photo
                  </button>
                </div>
              </div>
            )}

            {/* Campground Attachment */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Link to Campground</h2>
              
              {selectedCampground ? (
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{selectedCampground.name}</p>
                    <p className="text-sm text-gray-500">{selectedCampground.state}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCampground(null);
                      setFormData({ ...formData, campgroundId: '' });
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={campgroundSearch}
                    onChange={(e) => handleCampgroundSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Search campgrounds..."
                  />
                  {campgroundResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
                      {campgroundResults.map((cg) => (
                        <button
                          key={cg.id}
                          onClick={() => selectCampground(cg)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-0"
                        >
                          <p className="font-medium text-gray-900">{cg.name}</p>
                          <p className="text-sm text-gray-500">{cg.location || cg.state}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recipe Linking - Only show for cooking categories */}
            {isCookingCategory && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Link to Recipe</h2>
                <p className="text-sm text-gray-500 mb-4">Connect this content to a recipe from your recipe collection</p>
                
                {selectedRecipe ? (
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{selectedRecipe.title}</p>
                      <p className="text-sm text-gray-500">{selectedRecipe.category}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRecipe(null);
                        setFormData({ ...formData, linkedRecipeId: '' });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={recipeSearch}
                      onChange={(e) => handleRecipeSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Search recipes..."
                    />
                    {recipeResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
                        {recipeResults.map((recipe) => (
                          <button
                            key={recipe.id}
                            onClick={() => selectRecipe(recipe)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-0"
                          >
                            <p className="font-medium text-gray-900">{recipe.title}</p>
                            <p className="text-sm text-gray-500">{recipe.category}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tags</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-primary-900">
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Type a tag and press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag((e.target as HTMLInputElement).value.trim());
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>

            {/* Sponsored Content */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Sponsored Content</h2>
                  <p className="text-sm text-gray-500">Mark if this content is sponsored or contains affiliate links</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isSponsored}
                    onChange={(e) => setFormData({ ...formData, isSponsored: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              {formData.isSponsored && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor Name</label>
                  <input
                    type="text"
                    value={formData.sponsorName}
                    onChange={(e) => setFormData({ ...formData, sponsorName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Brand or company name"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6">
              {!isEditing && (
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 text-gray-700 hover:text-gray-900"
                >
                  ← Back
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={saving}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={saving || !formData.title}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
