import React from 'react';
import { Megaphone, Check } from 'lucide-react';

interface CrossPostToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  message: string;
  onMessageChange: (message: string) => void;
  showMessageInput?: boolean;
  label?: string;
}

export const CrossPostToggle: React.FC<CrossPostToggleProps> = ({
  enabled,
  onToggle,
  message,
  onMessageChange,
  showMessageInput = true,
  label = "Also share to Basecamp"
}) => {
  return (
    <div className="space-y-3">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
          enabled 
            ? 'border-green-300 bg-green-50' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <Megaphone size={20} className={enabled ? 'text-green-600' : 'text-gray-400'} />
          <span className={enabled ? 'text-green-700 font-medium' : 'text-gray-600'}>
            {label}
          </span>
        </div>
        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          enabled ? 'bg-green-500 border-green-500' : 'border-gray-300'
        }`}>
          {enabled && <Check size={14} className="text-white" />}
        </div>
      </button>

      {/* Message Input (when enabled) */}
      {enabled && showMessageInput && (
        <div className="pl-4 border-l-2 border-green-200">
          <textarea
            placeholder="Add a custom message for basecamp (optional)"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave blank to use the caption/description
          </p>
        </div>
      )}
    </div>
  );
};

export default CrossPostToggle;
