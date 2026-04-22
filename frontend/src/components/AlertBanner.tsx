import { useEffect, useState } from 'react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';

interface AlertBannerProps {
  id: string;
  urgency: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: (id: string) => void;
}

const urgencyStyles = {
  INFO: {
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-300',
    bodyColor: 'text-blue-200/70',
  },
  WARNING: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    titleColor: 'text-amber-300',
    bodyColor: 'text-amber-200/70',
  },
  CRITICAL: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    iconColor: 'text-red-400',
    titleColor: 'text-red-300',
    bodyColor: 'text-red-200/70',
  },
};

export default function AlertBanner({ id, urgency, title, body, actionLabel, onAction, onDismiss }: AlertBannerProps) {
  const [visible, setVisible] = useState(false);
  const [pulse, setPulse] = useState(false);
  const styles = urgencyStyles[urgency];

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));

    // Pulse animation for CRITICAL
    if (urgency === 'CRITICAL') {
      setPulse(true);
      // Try to vibrate on mobile
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }

    // Auto-dismiss INFO after 30s
    if (urgency === 'INFO') {
      const timer = setTimeout(() => handleDismiss(), 30000);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(() => onDismiss(id), 300);
  }

  return (
    <div
      className={`${styles.bg} ${styles.border} border rounded-xl p-3 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'} ${pulse ? 'animate-pulse' : ''}`}
      style={{ animationDuration: pulse ? '1.5s' : undefined }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className={`${styles.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-bold ${styles.titleColor}`}>{title}</p>
            <button onClick={handleDismiss} className="text-white/30 hover:text-white/60 transition flex-shrink-0">
              <X size={14} />
            </button>
          </div>
          <p className={`text-xs mt-0.5 ${styles.bodyColor}`}>{body}</p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className={`mt-2 text-xs font-semibold ${styles.iconColor} flex items-center gap-1 hover:brightness-110 transition`}
            >
              {actionLabel} <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
