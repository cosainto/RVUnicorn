import { useState, useEffect } from 'react';
import { 
  Activity, Loader2, AlertTriangle, Clock, 
  Shield, Key, Mail, Eye, UserX, Trash2,
  LogIn, AlertCircle, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '../services/api';

interface ActivityLog {
  id: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  PASSWORD_CHANGED: { 
    label: 'Password changed', 
    icon: Key, 
    color: 'text-blue-600 bg-blue-100' 
  },
  PASSWORD_CHANGE_FAILED: { 
    label: 'Password change failed', 
    icon: AlertCircle, 
    color: 'text-red-600 bg-red-100' 
  },
  EMAIL_CHANGED: { 
    label: 'Email changed', 
    icon: Mail, 
    color: 'text-purple-600 bg-purple-100' 
  },
  PRIVACY_UPDATED: { 
    label: 'Privacy settings updated', 
    icon: Eye, 
    color: 'text-amber-600 bg-amber-100' 
  },
  USER_BLOCKED: { 
    label: 'Blocked a user', 
    icon: UserX, 
    color: 'text-red-600 bg-red-100' 
  },
  USER_UNBLOCKED: { 
    label: 'Unblocked a user', 
    icon: UserX, 
    color: 'text-green-600 bg-green-100' 
  },
  ACCOUNT_DELETION_REQUESTED: { 
    label: 'Account deletion requested', 
    icon: Trash2, 
    color: 'text-red-600 bg-red-100' 
  },
  ACCOUNT_DELETION_CANCELLED: { 
    label: 'Account deletion cancelled', 
    icon: Trash2, 
    color: 'text-green-600 bg-green-100' 
  },
  LOGIN: { 
    label: 'Logged in', 
    icon: LogIn, 
    color: 'text-green-600 bg-green-100' 
  },
  LOGIN_FAILED: { 
    label: 'Failed login attempt', 
    icon: AlertCircle, 
    color: 'text-red-600 bg-red-100' 
  },
  PROFILE_UPDATED: { 
    label: 'Profile updated', 
    icon: Settings, 
    color: 'text-blue-600 bg-blue-100' 
  },
  VERIFICATION_REQUESTED: { 
    label: 'Verification requested', 
    icon: Mail, 
    color: 'text-amber-600 bg-amber-100' 
  },
  '2FA_ENABLED': { 
    label: 'Two-factor authentication enabled', 
    icon: Shield, 
    color: 'text-green-600 bg-green-100' 
  },
  '2FA_DISABLED': { 
    label: 'Two-factor authentication disabled', 
    icon: Shield, 
    color: 'text-red-600 bg-red-100' 
  }
};

export default function AccountActivityLogPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchActivities();
  }, [page]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/privacy/activity-log', {
        params: { limit, offset: page * limit }
      });
      setActivities(data.activities);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching activity log:', err);
      setError('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const parseUserAgent = (ua?: string) => {
    if (!ua) return 'Unknown device';
    
    // Simple parsing - in production use a proper UA parser
    if (ua.includes('Mobile')) return '📱 Mobile device';
    if (ua.includes('Windows')) return '💻 Windows';
    if (ua.includes('Mac')) return '💻 Mac';
    if (ua.includes('Linux')) return '💻 Linux';
    return '💻 Computer';
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Activity</h1>
          <p className="text-gray-600">Review recent activity on your account</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Keep your account secure</p>
            <p className="text-blue-700">
              Review this activity regularly. If you see anything suspicious, 
              change your password immediately.
            </p>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No account activity recorded yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activities.map((activity) => {
              const config = ACTION_CONFIG[activity.action] || {
                label: activity.action.replace(/_/g, ' ').toLowerCase(),
                icon: Activity,
                color: 'text-gray-600 bg-gray-100'
              };
              const Icon = config.icon;
              
              let details = null;
              if (activity.details) {
                try {
                  details = JSON.parse(activity.details);
                } catch {}
              }

              return (
    <><style>{`.pg-dark{background:#0F1C35!important;color:#F5F0E8!important;min-height:100vh}.pg-dark .bg-white{background:rgba(15,28,53,0.95)!important;color:#F5F0E8!important}.pg-dark .bg-gray-50,.pg-dark .bg-gray-100{background:#1B2E50!important}.pg-dark .bg-gray-200,.pg-dark .bg-gray-300{background:rgba(27,46,80,0.6)!important}.pg-dark .text-gray-900,.pg-dark .text-gray-800{color:#F5F0E8!important}.pg-dark .text-gray-700,.pg-dark .text-gray-600{color:rgba(245,240,232,0.65)!important}.pg-dark .text-gray-500,.pg-dark .text-gray-400{color:rgba(245,240,232,0.4)!important}.pg-dark .text-gray-300{color:rgba(245,240,232,0.25)!important}.pg-dark .border-gray-100,.pg-dark .border-gray-200,.pg-dark .border-gray-300{border-color:rgba(232,168,56,0.08)!important}.pg-dark .shadow-lg,.pg-dark .shadow-xl{box-shadow:0 4px 20px rgba(0,0,0,0.4)!important}.pg-dark .shadow-md,.pg-dark .shadow-sm,.pg-dark .shadow{box-shadow:0 2px 10px rgba(0,0,0,0.3)!important}.pg-dark input,.pg-dark textarea,.pg-dark select{background:#1B2E50!important;border-color:rgba(232,168,56,0.12)!important;color:#F5F0E8!important}.pg-dark .btn-primary,.pg-dark .bg-primary-600,.pg-dark .bg-primary-500{background:#E8622A!important;color:white!important}.pg-dark .btn-secondary{background:transparent!important;border-color:rgba(255,255,255,0.1)!important;color:rgba(245,240,232,0.5)!important}.pg-dark .text-primary-600,.pg-dark .text-primary-700{color:#E8A838!important}.pg-dark .hover\:bg-gray-50:hover,.pg-dark .hover\:bg-gray-100:hover{background:rgba(27,46,80,0.6)!important}.pg-dark .bg-green-50,.pg-dark .bg-blue-50,.pg-dark .bg-amber-50,.pg-dark .bg-red-50,.pg-dark .bg-purple-50,.pg-dark .bg-orange-50,.pg-dark .bg-yellow-50{background:rgba(27,46,80,0.4)!important}.pg-dark .bg-primary-50,.pg-dark .bg-primary-100{background:rgba(232,168,56,0.08)!important}`}</style>

                <li key={activity.id} className="p-4 hover:bg-gray-50">
                  <div className="pg-dark flex items-start gap-4">
                    <div className={`p-2 rounded-full ${config.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{config.label}</p>
                      
                      {details && (
                        <p className="text-sm text-gray-600 mt-1">
                          {details.newEmail && `New email: ${details.newEmail}`}
                          {details.blockedUserId && 'User blocked'}
                          {details.unblockedUserId && 'User unblocked'}
                          {details.updatedFields && `Updated: ${details.updatedFields.join(', ')}`}
                          {details.reason && `Reason: ${details.reason}`}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(activity.createdAt)}
                        </span>
                        {activity.ipAddress && (
                          <span>IP: {activity.ipAddress}</span>
                        )}
                        <span>{parseUserAgent(activity.userAgent)}</span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
