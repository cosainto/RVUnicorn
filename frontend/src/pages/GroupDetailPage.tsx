import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Users, Calendar, Image, MessageSquare, ArrowLeft, Globe, Lock, UserPlus, LogOut, Settings, Send, Trash2, X, Tag } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import CampgroundSelector from '../components/CampgroundSelector';

interface Group {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverPhoto?: string;
  privacy: string;
  createdById: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  members: GroupMember[];
  _count: {
    members: number;
  };
}

interface GroupMember {
  id: string;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface GroupPost {
  id: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

export default function GroupDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('discussion');
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    campgroundId: null as string | null,
    tags: [] as string[],
    privacy: 'PUBLIC',
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventTagInput, setEventTagInput] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  useEffect(() => {
    loadGroup();
  }, [slug]);

  useEffect(() => {
    if (group && isMember()) {
      loadPosts();
      loadEvents();
      if (isAdmin()) {
        loadPendingRequests();
      }
    }
  }, [group]);

  useEffect(() => {
    if (showEventModal) {
      loadSuggestedTags();
    }
  }, [showEventModal]);

  const loadSuggestedTags = async () => {
    try {
      const { data } = await api.get('/profile/suggested-tags');
      setSuggestedTags(data.suggestedTags || []);
    } catch (error) {
      console.error('Load suggested tags error:', error);
    }
  };

  const loadGroup = async () => {
    try {
      const { data } = await api.get('/groups/' + slug);
      setGroup(data);
    } catch (error) {
      console.error('Load group error:', error);
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const { data } = await api.get('/groups/' + slug + '/posts');
      setPosts(data);
    } catch (error) {
      console.error('Load posts error:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const { data } = await api.get('/groups/' + slug + '/events');
      setEvents(data);
    } catch (error) {
      console.error('Load events error:', error);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const { data } = await api.get('/groups/' + slug + '/pending');
      setPendingRequests(data);
    } catch (error) {
      console.error('Load pending requests error:', error);
    }
  };

  const handleApproveRequest = async (memberId: string) => {
    try {
      await api.post('/groups/' + slug + '/pending/' + memberId + '/approve');
      setPendingRequests(pendingRequests.filter(r => r.id !== memberId));
      loadGroup();
    } catch (error) {
      console.error('Approve request error:', error);
    }
  };

  const handleDenyRequest = async (memberId: string) => {
    if (!confirm('Are you sure you want to deny this request?')) return;
    try {
      await api.post('/groups/' + slug + '/pending/' + memberId + '/deny');
      setPendingRequests(pendingRequests.filter(r => r.id !== memberId));
    } catch (error) {
      console.error('Deny request error:', error);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.startDate || !eventForm.endDate) {
      alert('Please fill in title and dates');
      return;
    }
    try {
      setCreatingEvent(true);
      const { data: newEvent } = await api.post('/groups/' + slug + '/events', eventForm);
      setEventForm({ title: '', description: '', startDate: '', endDate: '', location: '', campgroundId: null, tags: [], privacy: 'PUBLIC' });
      setEventTagInput('');
      setShowEventModal(false);
      navigate('/trips/' + newEvent.id);
      
    } catch (error) {
      console.error('Create event error:', error);
      alert('Failed to create trip');
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleJoinGroup = async () => {
    try {
      await api.post('/groups/' + slug + '/join');
      await loadGroup();
      alert(group?.privacy === 'CLOSED' ? 'Join request sent!' : 'Joined group! 🎉');
    } catch (error: any) {
      console.error('Join group error:', error);
      alert(error.response?.data?.error || 'Failed to join group');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    
    try {
      await api.post('/groups/' + slug + '/leave');
      await loadGroup();
      alert('Left group');
    } catch (error: any) {
      console.error('Leave group error:', error);
      alert(error.response?.data?.error || 'Failed to leave group');
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;

    try {
      setPosting(true);
      await api.post('/groups/' + slug + '/posts', { content: newPost });
      setNewPost('');
      await loadPosts();
    } catch (error) {
      console.error('Create post error:', error);
      alert('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteUsername.trim()) {
      alert('Please enter a username');
      return;
    }
    try {
      setInviting(true);
      await api.post('/groups/' + slug + '/invite', { username: inviteUsername.trim() });
      alert('Invite sent!');
      setInviteUsername('');
      setShowInviteModal(false);
    } catch (error: any) {
      console.error('Invite error:', error);
      alert(error.response?.data?.error || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const getUserMembership = () => {
    if (!user || !group) return null;
    return group.members.find(m => m.userId === user.id);
  };

  const isAdmin = () => {
    const membership = getUserMembership();
    return membership?.role === 'ADMIN';
  };

  const isMember = () => {
    const membership = getUserMembership();
    return membership?.status === 'ACTIVE';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Group not found</p>
      </div>
    );
  }

  const tabs = [
    { id: 'discussion', label: 'Discussion', icon: MessageSquare },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'photos', label: 'Photos', icon: Image },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-5xl mx-auto px-4">
          <button
            onClick={() => navigate('/groups')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 py-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Groups
          </button>

          {/* Cover Photo */}
          <div className="h-48 bg-gradient-to-r from-primary-500 to-primary-600 rounded-t-lg relative overflow-hidden">
            {group.coverPhoto && (
              <img
                src={group.coverPhoto.startsWith('http') ? group.coverPhoto : '' + group.coverPhoto}
                alt={group.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Group Info */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                <p className="text-gray-600 mt-1">
                  {group.privacy === 'PUBLIC' && <><Globe className="w-4 h-4 inline mr-1" /> Public Group</>}
                  {group.privacy === 'CLOSED' && <><Lock className="w-4 h-4 inline mr-1" /> Closed Group</>}
                  {group.privacy === 'PRIVATE' && <><Lock className="w-4 h-4 inline mr-1" /> Private Group</>}
                  <span className="mx-2">•</span>
                  <span>{group._count.members} members</span>
                </p>
                {group.description && (
                  <p className="text-gray-700 mt-3">{group.description}</p>
                )}
              </div>

              <div className="flex gap-2">
                {isMember() ? (
                  <>
                    <button
                      onClick={handleLeaveGroup}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Leave
                    </button>
                    {isAdmin() && (
                      <Link
                        to={'/groups/' + group.slug + '/edit'}
                        className="btn btn-secondary flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Manage
                      </Link>
                    )}
                  </>
                ) : group?.privacy === 'PRIVATE' ? (
                  <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                    🔐 Invite Only
                  </div>
                ) : (
                  <button
                    onClick={handleJoinGroup}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    {group?.privacy === 'CLOSED' ? 'Request to Join' : 'Join Group'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        {isMember() ? (
          <>
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="border-b border-gray-200">
                <div className="flex gap-4 px-6">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
                        activeTab === tab.id
                          ? 'border-primary-600 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.icon && <tab.icon className="w-4 h-4" />}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {/* Pending Requests Banner for Admins */}
                {isAdmin() && pendingRequests.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      Pending Join Requests ({pendingRequests.length})
                    </h4>
                    <div className="space-y-2">
                      {pendingRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                          <Link to={'/profile/' + request.user.username} className="flex items-center gap-3">
                            {request.user.profilePicture ? (
                              <img src={'' + request.user.profilePicture} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-700 font-semibold">{request.user.firstName[0]}</span>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{request.user.firstName} {request.user.lastName}</p>
                              <p className="text-sm text-gray-500">@{request.user.username}</p>
                            </div>
                          </Link>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDenyRequest(request.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discussion Tab */}
                {activeTab === 'discussion' && (
                  <div>
                    {/* New Post */}
                    <div className="mb-6">
                      <textarea
                        value={newPost}
                        onChange={(e) => setNewPost(e.target.value)}
                        placeholder="Share something with the group..."
                        className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        rows={3}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleCreatePost}
                          disabled={!newPost.trim() || posting}
                          className="btn btn-primary flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          {posting ? 'Posting...' : 'Post'}
                        </button>
                      </div>
                    </div>

                    {/* Posts */}
                    {posts.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No posts yet. Be the first to share!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {posts.map((post) => (
                          <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                              {post.user.profilePicture ? (
                                <img
                                  src={post.user.profilePicture.startsWith('http') ? post.user.profilePicture : '' + post.user.profilePicture}
                                  alt={post.user.firstName}
                                  className="w-10 h-10 rounded-full"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <Link to={'/profile/' + post.user.username} className="font-semibold text-gray-900 hover:underline">
                                  {post.user.firstName} {post.user.lastName}
                                </Link>
                                <p className="text-sm text-gray-500">{formatDate(post.createdAt)}</p>
                              </div>
                            </div>
                            <p className="text-gray-700">{post.content}</p>
                            {post.imageUrl && (
                              <img
                                src={post.imageUrl.startsWith('http') ? post.imageUrl : '' + post.imageUrl}
                                alt="Post"
                                className="mt-3 rounded-lg max-h-96 object-cover"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Events Tab */}
                {activeTab === 'events' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Group Trips</h3>
                      {isMember() && (
                        <button
                          onClick={() => setShowEventModal(true)}
                          className="btn btn-primary btn-sm flex items-center gap-2"
                        >
                          <Calendar className="w-4 h-4" />
                          Create an Event
                        </button>
                      )}
                    </div>
                    {events.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No trips planned yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {events.map((event) => (
                          <Link
                            key={event.id}
                            to={'/trips/' + event.id}
                            className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900">{event.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">
                                  {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                {event.location && (
                                  <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">{event._count?.attendees || 0} attending</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Members ({group.members.filter(m => m.status === 'ACTIVE').length})
                      </h3>
                      {isMember() && (
                        <button
                          onClick={() => setShowInviteModal(true)}
                          className="btn btn-primary btn-sm flex items-center gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          Invite
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.members
                        .filter(m => m.status === 'ACTIVE')
                        .map((member) => (
                          <Link
                            key={member.id}
                            to={'/profile/' + member.user.username}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                          >
                            {member.user.profilePicture ? (
                              <img
                                src={member.user.profilePicture.startsWith('http') ? member.user.profilePicture : '' + member.user.profilePicture}
                                alt={member.user.firstName}
                                className="w-12 h-12 rounded-full"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="w-6 h-6 text-gray-500" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {member.user.firstName} {member.user.lastName}
                              </p>
                              <p className="text-sm text-gray-600">
                                {member.role === 'ADMIN' && '👑 Admin'}
                                {member.role === 'MODERATOR' && '⭐ Moderator'}
                                {member.role === 'MEMBER' && 'Member'}
                              </p>
                            </div>
                          </Link>
                        ))}
                    </div>
                  </div>
                )}

                {/* Photos Tab */}
                {activeTab === 'photos' && (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Group photos coming soon!</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <Lock className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {group?.privacy === 'PRIVATE' ? 'Private Group' : 'Join to See More'}
            </h3>
            <p className="text-gray-600 mb-4">
              {group?.privacy === 'PRIVATE' 
                ? 'This is a private group. You need an invitation to join.'
                : group?.privacy === 'CLOSED'
                ? 'This is a closed group. Request to join to see posts, events, and connect with members.'
                : 'Join this group to see posts, events, and connect with members.'}
            </p>
            {group?.privacy !== 'PRIVATE' && (
              <button
                onClick={handleJoinGroup}
                className="btn btn-primary"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {group?.privacy === 'CLOSED' ? 'Request to Join' : 'Join Group'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create Group Trip</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="Trip name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="What's this trip about?"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campground / Location</label>
                <CampgroundSelector
                  selectedCampgroundId={eventForm.campgroundId}
                  manualLocation={eventForm.location}
                  onCampgroundSelect={(id, name, loc) => setEventForm({ ...eventForm, campgroundId: id, location: loc || name })}
                  onManualLocationChange={(loc) => setEventForm({ ...eventForm, location: loc, campgroundId: null })}
                />
              </div>
              
              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (Optional)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {eventForm.tags.map((tag, index) => (
                    <span key={index} className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setEventForm({ ...eventForm, tags: eventForm.tags.filter((_, i) => i !== index) })}
                        className="text-primary-500 hover:text-primary-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select
                    value={eventTagInput}
                    onChange={(e) => {
                      if (e.target.value && !eventForm.tags.includes(e.target.value)) {
                        setEventForm({ ...eventForm, tags: [...eventForm.tags, e.target.value] });
                      }
                      setEventTagInput('');
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select a tag...</option>
                    <optgroup label="🚐 RV Types">
                      <option value="Motorhomes">Motorhomes</option>
                      <option value="Travel Trailers">Travel Trailers</option>
                      <option value="Fifth Wheels">Fifth Wheels</option>
                      <option value="Camper Vans">Camper Vans</option>
                    </optgroup>
                    <optgroup label="🏭 RV Brands">
                      <option value="Airstream">Airstream</option>
                      <option value="Winnebago">Winnebago</option>
                      <option value="Jayco">Jayco</option>
                      <option value="Forest River">Forest River</option>
                      <option value="Thor Motor Coach">Thor Motor Coach</option>
                      <option value="Grand Design RV">Grand Design RV</option>
                    </optgroup>
                    <optgroup label="⛺ Camping Gear">
                      <option value="REI Co-op">REI Co-op</option>
                      <option value="Coleman">Coleman</option>
                      <option value="YETI">YETI</option>
                    </optgroup>
                    <optgroup label="🔥 Cooking">
                      <option value="Blackstone">Blackstone</option>
                      <option value="Camp Chef">Camp Chef</option>
                      <option value="Traeger">Traeger</option>
                    </optgroup>
                    <optgroup label="🎯 Activities">
                      <option value="Hiking">Hiking</option>
                      <option value="Fishing">Fishing</option>
                      <option value="Boondocking">Boondocking</option>
                      <option value="Family Friendly">Family Friendly</option>
                      <option value="Pet Friendly">Pet Friendly</option>
                      <option value="Overlanding">Overlanding</option>
                    </optgroup>
                  </select>
                </div>
                {suggestedTags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Based on your RV profile:</p>
                    <div className="flex flex-wrap gap-1">
                      {suggestedTags.filter(t => !eventForm.tags.includes(t)).map((tag, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setEventForm({ ...eventForm, tags: [...eventForm.tags, tag] })}
                          className="bg-gray-100 hover:bg-primary-100 text-gray-600 hover:text-primary-700 px-2 py-0.5 rounded-full text-xs transition"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
              {/* Privacy */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
                <select
                  value={eventForm.privacy}
                  onChange={(e) => setEventForm({ ...eventForm, privacy: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="PUBLIC">🌍 Public - Anyone can see this event</option>
                  <option value="FRIENDS">👥 Friends - Only friends can see this event</option>
                  <option value="PRIVATE">🔒 Private - Only you and invited attendees</option>
                </select>
              </div>
            <p className="text-sm text-gray-500 mt-4">All group members will be invited to this trip.</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowEventModal(false); setEventForm({ title: '', description: '', startDate: '', endDate: '', location: '', campgroundId: null, tags: [], privacy: 'PUBLIC' });
      setEventTagInput(''); }}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={creatingEvent}
                className="flex-1 btn btn-primary"
              >
                {creatingEvent ? 'Creating...' : 'Create an Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Invite to Group</h3>
            <input
              type="text"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowInviteModal(false); setInviteUsername(''); }}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="flex-1 btn btn-primary"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
