import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, Trash2, Search, Users, Tent, X, Loader } from 'lucide-react';
import api from '../services/api';
import { User as UserType } from '../services/auth.service';

interface Message {
  id: string;
  subject?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  recipient: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface Friend {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture?: string;
}

interface Campground {
  id: string;
  name: string;
  location?: string;
  state?: string;
  source?: string;
}

interface MessagesPageProps {
  user: UserType;
}

export default function MessagesPage({ user }: MessagesPageProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myCampgrounds, setMyCampgrounds] = useState<Campground[]>([]);
  const [searchedCampgrounds, setSearchedCampgrounds] = useState<Campground[]>([]);
  const [campgroundSearch, setCampgroundSearch] = useState('');
  const [searchingCampgrounds, setSearchingCampgrounds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  
  // Compose form state
  const [messageType, setMessageType] = useState<'friend' | 'campground'>('friend');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [selectedCampground, setSelectedCampground] = useState('');
  const [ccFriends, setCcFriends] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState({ subject: '', content: '' });
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMessages();
    loadSentMessages();
    loadFriends();
    loadMyCampgrounds();
  }, []);

  // Debounced campground search
  useEffect(() => {
    if (campgroundSearch.length >= 2) {
      const timer = setTimeout(() => searchCampgrounds(campgroundSearch), 300);
      return () => clearTimeout(timer);
    } else {
      setSearchedCampgrounds([]);
    }
  }, [campgroundSearch]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/messages');
      setMessages(data);
    } catch (error) {
      console.error('Load messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSentMessages = async () => {
    try {
      const { data } = await api.get('/messages/sent');
      setSentMessages(data);
    } catch (error) {
      console.error('Load sent messages error:', error);
    }
  };

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const loadMyCampgrounds = async () => {
    try {
      const { data } = await api.get('/campgrounds/following');
      setMyCampgrounds(data);
    } catch (error) {
      console.error('Load my campgrounds error:', error);
    }
  };

  const searchCampgrounds = async (query: string) => {
    try {
      setSearchingCampgrounds(true);
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(query)}&limit=20`);
      // Filter out ones already in myCampgrounds
      const myIds = new Set(myCampgrounds.map(c => c.id));
      setSearchedCampgrounds(data.filter((c: Campground) => !myIds.has(c.id)));
    } catch (error) {
      console.error('Search campgrounds error:', error);
    } finally {
      setSearchingCampgrounds(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.content.trim()) return;
    
    if (messageType === 'friend' && !selectedRecipient) {
      alert('Please select a friend to message');
      return;
    }
    if (messageType === 'campground' && !selectedCampground) {
      alert('Please select a campground to message');
      return;
    }

    try {
      setSending(true);
      await api.post('/messages', {
        recipientId: messageType === 'friend' ? selectedRecipient : undefined,
        campgroundId: messageType === 'campground' ? selectedCampground : undefined,
        ccUserIds: ccFriends.length > 0 ? ccFriends : undefined,
        subject: newMessage.subject.trim() || undefined,
        content: newMessage.content,
      });
      
      resetComposeForm();
      loadMessages();
      loadSentMessages();
      alert('Message sent!');
    } catch (error) {
      console.error('Send message error:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const resetComposeForm = () => {
    setNewMessage({ subject: '', content: '' });
    setSelectedRecipient('');
    setSelectedCampground('');
    setCcFriends([]);
    setCampgroundSearch('');
    setSearchedCampgrounds([]);
    setMessageType('friend');
    setShowCompose(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;

    try {
      await api.delete(`/messages/${messageId}`);
      loadMessages();
    } catch (error) {
      console.error('Delete message error:', error);
      alert('Failed to delete message');
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await api.put(`/messages/${messageId}/read`);
      loadMessages();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const toggleCcFriend = (friendId: string) => {
    setCcFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const getSourceLabel = (source?: string) => {
    switch(source) {
      case 'checked-in': return '🏕️ Currently here';
      case 'following': return '⭐ Following';
      case 'visited': return '📍 Visited';
      default: return '';
    }
  };

  const unreadCount = messages.filter(m => !m.isRead).length;

  const filteredMessages = messages.filter(m => 
    m.sender.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.sender.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.sender.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSentMessages = sentMessages.filter(m => 
    m.recipient.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.recipient.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.recipient.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableCcFriends = friends.filter(f => f.id !== selectedRecipient);

  // Get selected campground name for display
  const selectedCampgroundData = [...myCampgrounds, ...searchedCampgrounds].find(c => c.id === selectedCampground);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Messages</h1>
        <p className="text-gray-600">Stay connected with friends and campgrounds</p>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Your Inbox</h2>
            <button
              onClick={() => setShowCompose(true)}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Compose</span>
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inbox'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inbox ({messages.length})
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sent'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Sent ({sentMessages.length})
            </button>
          </nav>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div>
          {loading ? (
            <div className="p-12 text-center text-gray-600">
              Loading messages...
            </div>
          ) : activeTab === 'inbox' ? (
            filteredMessages.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm ? 'No messages found' : 'No messages yet'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm ? 'Try a different search term' : 'Start a conversation!'}
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setShowCompose(true)}
                    className="btn btn-primary"
                  >
                    Send Your First Message
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !message.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <Link to={`/profile/${message.sender.username}`}>
                        {message.sender.profilePicture ? (
                          <img
                            src={message.sender.profilePicture}
                            alt={message.sender.firstName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="font-bold text-primary-600">
                              {message.sender.firstName[0]}{message.sender.lastName[0]}
                            </span>
                          </div>
                        )}
                      </Link>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <Link
                            to={`/profile/${message.sender.username}`}
                            className="font-semibold text-gray-900 hover:text-primary-600"
                          >
                            {message.sender.firstName} {message.sender.lastName}
                          </Link>
                          <span className="text-xs text-gray-500">
                            {new Date(message.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {message.subject && (
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            {message.subject}
                          </p>
                        )}

                        <p className="text-sm text-gray-700 line-clamp-2">
                          {message.content}
                        </p>

                        <div className="flex items-center space-x-4 mt-2">
                          {!message.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(message.id)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Mark as read
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedRecipient(message.sender.id);
                              setMessageType('friend');
                              setNewMessage({ 
                                subject: message.subject ? `Re: ${message.subject}` : '', 
                                content: '' 
                              });
                              setShowCompose(true);
                            }}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center space-x-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredSentMessages.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm ? 'No messages found' : 'No sent messages'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm ? 'Try a different search term' : 'Messages you send will appear here'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredSentMessages.map((message) => (
                  <div
                    key={message.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start space-x-4">
                      <Link to={`/profile/${message.recipient.username}`}>
                        {message.recipient.profilePicture ? (
                          <img
                            src={message.recipient.profilePicture}
                            alt={message.recipient.firstName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="font-bold text-primary-600">
                              {message.recipient.firstName[0]}{message.recipient.lastName[0]}
                            </span>
                          </div>
                        )}
                      </Link>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm text-gray-600">To: </span>
                            <Link
                              to={`/profile/${message.recipient.username}`}
                              className="font-semibold text-gray-900 hover:text-primary-600"
                            >
                              {message.recipient.firstName} {message.recipient.lastName}
                            </Link>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(message.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {message.subject && (
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            {message.subject}
                          </p>
                        )}

                        <p className="text-sm text-gray-700 line-clamp-2">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Compose Message</h2>
                <button
                  onClick={resetComposeForm}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="p-6 space-y-4">
              {/* Message Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send to:
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMessageType('friend');
                      setSelectedCampground('');
                      setCampgroundSearch('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                      messageType === 'friend'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Friend</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessageType('campground');
                      setSelectedRecipient('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                      messageType === 'campground'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Tent className="w-5 h-5" />
                    <span className="font-medium">Campground</span>
                  </button>
                </div>
              </div>

              {/* Recipient Selection */}
              {messageType === 'friend' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To: *
                  </label>
                  <select
                    value={selectedRecipient}
                    onChange={(e) => setSelectedRecipient(e.target.value)}
                    required
                    className="input"
                  >
                    <option value="">Select a friend...</option>
                    {friends.map((friend) => (
                      <option key={friend.id} value={friend.id}>
                        {friend.firstName} {friend.lastName} (@{friend.username})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Campground: *
                  </label>
                  
                  {/* Selected campground display */}
                  {selectedCampground && selectedCampgroundData && (
                    <div className="flex items-center gap-2 p-2 bg-primary-50 border border-primary-200 rounded-lg mb-2">
                      <Tent className="w-4 h-4 text-primary-600" />
                      <span className="flex-1 font-medium">{selectedCampgroundData.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCampground('')}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {!selectedCampground && (
                    <>
                      {/* My campgrounds */}
                      {myCampgrounds.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-2">Your Campgrounds</p>
                          <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                            {myCampgrounds.map((cg) => (
                              <button
                                key={cg.id}
                                type="button"
                                onClick={() => setSelectedCampground(cg.id)}
                                className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left border-b last:border-b-0"
                              >
                                <Tent className="w-4 h-4 text-gray-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{cg.name}</p>
                                  {cg.location && (
                                    <p className="text-xs text-gray-500 truncate">{cg.location}</p>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400">{getSourceLabel(cg.source)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Search all campgrounds */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Or search all campgrounds</p>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="text"
                            value={campgroundSearch}
                            onChange={(e) => setCampgroundSearch(e.target.value)}
                            placeholder="Search by name..."
                            className="input pl-9 text-sm"
                          />
                          {searchingCampgrounds && (
                            <Loader className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                          )}
                        </div>
                        
                        {searchedCampgrounds.length > 0 && (
                          <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                            {searchedCampgrounds.map((cg) => (
                              <button
                                key={cg.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCampground(cg.id);
                                  setCampgroundSearch('');
                                  setSearchedCampgrounds([]);
                                }}
                                className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left border-b last:border-b-0"
                              >
                                <Tent className="w-4 h-4 text-gray-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{cg.name}</p>
                                  {cg.location && (
                                    <p className="text-xs text-gray-500 truncate">{cg.location}</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {campgroundSearch.length >= 2 && !searchingCampgrounds && searchedCampgrounds.length === 0 && (
                          <p className="text-xs text-gray-500 mt-2">No campgrounds found</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* CC Friends */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CC Friends (optional)
                </label>
                {availableCcFriends.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {availableCcFriends.map((friend) => (
                      <label
                        key={friend.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                          ccFriends.includes(friend.id) ? 'bg-primary-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ccFriends.includes(friend.id)}
                          onChange={() => toggleCcFriend(friend.id)}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        {friend.profilePicture ? (
                          <img
                            src={friend.profilePicture}
                            alt={friend.firstName}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">
                            {friend.firstName[0]}
                          </div>
                        )}
                        <span className="text-sm">
                          {friend.firstName} {friend.lastName}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No friends available to CC</p>
                )}
                {ccFriends.length > 0 && (
                  <p className="text-xs text-primary-600 mt-1">
                    {ccFriends.length} friend(s) will also receive this message
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={newMessage.subject}
                  onChange={(e) =>
                    setNewMessage({ ...newMessage, subject: e.target.value })
                  }
                  className="input"
                  placeholder="What's this about?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  value={newMessage.content}
                  onChange={(e) =>
                    setNewMessage({ ...newMessage, content: e.target.value })
                  }
                  required
                  rows={6}
                  className="input"
                  placeholder="Write your message..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={sending}
                  className="btn btn-primary flex-1 flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{sending ? 'Sending...' : 'Send Message'}</span>
                </button>
                <button
                  type="button"
                  onClick={resetComposeForm}
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
