import { useState, useEffect } from 'react';
import { 
  Send, 
  Users, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Filter,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Tent,
  X
} from 'lucide-react';
import api from '../services/api';

interface Recipient {
  id: string;
  type: 'checkin' | 'stay' | 'event';
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  siteNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  startDate?: string;
  endDate?: string;
  eventName?: string;
  source?: string;
}

interface RecipientsData {
  checkedIn: Recipient[];
  upcoming: Recipient[];
  counts: {
    checkedIn: number;
    upcoming: number;
    total: number;
  };
}

interface CampgroundMessagingProps {
  campgroundId: string;
  campgroundName: string;
  onClose?: () => void;
}

export default function CampgroundMessaging({ 
  campgroundId, 
  campgroundName,
  onClose 
}: CampgroundMessagingProps) {
  const [recipients, setRecipients] = useState<RecipientsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Filters
  const [includeCheckedIn, setIncludeCheckedIn] = useState(true);
  const [includeUpcoming, setIncludeUpcoming] = useState(true);
  const [upcomingDays, setUpcomingDays] = useState(30);
  
  // Selection
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Message
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  
  // UI state
  const [showCheckedIn, setShowCheckedIn] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadRecipients();
  }, [campgroundId, includeCheckedIn, includeUpcoming, upcomingDays]);

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        includeCheckedIn: String(includeCheckedIn),
        includeUpcoming: String(includeUpcoming),
        upcomingDays: String(upcomingDays)
      });
      
      const { data } = await api.get(
        `/campground-messaging/${campgroundId}/recipients?${params}`
      );
      setRecipients(data);
    } catch (error) {
      console.error('Load recipients error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
    setSelectAll(false);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedUserIds(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set<string>();
      recipients?.checkedIn.forEach(r => allIds.add(r.user.id));
      recipients?.upcoming.forEach(r => allIds.add(r.user.id));
      setSelectedUserIds(allIds);
      setSelectAll(true);
    }
  };

  const handleSend = async () => {
    if (!content.trim()) {
      alert('Please enter a message');
      return;
    }

    if (selectedUserIds.size === 0 && !selectAll) {
      alert('Please select at least one recipient');
      return;
    }

    try {
      setSending(true);
      const { data } = await api.post(`/campground-messaging/${campgroundId}/send`, {
        recipientIds: Array.from(selectedUserIds),
        subject: subject.trim() || undefined,
        content: content.trim(),
        sendToAll: selectAll,
        includeCheckedIn,
        includeUpcoming,
        upcomingDays
      });

      setSuccessMessage(`Successfully sent ${data.messagesSent} message(s)!`);
      setContent('');
      setSubject('');
      setSelectedUserIds(new Set());
      setSelectAll(false);
      
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Send message error:', error);
      alert('Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const RecipientCard = ({ recipient }: { recipient: Recipient }) => {
    const isSelected = selectedUserIds.has(recipient.user.id);
    
    return (
      <div
        onClick={() => toggleUserSelection(recipient.user.id)}
        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
          isSelected 
            ? 'bg-primary-50 border-2 border-primary-500' 
            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
        }`}
      >
        <div className="relative">
          {recipient.user.profilePicture ? (
            <img
              src={recipient.user.profilePicture}
              alt={recipient.user.firstName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="font-bold text-primary-600 text-sm">
                {recipient.user.firstName[0]}{recipient.user.lastName[0]}
              </span>
            </div>
          )}
          {isSelected && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {recipient.user.firstName} {recipient.user.lastName}
          </p>
          <p className="text-xs text-gray-500">
            {recipient.type === 'checkin' && recipient.siteNumber && (
              <span>Site {recipient.siteNumber} • </span>
            )}
            {recipient.type === 'checkin' && (
              <>
                {formatDate(recipient.checkInDate!)}
                {recipient.checkOutDate && ` - ${formatDate(recipient.checkOutDate)}`}
              </>
            )}
            {(recipient.type === 'stay' || recipient.type === 'event') && (
              <>
                {formatDate(recipient.startDate!)}
                {recipient.endDate && ` - ${formatDate(recipient.endDate)}`}
                {recipient.eventName && ` • ${recipient.eventName}`}
              </>
            )}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Message Campers</h2>
              <p className="text-sm text-white/80">{campgroundName}</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border-b border-green-200 p-3 text-green-700 text-center font-medium">
          {successMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Filters */}
        <div className="bg-gray-50 rounded-lg p-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-700">Filters & Audience</span>
            </div>
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showFilters && (
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCheckedIn}
                  onChange={(e) => setIncludeCheckedIn(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <Tent className="w-4 h-4 text-green-600" />
                <span>Currently Checked In</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUpcoming}
                  onChange={(e) => setIncludeUpcoming(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Upcoming Reservations</span>
              </label>
              
              {includeUpcoming && (
                <div className="ml-7 flex items-center gap-2">
                  <span className="text-sm text-gray-600">Within next</span>
                  <select
                    value={upcomingDays}
                    onChange={(e) => setUpcomingDays(Number(e.target.value))}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recipients */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            Loading recipients...
          </div>
        ) : (
          <>
            {/* Summary & Select All */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{recipients?.counts.total || 0}</span> total recipients
                {selectedUserIds.size > 0 && (
                  <span className="ml-2 text-primary-600">
                    ({selectedUserIds.size} selected)
                  </span>
                )}
              </div>
              <button
                onClick={handleSelectAll}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {selectAll ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Checked In Section */}
            {includeCheckedIn && recipients && recipients.checkedIn.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCheckedIn(!showCheckedIn)}
                  className="flex items-center gap-2 w-full text-left mb-2"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium text-gray-900">
                      Currently Camping ({recipients.counts.checkedIn})
                    </span>
                  </div>
                  {showCheckedIn ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showCheckedIn && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recipients.checkedIn.map(r => (
                      <RecipientCard key={r.id} recipient={r} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Section */}
            {includeUpcoming && recipients && recipients.upcoming.length > 0 && (
              <div>
                <button
                  onClick={() => setShowUpcoming(!showUpcoming)}
                  className="flex items-center gap-2 w-full text-left mb-2"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="font-medium text-gray-900">
                      Upcoming Reservations ({recipients.counts.upcoming})
                    </span>
                  </div>
                  {showUpcoming ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showUpcoming && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recipients.upcoming.map(r => (
                      <RecipientCard key={r.id} recipient={r} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No Recipients */}
            {recipients && recipients.counts.total === 0 && (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No campers found with current filters</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try adjusting your date range or filters
                </p>
              </div>
            )}
          </>
        )}

        {/* Compose Message */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Send className="w-4 h-4" />
            Compose Message
          </h3>
          
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your message to campers..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
          
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Message will be sent from "{campgroundName}"
            </p>
            <button
              onClick={handleSend}
              disabled={sending || (!selectedUserIds.size && !selectAll) || !content.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : `Send to ${selectAll ? recipients?.counts.total : selectedUserIds.size} Camper(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
