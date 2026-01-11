import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, Trash2, Search } from 'lucide-react';
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

interface MessagesPageProps {
  user: UserType;
}

export default function MessagesPage({ user }: MessagesPageProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [newMessage, setNewMessage] = useState({
    subject: '',
    content: '',
  });
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

 //   useEffect(() => {
  //  if (!initialized) {
    //  const timer = setTimeout(() => {
      //  loadMessages();
      //  loadSentMessages();
      //  loadFriends();
      //  setInitialized(true);
    //  }, 2000);
    //  return () => clearTimeout(timer);
  //  }
 //  }, [initialized]);

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
      const { data } = await api.get('/friendships/friends');
      setFriends(data);
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient || !newMessage.content.trim()) return;

    try {
      setSending(true);
      await api.post('/messages', {
        recipientId: selectedRecipient,
        subject: newMessage.subject.trim() || undefined,
        content: newMessage.content,
      });
      setNewMessage({ subject: '', content: '' });
      setSelectedRecipient('');
      setShowCompose(false);
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Messages</h1>
        <p className="text-gray-600">Stay connected with your camping friends</p>
      </div>

      {!initialized ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Mail className="w-16 h-16 mx-auto text-gray-400 mb-4 animate-pulse" />
          <p className="text-xl text-gray-600">Loading your messages...</p>
        </div>
      ) : (
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
                    {searchTerm ? 'Try a different search term' : 'Start a conversation with your friends!'}
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
      )}

      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Compose Message</h2>
                <button
                  onClick={() => {
                    setShowCompose(false);
                    setNewMessage({ subject: '', content: '' });
                    setSelectedRecipient('');
                  }}
                  className="text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="p-6 space-y-4">
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
                  rows={8}
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
                  onClick={() => {
                    setShowCompose(false);
                    setNewMessage({ subject: '', content: '' });
                    setSelectedRecipient('');
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
