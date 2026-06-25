import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Users, MapPin, Zap, Bell, X, Send, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════
interface Toast {
  id: string;
  type: string;
  content: string;
  link?: string;
  category: string;
  actorName?: string;
  actorAvatar?: string;
  actorId?: string;
  metadata?: any;
  createdAt: string;
  removing?: boolean;
}

interface LocalToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
  removing?: boolean;
}

interface ToastContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  addToast: (notification: any) => void;
  dismissToast: (id: string) => void;
  addLocalToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType>({
  soundEnabled: true,
  toggleSound: () => {},
  addToast: () => {},
  dismissToast: () => {},
  addLocalToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// ═══════════════════════════════════════════════════════════════
// Sound Helper — gentle notification chime using Web Audio API
// ═══════════════════════════════════════════════════════════════
let audioCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;

    // Create a gentle two-tone chime
    const now = ctx.currentTime;

    // First note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 880; // A5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second note (slightly delayed, higher)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1174.66; // D6
    gain2.gain.setValueAtTime(0.06, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.4);
  } catch (e) {
    // Audio not supported — silent fail
  }
}

// ═══════════════════════════════════════════════════════════════
// Category styling
// ═══════════════════════════════════════════════════════════════
function getCategoryStyle(category: string) {
  switch (category) {
    case 'MESSAGE': return { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', accent: 'bg-blue-500' };
    case 'FRIEND': return { icon: Users, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', accent: 'bg-purple-500' };
    case 'CAMPGROUND': return { icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', accent: 'bg-emerald-500' };
    case 'SYSTEM': return { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', accent: 'bg-amber-500' };
    default: return { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', accent: 'bg-gray-500' };
  }
}

// ═══════════════════════════════════════════════════════════════
// Toast Component
// ═══════════════════════════════════════════════════════════════
function ToastItem({ toast, onDismiss, onQuickReply }: { toast: Toast; onDismiss: (id: string) => void; onQuickReply?: (toast: Toast, text: string) => void }) {
  const style = getCategoryStyle(toast.category);
  const Icon = style.icon;
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (replyOpen) inputRef.current?.focus();
  }, [replyOpen]);

  return (
    <div
      className={`relative w-80 bg-white rounded-xl shadow-2xl border ${style.border} overflow-hidden transition-all duration-300 ${
        toast.removing ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
      style={{ animation: toast.removing ? undefined : 'toastSlideIn 0.3s ease-out' }}
    >
      {/* Accent bar */}
      <div className={`absolute top-0 left-0 w-1 h-full ${style.accent}`} />

      <div className="flex items-start gap-3 p-3 pl-4">
        {/* Avatar or Icon */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${style.bg}`}>
          {toast.actorAvatar ? (
            <img src={toast.actorAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <Icon className={`w-4 h-4 ${style.color}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            to={toast.link || '#'}
            onClick={() => onDismiss(toast.id)}
            className="block"
          >
            <p className="text-sm font-medium text-gray-900 leading-snug">
              {toast.actorName && <span className="font-semibold">{toast.actorName} </span>}
              {toast.content}
            </p>
            {toast.metadata?.preview && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">"{toast.metadata.preview}"</p>
            )}
          </Link>

          {/* Quick reply for messages */}
          {toast.category === 'MESSAGE' && toast.actorId && (
            <>
              {!replyOpen ? (
                <button
                  onClick={() => setReplyOpen(true)}
                  className="text-[10px] text-blue-500 hover:text-blue-700 font-medium mt-1 flex items-center gap-0.5"
                >
                  <Send className="w-2.5 h-2.5" /> Quick Reply
                </button>
              ) : (
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && replyText.trim() && onQuickReply) {
                        onQuickReply(toast, replyText.trim());
                        onDismiss(toast.id);
                      }
                    }}
                    placeholder="Reply..."
                    className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => {
                      if (replyText.trim() && onQuickReply) {
                        onQuickReply(toast, replyText.trim());
                        onDismiss(toast.id);
                      }
                    }}
                    className="p-1 bg-blue-500 text-white rounded-md"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Close */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 p-0.5 text-gray-300 hover:text-gray-500 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="h-0.5 bg-gray-100">
        <div
          className={`h-full ${style.accent} opacity-40`}
          style={{ animation: 'progressShrink 6s linear forwards' }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Provider Component
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// Local Toast Component — for success/error/warning feedback
// ═══════════════════════════════════════════════════════════════
const LOCAL_TOAST_STYLES = {
  success: { bg: '#ecfdf5', border: '#86efac', accent: '#22c55e', icon: '\u2705', text: '#166534' },
  error:   { bg: '#fef2f2', border: '#fca5a5', accent: '#ef4444', icon: '\u274c', text: '#991b1b' },
  warning: { bg: '#fffbeb', border: '#fde68a', accent: '#f59e0b', icon: '\u26a0\ufe0f', text: '#92400e' },
};

function LocalToastItem({ toast, onDismiss }: { toast: LocalToast; onDismiss: (id: string) => void }) {
  const s = LOCAL_TOAST_STYLES[toast.type];
  return (
    <div
      className={`relative w-80 rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${toast.removing ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
      style={{ background: s.bg, border: `1px solid ${s.border}`, animation: toast.removing ? undefined : 'toastSlideIn 0.3s ease-out' }}
    >
      <div className="absolute top-0 left-0 w-1 h-full" style={{ background: s.accent }} />
      <div className="flex items-center gap-3 p-3 pl-4">
        <span className="text-lg flex-shrink-0">{s.icon}</span>
        <p className="text-sm font-medium flex-1" style={{ color: s.text }}>{toast.message}</p>
        <button onClick={() => onDismiss(toast.id)} className="flex-shrink-0 p-0.5 transition" style={{ color: s.text, opacity: 0.5 }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="h-0.5" style={{ background: s.border }}>
        <div className="h-full opacity-60" style={{ background: s.accent, animation: 'progressShrink 4s linear forwards' }} />
      </div>
    </div>
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [localToasts, setLocalToasts] = useState<LocalToast[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('notif-sound') !== 'off'; } catch { return true; }
  });
  const eventSourceRef = useRef<EventSource | null>(null);
  const addToastRef = useRef<((n: any) => void) | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('notif-sound', next ? 'on' : 'off'); } catch {}
      return next;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((notification: any) => {
    const toast: Toast = {
      id: notification.id || `toast-${Date.now()}`,
      type: notification.type,
      content: notification.content,
      link: notification.link,
      category: notification.category || 'SYSTEM',
      actorName: notification.actorName,
      actorAvatar: notification.actorAvatar,
      actorId: notification.actorId,
      metadata: notification.metadata,
      createdAt: notification.createdAt || new Date().toISOString(),
    };

    setToasts(prev => [toast, ...prev].slice(0, 5)); // Max 5 toasts

    if (soundEnabled) playNotificationSound();

    // Auto-dismiss after 6s
    setTimeout(() => dismissToast(toast.id), 6000);
  }, [soundEnabled, dismissToast]);

  const dismissLocalToast = useCallback((id: string) => {
    setLocalToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => setLocalToasts(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  const addLocalToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setLocalToasts(prev => [{ id, message, type }, ...prev].slice(0, 5));
    setTimeout(() => dismissLocalToast(id), 4000);
  }, [dismissLocalToast]);

  // Keep ref in sync so SSE handler always uses latest without reconnecting
  addToastRef.current = addToast;

  // SSE Connection for real-time notifications
  useEffect(() => {
    if (!user || !token) return;

    const baseUrl = (api.defaults?.baseURL || '').replace('/api', '');
    const url = `${baseUrl}/api/notifications/stream`;

    try {
      // Use fetch-based SSE since EventSource doesn't support custom headers
      const es = new EventSource(`${url}?token=${token}`);

      es.addEventListener('notification', (event) => {
        try {
          const notification = JSON.parse(event.data);
          addToastRef.current?.(notification);
        } catch {}
      });

      es.addEventListener('error', () => {
        // Close cleanly — do not retry infinitely
        es.close();
        eventSourceRef.current = null;
      });

      eventSourceRef.current = es;
    } catch {}

    return () => {
      eventSourceRef.current?.close();
    };
  }, [user, token]); // addToast intentionally excluded - using ref to avoid reconnects

  // Poll as fallback (every 30s)
  useEffect(() => {
    if (!user) return;
    let lastCheck = Date.now();

    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/notifications?limit=5');
        const notifs = data.notifications || data || [];
        const newOnes = notifs.filter((n: any) =>
          new Date(n.createdAt).getTime() > lastCheck && !n.read
        );
        newOnes.forEach((n: any) => addToastRef.current?.(n));
        lastCheck = Date.now();
      } catch {}
    }, 30000);

    return () => clearInterval(interval);
  }, [user]); // addToast intentionally excluded - using ref

  const handleQuickReply = async (toast: Toast, text: string) => {
    try {
      await api.post('/notifications/quick-reply', {
        notificationId: toast.id,
        recipientId: toast.actorId,
        content: text,
      });
    } catch (e) {
      console.error('Quick reply from toast failed:', e);
    }
  };

  return (
    <ToastContext.Provider value={{ soundEnabled, toggleSound, addToast, dismissToast, addLocalToast }}>
      {children}

      {/* Toast Container — bottom right */}
      {(toasts.length > 0 || localToasts.length > 0) && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2">
          {localToasts.map(lt => (
            <LocalToastItem key={lt.id} toast={lt} onDismiss={dismissLocalToast} />
          ))}
          {toasts.map(toast => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
              onQuickReply={handleQuickReply}
            />
          ))}

          {/* Sound toggle */}
          {toasts.length > 0 && (
            <button
              onClick={toggleSound}
              className="self-end p-1.5 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-200 text-gray-400 hover:text-gray-600 transition"
              title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes progressShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
