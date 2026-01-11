import { useState } from 'react';
import { UserX, Loader2, Shield, MoreHorizontal } from 'lucide-react';
import api from '../services/api';

interface BlockUserButtonProps {
  userId: string;
  username: string;
  isBlocked?: boolean;
  variant?: 'button' | 'menu-item' | 'icon';
  onBlock?: () => void;
  onUnblock?: () => void;
}

export default function BlockUserButton({ 
  userId, 
  username, 
  isBlocked = false,
  variant = 'button',
  onBlock,
  onUnblock
}: BlockUserButtonProps) {
  const [blocked, setBlocked] = useState(isBlocked);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleToggleBlock = async () => {
    const action = blocked ? 'unblock' : 'block';
    const confirmMessage = blocked 
      ? `Are you sure you want to unblock @${username}?`
      : `Are you sure you want to block @${username}? They will no longer be able to see your profile, send you friend requests, or message you.`;
    
    if (!confirm(confirmMessage)) return;

    setLoading(true);
    try {
      if (blocked) {
        await api.delete(`/privacy/block/${userId}`);
        setBlocked(false);
        onUnblock?.();
      } else {
        await api.post(`/privacy/block/${userId}`);
        setBlocked(true);
        onBlock?.();
      }
    } catch (err) {
      console.error(`Error ${action}ing user:`, err);
      alert(`Failed to ${action} user`);
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  // Icon-only variant (for profile headers)
  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggleBlock}
        disabled={loading}
        className={`p-2 rounded-full transition-colors ${
          blocked 
            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title={blocked ? 'Unblock user' : 'Block user'}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <UserX className="w-5 h-5" />
        )}
      </button>
    );
  }

  // Menu item variant (for dropdown menus)
  if (variant === 'menu-item') {
    return (
      <button
        onClick={handleToggleBlock}
        disabled={loading}
        className={`w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-100 ${
          blocked ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserX className="w-4 h-4" />
        )}
        {blocked ? `Unblock @${username}` : `Block @${username}`}
      </button>
    );
  }

  // Default button variant
  return (
    <button
      onClick={handleToggleBlock}
      disabled={loading}
      className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
        blocked
          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          : 'bg-red-50 text-red-600 hover:bg-red-100'
      }`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <UserX className="w-4 h-4" />
      )}
      {blocked ? 'Unblock' : 'Block'}
    </button>
  );
}

// Dropdown menu with block option
interface UserActionsMenuProps {
  userId: string;
  username: string;
  isBlocked?: boolean;
  onBlock?: () => void;
  onUnblock?: () => void;
}

export function UserActionsMenu({ 
  userId, 
  username, 
  isBlocked = false,
  onBlock,
  onUnblock
}: UserActionsMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [blocked, setBlocked] = useState(isBlocked);
  const [loading, setLoading] = useState(false);

  const handleToggleBlock = async () => {
    const action = blocked ? 'unblock' : 'block';
    const confirmMessage = blocked 
      ? `Are you sure you want to unblock @${username}?`
      : `Are you sure you want to block @${username}? They will no longer be able to see your profile, send you friend requests, or message you.`;
    
    if (!confirm(confirmMessage)) {
      setShowMenu(false);
      return;
    }

    setLoading(true);
    try {
      if (blocked) {
        await api.delete(`/privacy/block/${userId}`);
        setBlocked(false);
        onUnblock?.();
      } else {
        await api.post(`/privacy/block/${userId}`);
        setBlocked(true);
        onBlock?.();
      }
    } catch (err) {
      console.error(`Error ${action}ing user:`, err);
      alert(`Failed to ${action} user`);
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <MoreHorizontal className="w-5 h-5 text-gray-500" />
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)} 
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={handleToggleBlock}
              disabled={loading}
              className={`w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 ${
                blocked ? 'text-gray-700' : 'text-red-600'
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : blocked ? (
                <Shield className="w-4 h-4" />
              ) : (
                <UserX className="w-4 h-4" />
              )}
              {blocked ? 'Unblock User' : 'Block User'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
