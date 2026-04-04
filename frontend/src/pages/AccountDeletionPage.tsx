import { useState, useEffect } from 'react';
import { 
  Trash2, Loader2, AlertTriangle, Shield, 
  Clock, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import api from '../services/api';

interface DeletionStatus {
  hasPendingDeletion: boolean;
  requestedAt?: string;
  scheduledDeletionDate?: string;
  daysRemaining?: number;
}

export default function AccountDeletionPage() {
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state for deletion request
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await api.get('/account/deletion-status');
      setStatus(data);
    } catch (err) {
      console.error('Error fetching deletion status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (confirmText !== 'DELETE MY ACCOUNT') {
      setError('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      const { data } = await api.post('/account/request-deletion', {
        password,
        reason,
        feedback
      });
      
      setSuccess('Account deletion scheduled');
      setStatus({
        hasPendingDeletion: true,
        scheduledDeletionDate: data.scheduledDeletionDate,
        daysRemaining: data.daysRemaining
      });
      setPassword('');
      setConfirmText('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request deletion');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!confirm('Are you sure you want to cancel the account deletion?')) return;

    setProcessing(true);
    setError(null);
    
    try {
      await api.post('/account/cancel-deletion');
      setSuccess('Account deletion cancelled');
      setStatus({ hasPendingDeletion: false });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel deletion');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <><style>{`.pg-dark{background:#0F1C35!important;color:#F5F0E8!important;min-height:100vh}.pg-dark .bg-white{background:rgba(15,28,53,0.95)!important;color:#F5F0E8!important}.pg-dark .bg-gray-50,.pg-dark .bg-gray-100{background:#1B2E50!important}.pg-dark .bg-gray-200,.pg-dark .bg-gray-300{background:rgba(27,46,80,0.6)!important}.pg-dark .text-gray-900,.pg-dark .text-gray-800{color:#F5F0E8!important}.pg-dark .text-gray-700,.pg-dark .text-gray-600{color:rgba(245,240,232,0.65)!important}.pg-dark .text-gray-500,.pg-dark .text-gray-400{color:rgba(245,240,232,0.4)!important}.pg-dark .text-gray-300{color:rgba(245,240,232,0.25)!important}.pg-dark .border-gray-100,.pg-dark .border-gray-200,.pg-dark .border-gray-300{border-color:rgba(232,168,56,0.08)!important}.pg-dark .shadow-lg,.pg-dark .shadow-xl{box-shadow:0 4px 20px rgba(0,0,0,0.4)!important}.pg-dark .shadow-md,.pg-dark .shadow-sm,.pg-dark .shadow{box-shadow:0 2px 10px rgba(0,0,0,0.3)!important}.pg-dark input,.pg-dark textarea,.pg-dark select{background:#1B2E50!important;border-color:rgba(232,168,56,0.12)!important;color:#F5F0E8!important}.pg-dark .btn-primary,.pg-dark .bg-primary-600,.pg-dark .bg-primary-500{background:#E8622A!important;color:white!important}.pg-dark .btn-secondary{background:transparent!important;border-color:rgba(255,255,255,0.1)!important;color:rgba(245,240,232,0.5)!important}.pg-dark .text-primary-600,.pg-dark .text-primary-700{color:#E8A838!important}.pg-dark .hover\:bg-gray-50:hover,.pg-dark .hover\:bg-gray-100:hover{background:rgba(27,46,80,0.6)!important}.pg-dark .bg-green-50,.pg-dark .bg-blue-50,.pg-dark .bg-amber-50,.pg-dark .bg-red-50,.pg-dark .bg-purple-50,.pg-dark .bg-orange-50,.pg-dark .bg-yellow-50{background:rgba(27,46,80,0.4)!important}.pg-dark .bg-primary-50,.pg-dark .bg-primary-100{background:rgba(232,168,56,0.08)!important}`}</style>

    <div className="pg-dark max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Trash2 className="w-8 h-8 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delete Account</h1>
          <p className="text-gray-600">Permanently delete your RVUnicorn account</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Pending Deletion Banner */}
      {status?.hasPendingDeletion && (
        <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-full">
              <Clock className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800">
                Account Deletion Scheduled
              </h3>
              <p className="text-red-700 mt-1">
                Your account will be permanently deleted on{' '}
                <strong>
                  {new Date(status.scheduledDeletionDate!).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </strong>
              </p>
              <p className="text-red-600 text-sm mt-2">
                {status.daysRemaining} day{status.daysRemaining !== 1 ? 's' : ''} remaining
              </p>
              
              <button
                onClick={handleCancelDeletion}
                disabled={processing}
                className="mt-4 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Cancel Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800">Before you delete</h3>
            <p className="text-amber-700 mt-1 text-sm">
              Deleting your account will permanently remove:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-700">
              <li>• All your posts, photos, and albums</li>
              <li>• Your recipes and saved recipes</li>
              <li>• Your travel map and state visits</li>
              <li>• Your RV showcase and gear list</li>
              <li>• Your friendships and group memberships</li>
              <li>• All comments and reviews you've made</li>
            </ul>
            <p className="text-amber-800 font-medium mt-3">
              This action cannot be undone.
            </p>
          </div>
        </div>
      </div>

      {/* Grace Period Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-800">30-Day Grace Period</h3>
            <p className="text-blue-700 mt-1 text-sm">
              After requesting deletion, you have 30 days to change your mind. 
              During this time, you can log in and cancel the deletion request. 
              After 30 days, your account will be permanently deleted.
            </p>
          </div>
        </div>
      </div>

      {/* Deletion Form */}
      {!status?.hasPendingDeletion && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Request Account Deletion
          </h2>

          <form onSubmit={handleRequestDeletion} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Why are you leaving? (optional)
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Select a reason...</option>
                <option value="not_using">I don't use RVUnicorn anymore</option>
                <option value="privacy">Privacy concerns</option>
                <option value="experience">Bad experience</option>
                <option value="other_platform">Using a different platform</option>
                <option value="temporary">Taking a break from camping</option>
                <option value="other">Other reason</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional feedback (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Tell us how we could improve..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter your password to confirm
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your current password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type "DELETE MY ACCOUNT" to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                required
                placeholder="DELETE MY ACCOUNT"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <button
              type="submit"
              disabled={processing || !password || confirmText !== 'DELETE MY ACCOUNT'}
              className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  Request Account Deletion
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
    </>
  );
}
