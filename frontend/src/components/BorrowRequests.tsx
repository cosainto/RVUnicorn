import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, XCircle, AlertCircle, MapPin, User } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface BorrowRequest {
  id: string;
  gearItem: {
    id: string;
    name: string;
    category: string;
    notes?: string;
    rulesText?: string;
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  campground: {
    id: string;
    name: string;
    location: string;
  };
  startAt: string;
  endAt: string;
  status: 'PENDING' | 'APPROVED' | 'PROPOSED' | 'DECLINED' | 'CANCELED' | 'COMPLETED' | 'OVERDUE';
  proposedStartAt?: string;
  proposedEndAt?: string;
  message?: string;
  responseMessage?: string;
  createdAt: string;
}

interface BorrowRequestsProps {
  campgroundId?: string;
}

export default function BorrowRequests({ campgroundId }: BorrowRequestsProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [proposedTimes, setProposedTimes] = useState({
    startAt: '',
    endAt: '',
  });

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/borrow/requests?type=${activeTab}`);
      setRequests(data);
    } catch (error) {
      console.error('Load borrow requests error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, withProposal = false) => {
    try {
      await api.post(`/borrow/${requestId}/approve`, {
        responseMessage,
        proposedStartAt: withProposal && proposedTimes.startAt ? proposedTimes.startAt : null,
        proposedEndAt: withProposal && proposedTimes.endAt ? proposedTimes.endAt : null,
      });

      setShowResponseModal(false);
      setSelectedRequest(null);
      setResponseMessage('');
      setProposedTimes({ startAt: '', endAt: '' });
      await loadRequests();
      alert(withProposal ? 'Proposed new times!' : 'Request approved! ✅');
    } catch (error) {
      console.error('Approve request error:', error);
      alert('Failed to approve request');
    }
  };

  const handleDecline = async (requestId: string) => {
    const reason = prompt('Why are you declining? (optional)');
    if (reason === null) return;

    try {
      await api.post(`/borrow/${requestId}/decline`, {
        responseMessage: reason,
      });

      await loadRequests();
      alert('Request declined');
    } catch (error) {
      console.error('Decline request error:', error);
      alert('Failed to decline request');
    }
  };

  const handleAcceptProposal = async (requestId: string) => {
    try {
      await api.post(`/borrow/${requestId}/accept-proposal`);
      await loadRequests();
      alert('Proposal accepted! ✅');
    } catch (error) {
      console.error('Accept proposal error:', error);
      alert('Failed to accept proposal');
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!confirm('Cancel this borrow request?')) return;

    try {
      await api.post(`/borrow/${requestId}/cancel`);
      await loadRequests();
      alert('Request canceled');
    } catch (error) {
      console.error('Cancel request error:', error);
      alert('Failed to cancel request');
    }
  };

  const handleComplete = async (requestId: string) => {
    try {
      await api.post(`/borrow/${requestId}/complete`);
      await loadRequests();
      alert('Marked as returned! ✅');
    } catch (error) {
      console.error('Complete request error:', error);
      alert('Failed to mark as complete');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pending' },
      APPROVED: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
      PROPOSED: { color: 'bg-blue-100 text-blue-700', icon: AlertCircle, label: 'New Times Proposed' },
      DECLINED: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Declined' },
      CANCELED: { color: 'bg-gray-100 text-gray-700', icon: XCircle, label: 'Canceled' },
      COMPLETED: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Completed' },
      OVERDUE: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Overdue' },
    };

    const badge = badges[status as keyof typeof badges] || badges.PENDING;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading borrow requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Borrow Requests</h2>
        <p className="text-gray-600">Manage gear borrowing with campground neighbors</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-6 py-3 border-b-2 font-medium transition ${
              activeTab === 'received'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Received ({requests.filter(r => r.owner.id === user?.id).length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-6 py-3 border-b-2 font-medium transition ${
              activeTab === 'sent'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Sent ({requests.filter(r => r.requester.id === user?.id).length})
          </button>
        </nav>
      </div>

      {/* Requests List */}
      {requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((request) => {
            const isReceived = activeTab === 'received';
            const otherUser = isReceived ? request.requester : request.owner;

            return (
              <div key={request.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* User Avatar */}
                    {otherUser.profilePicture ? (
                      <img
                        src={`http://127.0.0.1:3001${otherUser.profilePicture}`}
                        alt={otherUser.firstName}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-500" />
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900">
                          {otherUser.firstName} {otherUser.lastName}
                        </p>
                        {getStatusBadge(request.status)}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {isReceived ? 'wants to borrow' : 'borrowing'} <span className="font-medium">{request.gearItem.name}</span>
                      </p>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDateTime(request.startAt)} - {formatDateTime(request.endAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {request.campground.name}
                        </div>
                      </div>

                      {request.message && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">"{request.message}"</p>
                        </div>
                      )}

                      {request.responseMessage && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-1">Response:</p>
                          <p className="text-sm text-blue-700">{request.responseMessage}</p>
                        </div>
                      )}

                      {request.status === 'PROPOSED' && request.proposedStartAt && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                          <p className="text-sm font-medium text-yellow-900 mb-1">Proposed Times:</p>
                          <p className="text-sm text-yellow-700">
                            {formatDateTime(request.proposedStartAt)} - {formatDateTime(request.proposedEndAt!)}
                          </p>
                        </div>
                      )}

                      {request.gearItem.rulesText && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-900 mb-1">Borrowing Rules:</p>
                          <p className="text-sm text-gray-700">{request.gearItem.rulesText}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  {/* Received Requests */}
                  {isReceived && request.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleApprove(request.id, false)}
                        className="btn btn-primary flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setProposedTimes({
                            startAt: request.startAt.split('T')[0] + 'T' + request.startAt.split('T')[1].substring(0, 5),
                            endAt: request.endAt.split('T')[0] + 'T' + request.endAt.split('T')[1].substring(0, 5),
                          });
                          setShowResponseModal(true);
                        }}
                        className="btn btn-secondary"
                      >
                        Propose Times
                      </button>
                      <button
                        onClick={() => handleDecline(request.id)}
                        className="btn btn-secondary text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Decline
                      </button>
                    </>
                  )}

                  {isReceived && request.status === 'APPROVED' && (
                    <button
                      onClick={() => handleComplete(request.id)}
                      className="btn btn-primary flex-1"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Returned
                    </button>
                  )}

                  {/* Sent Requests */}
                  {!isReceived && request.status === 'PENDING' && (
                    <button
                      onClick={() => handleCancel(request.id)}
                      className="btn btn-secondary text-red-600 hover:bg-red-50"
                    >
                      Cancel Request
                    </button>
                  )}

                  {!isReceived && request.status === 'PROPOSED' && (
                    <>
                      <button
                        onClick={() => handleAcceptProposal(request.id)}
                        className="btn btn-primary flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Accept Proposed Times
                      </button>
                      <button
                        onClick={() => handleCancel(request.id)}
                        className="btn btn-secondary text-red-600 hover:bg-red-50"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {activeTab === 'received'
              ? 'No borrow requests received yet'
              : 'No borrow requests sent yet'}
          </p>
        </div>
      )}

      {/* Propose Times Modal */}
      {showResponseModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Propose New Times</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={proposedTimes.startAt}
                  onChange={(e) => setProposedTimes({ ...proposedTimes, startAt: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={proposedTimes.endAt}
                  onChange={(e) => setProposedTimes({ ...proposedTimes, endAt: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message (Optional)
                </label>
                <textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="Explain why you're proposing different times..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => handleApprove(selectedRequest.id, true)}
                  className="btn btn-primary flex-1"
                >
                  Send Proposal
                </button>
                <button
                  onClick={() => {
                    setShowResponseModal(false);
                    setSelectedRequest(null);
                    setResponseMessage('');
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
