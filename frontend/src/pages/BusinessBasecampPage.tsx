import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Megaphone, Calendar, Camera, Star, Award,
  BarChart3, Palette, Settings, Users, Eye, Heart, MapPin,
  ChevronLeft, Check, X, Clock, Bell, Shield, Plus, Trash2, Send, Image
} from 'lucide-react';
import api from '../services/api';

interface DashboardData {
  campground: any;
  stats: {
    followers: number;
    reviews: number;
    avgRating: number;
    photos: number;
    checkIns: number;
    threads: number;
    events: number;
    stickers: number;
  };
  recentActivity: { reviews: any[] };
  pendingItems: { photos: any[] };
  admins: any[];
}

const TIER_LABELS: Record<string, { name: string; color: string; icon: string }> = {
  FREE: { name: 'Basic', color: 'bg-gray-500', icon: '🏕️' },
  CLASS_C: { name: 'Class C', color: 'bg-blue-500', icon: '🚐' },
  CLASS_B: { name: 'Class B', color: 'bg-purple-500', icon: '🚐' },
  CLASS_A: { name: 'Class A', color: 'bg-amber-500', icon: '🚌' },
};

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, tier: 'FREE' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, tier: 'FREE' },
  { id: 'events', label: 'Events', icon: Calendar, tier: 'FREE' },
  { id: 'photos', label: 'Photos', icon: Camera, tier: 'FREE' },
  { id: 'reviews', label: 'Reviews', icon: Star, tier: 'FREE' },
  { id: 'checkins', label: 'Check-ins', icon: Users, tier: 'FREE' },
  { id: 'threads', label: 'Threads', icon: MessageSquare, tier: 'FREE' },
  { id: 'stickers', label: 'Stickers', icon: Award, tier: 'CLASS_B' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, tier: 'CLASS_A' },
  { id: 'branding', label: 'Branding', icon: Palette, tier: 'CLASS_B' },
  { id: 'settings', label: 'Settings', icon: Settings, tier: 'FREE' },
];

const tierLevel = (tier: string): number => {
  const levels: Record<string, number> = { FREE: 0, CLASS_C: 1, CLASS_B: 2, CLASS_A: 3 };
  return levels[tier] || 0;
};

export default function BusinessBasecampPage() {
  const { campgroundId } = useParams<{ campgroundId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tab-specific data
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);

  // Forms
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', isPinned: false, priority: 'NORMAL' as const, scheduledAt: '' });
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', description: '', startDate: '', endDate: '', location: '' });

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    businessEmail: '', businessPhone: '', bookingUrl: '', websiteUrl: '', description: '',
    hashtag: '', facebookUrl: '', instagramUrl: '', twitterUrl: '', youtubeUrl: '', tiktokUrl: '',
    theme: 'classic', accentColor: '#16a34a'
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [campgroundId]);

  useEffect(() => {
    if (data) {
      loadTabData();
    }
  }, [activeTab, data]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const { data: dashData } = await api.get(`/business/${campgroundId}/dashboard`);
      setData(dashData);
      setSettingsForm({
        businessEmail: dashData.campground.businessEmail || '',
        businessPhone: dashData.campground.businessPhone || '',
        bookingUrl: dashData.campground.bookingUrl || '',
        websiteUrl: dashData.campground.websiteUrl || '',
        description: dashData.campground.description || '',
        hashtag: dashData.campground.hashtag || '',
        facebookUrl: dashData.campground.facebookUrl || '',
        instagramUrl: dashData.campground.instagramUrl || '',
        twitterUrl: dashData.campground.twitterUrl || '',
        youtubeUrl: dashData.campground.youtubeUrl || '',
        tiktokUrl: dashData.campground.tiktokUrl || '',
        theme: dashData.campground.theme || 'classic',
        accentColor: dashData.campground.accentColor || '#16a34a'
      });
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    if (!campgroundId) return;
    try {
      switch (activeTab) {
        case 'announcements':
          const annRes = await api.get(`/campground-features/${campgroundId}/announcements`);
          setAnnouncements(annRes.data || []);
          break;
        case 'events':
          const evtRes = await api.get(`/campground-features/${campgroundId}/events`);
          setEvents(evtRes.data || []);
          break;
        case 'photos':
          const photoRes = await api.get(`/campground-features/${campgroundId}/photos`);
          setPhotos(photoRes.data || []);
          try {
            const pendingRes = await api.get(`/campground-features/${campgroundId}/photos/pending`);
            setPendingPhotos(pendingRes.data || []);
          } catch { setPendingPhotos([]); }
          break;
        case 'reviews':
          const revRes = await api.get(`/campground-features/${campgroundId}/reviews`);
          setReviews(revRes.data || []);
          break;
        case 'checkins':
          const ciRes = await api.get(`/campgrounds/${campgroundId}`);
          setCheckIns(ciRes.data.checkIns || []);
          break;
      }
    } catch (err) {
      console.error('Load tab data error:', err);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.content) return;
    try {
      await api.post(`/campground-features/${campgroundId}/announcements`, announcementForm);
      setShowAnnouncementForm(false);
      setAnnouncementForm({ title: '', content: '', isPinned: false });
      loadTabData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create announcement');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/campground-features/${campgroundId}/announcements/${id}`);
      loadTabData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.startDate) return;
    try {
      await api.post(`/campground-features/${campgroundId}/events`, eventForm);
      setShowEventForm(false);
      setEventForm({ title: '', description: '', startDate: '', endDate: '', location: '' });
      loadTabData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create event');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await api.delete(`/campground-features/${campgroundId}/events/${id}`);
      loadTabData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleReviewPhoto = async (photoId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.put(`/campground-features/${campgroundId}/photos/${photoId}/review`, { status });
      loadTabData();
      loadDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to review photo');
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", photoFile);
      if (photoCaption) formData.append("caption", photoCaption);
      await api.post(`/campground-features/${campgroundId}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setPhotoFile(null);
      setPhotoCaption("");
      loadTabData();
      loadDashboard();
      alert("✅ Photo uploaded!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;
    try {
      await api.delete(`/campground-features/${campgroundId}/photos/${photoId}`);
      loadTabData();
      loadDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete photo");
    }
  };

  const handleSetBanner = async (photoId: string) => {
    try {
      await api.put(`/campground-features/${campgroundId}/photos/${photoId}/set-banner`);
      loadDashboard();
      alert("✅ Banner updated!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to set banner");
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put(`/business/${campgroundId}/settings`, settingsForm);
      alert('✅ Settings saved!');
      loadDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading business dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">{error || 'You do not have access to this dashboard.'}</p>
          <button onClick={() => navigate('/campgrounds')} className="btn btn-primary">Back to Campgrounds</button>
        </div>
      </div>
    );
  }

  const { campground, stats, recentActivity, pendingItems, admins } = data;
  const tier = campground.tier || 'FREE';
  const tierInfo = TIER_LABELS[tier];
  const canAccess = (requiredTier: string) => tierLevel(tier) >= tierLevel(requiredTier);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/campgrounds/${campgroundId}`)} className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{campground.name}</h1>
              <p className="text-sm text-gray-500">{campground.location}, {campground.state}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`${tierInfo.color} text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1`}>
              {tierInfo.icon} {tierInfo.name}
            </span>
            <Link to="/basecamp" className="text-sm text-primary-600 hover:text-primary-700">← Personal Basecamp</Link>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r min-h-[calc(100vh-60px)] p-4">
          <nav className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const accessible = canAccess(item.tier);
              return (
                <button
                  key={item.id}
                  onClick={() => accessible && setActiveTab(item.id)}
                  disabled={!accessible}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                    activeTab === item.id ? 'bg-primary-50 text-primary-700 font-medium' :
                    accessible ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {!accessible && <span className="ml-auto text-xs">🔒</span>}
                </button>
              );
            })}
          </nav>

          {tier === 'FREE' && (
            <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-100">
              <p className="text-sm font-medium text-gray-900 mb-2">Upgrade Your Listing</p>
              <p className="text-xs text-gray-600 mb-3">Unlock stickers, analytics & branding.</p>
              <button className="w-full btn btn-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white">View Plans</button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg"><Eye className="w-5 h-5 text-blue-600" /></div>
                    <div><p className="text-2xl font-bold text-gray-900">{stats.followers}</p><p className="text-sm text-gray-500">Followers</p></div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg"><Heart className="w-5 h-5 text-red-600" /></div>
                    <div><p className="text-2xl font-bold text-gray-900">{stats.checkIns}</p><p className="text-sm text-gray-500">Check-ins</p></div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg"><Star className="w-5 h-5 text-amber-600" /></div>
                    <div><p className="text-2xl font-bold text-gray-900">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}</p><p className="text-sm text-gray-500">Rating ({stats.reviews})</p></div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg"><Camera className="w-5 h-5 text-green-600" /></div>
                    <div><p className="text-2xl font-bold text-gray-900">{stats.photos}</p><p className="text-sm text-gray-500">Photos</p></div>
                  </div>
                </div>
              </div>

              {/* Needs Attention & Recent Reviews */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b"><h3 className="font-bold text-gray-900 flex items-center gap-2"><Bell className="w-5 h-5 text-amber-500" /> Needs Attention</h3></div>
                  <div className="p-4">
                    {pendingItems.photos.length > 0 ? (
                      <div className="space-y-3">
                        {pendingItems.photos.slice(0, 5).map((photo: any) => (
                          <div key={photo.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <img src={`http://127.0.0.1:3001${photo.imageUrl}`} className="w-12 h-12 rounded object-cover" />
                              <div>
                                <p className="text-sm font-medium">Photo from {photo.user.firstName}</p>
                                <p className="text-xs text-gray-500">Pending approval</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleReviewPhoto(photo.id, 'APPROVED')} className="p-1 bg-green-500 text-white rounded hover:bg-green-600"><Check className="w-4 h-4" /></button>
                              <button onClick={() => handleReviewPhoto(photo.id, 'REJECTED')} className="p-1 bg-red-500 text-white rounded hover:bg-red-600"><X className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ))}
                        {pendingItems.photos.length > 5 && <button onClick={() => setActiveTab('photos')} className="text-sm text-primary-600">View all {pendingItems.photos.length} pending...</button>}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">✅ All caught up!</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b"><h3 className="font-bold text-gray-900 flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> Recent Reviews</h3></div>
                  <div className="p-4">
                    {recentActivity.reviews.length > 0 ? (
                      <div className="space-y-3">
                        {recentActivity.reviews.slice(0, 5).map((review: any) => (
                          <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium">{review.user.firstName} {review.user.lastName}</p>
                              <span className="text-amber-500">{'🔥'.repeat(review.rating)}</span>
                            </div>
                            {review.review && <p className="text-sm text-gray-600 line-clamp-2">{review.review}</p>}
                          </div>
                        ))}
                        {recentActivity.reviews.length > 5 && <button onClick={() => setActiveTab('reviews')} className="text-sm text-primary-600">View all reviews...</button>}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No reviews yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Team */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-primary-500" /> Team</h3>
                  {tier === 'CLASS_A' && <button className="btn btn-sm btn-primary">+ Add Admin</button>}
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {admins.map((admin: any) => (
                      <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {admin.user.profilePicture ? (
                            <img src={`http://127.0.0.1:3001${admin.user.profilePicture}`} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-primary-600 font-medium">{admin.user.firstName[0]}</span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{admin.user.firstName} {admin.user.lastName}</p>
                            <p className="text-xs text-gray-500">{admin.user.email}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          admin.role === 'OWNER' ? 'bg-amber-100 text-amber-700' :
                          admin.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>{admin.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ANNOUNCEMENTS TAB */}
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
                <button onClick={() => setShowAnnouncementForm(true)} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Announcement</button>
              </div>

              {showAnnouncementForm && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Create Announcement</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                      <input type="text" value={announcementForm.title} onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })} className="input w-full" placeholder="Announcement title" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                      <textarea value={announcementForm.content} onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })} className="input w-full" rows={4} placeholder="Write your announcement..." />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="isPinned" checked={announcementForm.isPinned} onChange={e => setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })} />
                      <label htmlFor="isPinned" className="text-sm text-gray-700">📌 Pin this announcement</label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select value={announcementForm.priority} onChange={e => setAnnouncementForm({ ...announcementForm, priority: e.target.value as any })} className="input w-full">
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="IMPORTANT">⚠️ Important</option>
                        <option value="URGENT">🚨 Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
                      <input type="datetime-local" value={announcementForm.scheduledAt} onChange={e => setAnnouncementForm({ ...announcementForm, scheduledAt: e.target.value })} className="input w-full" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setShowAnnouncementForm(false)} className="btn btn-secondary">Cancel</button>
                      <button onClick={handleCreateAnnouncement} disabled={!announcementForm.title || !announcementForm.content} className="btn btn-primary disabled:opacity-50">Post Announcement</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {announcements.length > 0 ? announcements.map((ann: any) => (
                  <div key={ann.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {ann.isPinned && <span className="text-amber-500">📌</span>}
                          <h4 className="font-bold text-gray-900">{ann.title}</h4>
                        </div>
                        <p className="text-gray-600 mb-2">{ann.content}</p>
                        <p className="text-xs text-gray-400">{new Date(ann.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                )) : (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No announcements yet. Create one to share news with your followers!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Events</h2>
                <button onClick={() => setShowEventForm(true)} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Event</button>
              </div>

              {showEventForm && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Create Event</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                      <input type="text" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className="input w-full" placeholder="Event title" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className="input w-full" rows={3} placeholder="Event details..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date/Time *</label>
                        <input type="datetime-local" value={eventForm.startDate} onChange={e => setEventForm({ ...eventForm, startDate: e.target.value })} className="input w-full" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date/Time</label>
                        <input type="datetime-local" value={eventForm.endDate} onChange={e => setEventForm({ ...eventForm, endDate: e.target.value })} className="input w-full" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <input type="text" value={eventForm.location} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} className="input w-full" placeholder="e.g., Main Pavilion" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setShowEventForm(false)} className="btn btn-secondary">Cancel</button>
                      <button onClick={handleCreateEvent} disabled={!eventForm.title || !eventForm.startDate} className="btn btn-primary disabled:opacity-50">Create Event</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {events.length > 0 ? events.map((evt: any) => (
                  <div key={evt.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-1">{evt.title}</h4>
                        {evt.description && <p className="text-gray-600 mb-2">{evt.description}</p>}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(evt.startDate).toLocaleDateString()} {new Date(evt.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {evt.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{evt.location}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteEvent(evt.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                )) : (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No events yet. Create one to attract visitors!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PHOTOS TAB */}
          {activeTab === 'photos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Photo Management</h2>
                <div className="text-sm text-gray-500">
                  {photos.length} / {data?.campground?.tier === 'CLASS_A' ? '∞' : data?.campground?.tier === 'CLASS_B' ? '100' : data?.campground?.tier === 'CLASS_C' ? '50' : '4'} photos
                </div>
              </div>

              {/* Upload Form */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold text-gray-900 mb-3">📷 Upload Photo</h3>
                <div className="space-y-3">
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Caption (optional)"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="input w-full"
                  />
                  <button
                    onClick={handleUploadPhoto}
                    disabled={!photoFile || uploadingPhoto}
                    className="btn btn-primary disabled:opacity-50"
                  >
                    {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                  </button>
                </div>
              </div>

              {pendingPhotos.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-bold text-yellow-800 mb-3">⏳ Pending Approval ({pendingPhotos.length})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {pendingPhotos.map((photo: any) => (
                      <div key={photo.id} className="bg-white rounded-lg overflow-hidden shadow">
                        <img src={`http://127.0.0.1:3001${photo.imageUrl}`} alt="" className="w-full h-32 object-cover" />
                        <div className="p-2">
                          <p className="text-xs text-gray-600 truncate">{photo.user.firstName} {photo.user.lastName}</p>
                          <div className="flex gap-1 mt-2">
                            <button onClick={() => handleReviewPhoto(photo.id, 'APPROVED')} className="flex-1 btn btn-sm bg-green-500 text-white hover:bg-green-600"><Check className="w-3 h-3" /></button>
                            <button onClick={() => handleReviewPhoto(photo.id, 'REJECTED')} className="flex-1 btn btn-sm bg-red-500 text-white hover:bg-red-600"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-bold text-gray-900 mb-3">✅ Approved Photos ({photos.length})</h3>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {photos.map((photo: any) => (
                      <div key={photo.id} className="bg-white rounded-lg overflow-hidden shadow relative group">
                        <img src={`http://127.0.0.1:3001${photo.imageUrl}`} alt="" className="w-full h-32 object-cover" />
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleSetBanner(photo.id)} className="bg-blue-500 text-white p-1 rounded-full" title="Set as banner"><Image className="w-3 h-3" /></button>
                          <button onClick={() => handleDeletePhoto(photo.id)} className="bg-red-500 text-white p-1 rounded-full" title="Delete photo"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        {data?.campground?.imageUrl === photo.imageUrl && <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">Banner</div>}
                        <div className="p-2">
                          <p className="text-xs text-gray-600 truncate">{photo.user?.firstName} {photo.user?.lastName}</p>
                          {photo.caption && <p className="text-xs text-gray-500 truncate">{photo.caption}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No approved photos yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REVIEWS TAB */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Reviews ({reviews.length})</h2>
                <div className="flex items-center gap-2 text-lg">
                  <span>{'🔥'.repeat(Math.round(stats.avgRating))}</span>
                  <span className="text-gray-600">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'} avg</span>
                </div>
              </div>

              <div className="space-y-4">
                {reviews.length > 0 ? reviews.map((review: any) => (
                  <div key={review.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-start gap-4">
                      {review.user?.profilePicture ? (
                        <img src={`http://127.0.0.1:3001${review.user.profilePicture}`} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 font-medium">{review.user?.firstName?.[0] || '?'}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-gray-900">{review.user?.firstName} {review.user?.lastName}</p>
                          <span className="text-amber-500">{'🔥'.repeat(review.rating)}</span>
                        </div>
                        {review.title && <p className="font-medium text-gray-800 mb-1">{review.title}</p>}
                        {review.review && <p className="text-gray-600">{review.review}</p>}
                        <p className="text-xs text-gray-400 mt-2">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No reviews yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHECK-INS TAB */}
          {activeTab === 'checkins' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Check-ins ({checkIns.length})</h2>

              <div className="space-y-4">
                {checkIns.length > 0 ? checkIns.map((ci: any) => (
                  <div key={ci.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-4">
                      {ci.user?.profilePicture ? (
                        <img src={`http://127.0.0.1:3001${ci.user.profilePicture}`} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 font-medium">{ci.user?.firstName?.[0] || '?'}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{ci.user?.firstName} {ci.user?.lastName}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(ci.checkInDate).toLocaleDateString()} - {ci.checkOutDate ? new Date(ci.checkOutDate).toLocaleDateString() : 'Present'}
                          {ci.siteNumber && <span className="ml-2">• Site {ci.siteNumber}</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No check-ins yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* THREADS TAB */}
          {activeTab === 'threads' && (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Community Threads</h3>
              <p className="text-gray-600 mb-4">View and moderate community discussions on your campground page.</p>
              <Link to={`/campgrounds/${campgroundId}`} className="btn btn-primary">Go to Campground Page</Link>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Business Settings</h2>
              <div className="space-y-6 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
                  <input type="email" value={settingsForm.businessEmail} onChange={e => setSettingsForm({ ...settingsForm, businessEmail: e.target.value })} className="input w-full" placeholder="contact@campground.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Phone</label>
                  <input type="tel" value={settingsForm.businessPhone} onChange={e => setSettingsForm({ ...settingsForm, businessPhone: e.target.value })} className="input w-full" placeholder="(555) 123-4567" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Booking URL</label>
                  <input type="url" value={settingsForm.bookingUrl} onChange={e => setSettingsForm({ ...settingsForm, bookingUrl: e.target.value })} className="input w-full" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input type="url" value={settingsForm.websiteUrl} onChange={e => setSettingsForm({ ...settingsForm, websiteUrl: e.target.value })} className="input w-full" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={settingsForm.description} onChange={e => setSettingsForm({ ...settingsForm, description: e.target.value })} className="input w-full" rows={4} placeholder="Describe your campground..." />
                </div>

                <hr className="my-6" />
                <h3 className="text-lg font-bold text-gray-900 mb-4"># Hashtag</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campground Hashtag</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-lg">#</span>
                    <input type="text" value={settingsForm.hashtag} onChange={e => setSettingsForm({ ...settingsForm, hashtag: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })} className="input flex-1" placeholder="YourCampground" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Users can mention your campground with #{settingsForm.hashtag || 'YourHashtag'}</p>
                </div>

                <hr className="my-6" />
                <h3 className="text-lg font-bold text-gray-900 mb-4">🔗 Social Media Links</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                  <input type="url" value={settingsForm.facebookUrl} onChange={e => setSettingsForm({ ...settingsForm, facebookUrl: e.target.value })} className="input w-full" placeholder="https://facebook.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                  <input type="url" value={settingsForm.instagramUrl} onChange={e => setSettingsForm({ ...settingsForm, instagramUrl: e.target.value })} className="input w-full" placeholder="https://instagram.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">X / Twitter</label>
                  <input type="url" value={settingsForm.twitterUrl} onChange={e => setSettingsForm({ ...settingsForm, twitterUrl: e.target.value })} className="input w-full" placeholder="https://x.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube</label>
                  <input type="url" value={settingsForm.youtubeUrl} onChange={e => setSettingsForm({ ...settingsForm, youtubeUrl: e.target.value })} className="input w-full" placeholder="https://youtube.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
                  <input type="url" value={settingsForm.tiktokUrl} onChange={e => setSettingsForm({ ...settingsForm, tiktokUrl: e.target.value })} className="input w-full" placeholder="https://tiktok.com/@..." />
                </div>

                <button onClick={handleSaveSettings} disabled={savingSettings} className="btn btn-primary disabled:opacity-50 mt-6">
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* LOCKED TABS */}
          {activeTab === 'stickers' && !canAccess('CLASS_B') && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Digital Stickers</h3>
              <p className="text-gray-600 mb-4">Create custom stickers for visitors to collect. Upgrade to Class B to unlock.</p>
              <button className="btn btn-primary">Upgrade to Class B</button>
            </div>
          )}

          {activeTab === 'analytics' && !canAccess('CLASS_A') && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Analytics Dashboard</h3>
              <p className="text-gray-600 mb-4">See page views, visitor trends, and engagement metrics. Upgrade to Class A to unlock.</p>
              <button className="btn btn-primary">Upgrade to Class A</button>
            </div>
          )}

          {activeTab === 'branding' && !canAccess('CLASS_B') && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Custom Branding</h3>
              <p className="text-gray-600 mb-4">Customize colors, themes, and layout. Upgrade to Class B to unlock.</p>
              <button className="btn btn-primary">Upgrade to Class B</button>
            </div>
          )}

          {activeTab === 'branding' && canAccess('CLASS_B') && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Branding & Theme</h2>

              {/* Theme Selection */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4">🎨 Page Theme</h3>
                <p className="text-gray-600 mb-4">Choose a layout style for your campground page</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Classic Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'classic' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'classic' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-gray-100 rounded-lg h-32 mb-3 flex flex-col overflow-hidden">
                      <div className="bg-green-600 h-12"></div>
                      <div className="flex-1 p-2">
                        <div className="bg-gray-300 h-2 w-3/4 rounded mb-1"></div>
                        <div className="bg-gray-300 h-2 w-1/2 rounded"></div>
                      </div>
                      <div className="flex gap-1 p-2 border-t">
                        <div className="bg-gray-300 h-4 flex-1 rounded"></div>
                        <div className="bg-gray-300 h-4 flex-1 rounded"></div>
                        <div className="bg-gray-300 h-4 flex-1 rounded"></div>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900">Classic</h4>
                    <p className="text-sm text-gray-500">Traditional layout with tabs</p>
                  </div>

                  {/* Modern Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'modern' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'modern' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-gray-100 rounded-lg h-32 mb-3 flex flex-col overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-16"></div>
                      <div className="flex-1 p-2 flex gap-1">
                        <div className="bg-white shadow rounded h-full flex-1"></div>
                        <div className="bg-white shadow rounded h-full flex-1"></div>
                        <div className="bg-white shadow rounded h-full flex-1"></div>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900">Modern</h4>
                    <p className="text-sm text-gray-500">Full-width hero, card-based</p>
                  </div>

                  {/* Rustic Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'rustic' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'rustic' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-amber-100 rounded-lg h-32 mb-3 flex flex-col overflow-hidden border border-amber-300">
                      <div className="bg-amber-800 h-10 flex items-center justify-center">
                        <div className="bg-amber-200 h-4 w-1/2 rounded"></div>
                      </div>
                      <div className="flex-1 p-2 space-y-1">
                        <div className="bg-amber-200 h-8 rounded"></div>
                        <div className="bg-amber-200 h-8 rounded"></div>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900">Rustic</h4>
                    <p className="text-sm text-gray-500">Warm, nature-inspired feel</p>
                  </div>

                  {/* Coastal Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'coastal' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'coastal' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-gradient-to-b from-sky-200 to-blue-400 rounded-lg h-32 mb-3 flex flex-col overflow-hidden">
                      <div className="flex-1 relative">
                        <div className="absolute bottom-0 w-full">
                          <svg viewBox="0 0 100 20" className="w-full h-6 text-sky-100 fill-current">
                            <path d="M0,10 Q25,0 50,10 T100,10 L100,20 L0,20 Z" />
                          </svg>
                        </div>
                      </div>
                      <div className="bg-sky-50 p-2 flex gap-1">
                        <div className="bg-sky-200 h-4 flex-1 rounded-full"></div>
                        <div className="bg-sky-200 h-4 flex-1 rounded-full"></div>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900">Coastal</h4>
                    <p className="text-sm text-gray-500">Beach vibes, ocean blues</p>
                  </div>

                  {/* Adventure Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'adventure' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'adventure' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-gray-900 rounded-lg h-32 mb-3 flex flex-col overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 h-3"></div>
                      <div className="flex-1 p-2 flex items-center justify-center">
                        <div className="text-center">
                          <div className="bg-orange-500 h-8 w-8 rounded-full mx-auto mb-1"></div>
                          <div className="bg-gray-700 h-2 w-16 rounded"></div>
                        </div>
                      </div>
                      <div className="bg-gray-800 p-2 flex gap-1">
                        <div className="bg-orange-500 h-4 flex-1 rounded"></div>
                        <div className="bg-gray-700 h-4 flex-1 rounded"></div>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900">Adventure</h4>
                    <p className="text-sm text-gray-500">Bold, rugged outdoor feel</p>
                  </div>

                  {/* Minimal Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'minimal' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'minimal' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-white rounded-lg h-32 mb-3 flex flex-col overflow-hidden border border-gray-100">
                      <div className="flex-1 p-4 flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <div className="bg-gray-200 h-1 w-20 rounded mx-auto"></div>
                          <div className="bg-gray-100 h-1 w-16 rounded mx-auto"></div>
                          <div className="bg-gray-200 h-1 w-12 rounded mx-auto"></div>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 p-2 flex justify-center gap-4">
                        <div className="bg-gray-200 h-1 w-8 rounded"></div>
                        <div className="bg-gray-200 h-1 w-8 rounded"></div>
                        <div className="bg-gray-200 h-1 w-8 rounded"></div>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900">Minimal</h4>
                    <p className="text-sm text-gray-500">Clean, zen-like simplicity</p>
                  </div>

                  {/* Magazine Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'magazine' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'magazine' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-white rounded-lg h-32 mb-3 flex overflow-hidden border border-gray-200">
                      <div className="w-1/2 bg-gray-800 p-2">
                        <div className="bg-white h-2 w-full mb-1"></div>
                        <div className="bg-gray-600 h-1 w-3/4 mb-2"></div>
                        <div className="bg-gray-700 h-4 w-full"></div>
                      </div>
                      <div className="w-1/2 p-2 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="bg-gray-200 h-1 w-full"></div>
                          <div className="bg-gray-200 h-1 w-5/6"></div>
                          <div className="bg-gray-200 h-1 w-4/6"></div>
                        </div>
                        <div className="border-l-4 border-gray-800 pl-2">
                          <div className="bg-gray-300 h-1 w-full"></div>
                        </div>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900">Magazine</h4>
                    <p className="text-sm text-gray-500">Editorial, storytelling layout</p>
                  </div>

                  {/* Retro Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'retro' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'retro' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-amber-100 rounded-lg h-32 mb-3 flex flex-col overflow-hidden border-4 border-double border-amber-800">
                      <div className="bg-amber-800 text-amber-100 text-center py-1 text-xs font-bold tracking-widest">★ EST. 2024 ★</div>
                      <div className="flex-1 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full border-4 border-amber-700 bg-amber-200 flex items-center justify-center">
                          <div className="w-6 h-6 bg-amber-700 rounded-full"></div>
                        </div>
                      </div>
                      <div className="bg-amber-700 h-3"></div>
                    </div>
                    <h4 className="font-bold text-gray-900">Retro</h4>
                    <p className="text-sm text-gray-500">Vintage badge, nostalgic feel</p>
                  </div>

                  {/* Neon Theme */}
                  <div 
                    onClick={() => setSettingsForm({ ...settingsForm, theme: 'neon' })}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition ` + (settingsForm.theme === 'neon' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <div className="bg-gray-950 rounded-lg h-32 mb-3 flex flex-col overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"></div>
                      <div className="flex-1 p-2 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-cyan-900/20"></div>
                        <div className="text-center z-10">
                          <div className="h-2 w-16 mx-auto mb-1 bg-gradient-to-r from-pink-400 to-cyan-400 rounded"></div>
                          <div className="h-1 w-10 mx-auto bg-purple-500/50 rounded"></div>
                        </div>
                      </div>
                      <div className="flex gap-1 p-1 border-t border-purple-500/30">
                        <div className="h-2 flex-1 rounded bg-pink-500/30 border border-pink-500/50"></div>
                        <div className="h-2 flex-1 rounded bg-cyan-500/30 border border-cyan-500/50"></div>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900">Neon</h4>
                    <p className="text-sm text-gray-500">Futuristic, glowing accents</p>
                  </div>
                </div>
              </div>

              {/* Accent Color */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4">🎨 Accent Color</h3>
                <p className="text-gray-600 mb-4">Choose a primary color for buttons and highlights</p>
                
                <div className="flex flex-wrap gap-3">
                  {['#16a34a', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#0d9488', '#dc2626'].map(color => (
                    <button
                      key={color}
                      onClick={() => setSettingsForm({ ...settingsForm, accentColor: color })}
                      className={`w-12 h-12 rounded-full border-4 transition ` + (settingsForm.accentColor === color ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105')}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="flex items-center gap-2 ml-4">
                    <label className="text-sm text-gray-600">Custom:</label>
                    <input 
                      type="color" 
                      value={settingsForm.accentColor} 
                      onChange={e => setSettingsForm({ ...settingsForm, accentColor: e.target.value })}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4">👁️ Preview</h3>
                <div className="border rounded-lg p-4" style={{ borderColor: settingsForm.accentColor }}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-lg" style={{ backgroundColor: settingsForm.accentColor }}></div>
                    <div>
                      <h4 className="font-bold text-lg">{data?.campground?.name || 'Your Campground'}</h4>
                      <p className="text-gray-500">{settingsForm.theme.charAt(0).toUpperCase() + settingsForm.theme.slice(1)} Theme</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: settingsForm.accentColor }}>
                    Sample Button
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <button onClick={handleSaveSettings} disabled={savingSettings} className="btn btn-primary disabled:opacity-50">
                {savingSettings ? 'Saving...' : 'Save Branding'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
