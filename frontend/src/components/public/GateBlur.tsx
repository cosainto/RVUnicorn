import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import GateModal from './GateModal';

interface Props {
  trigger: string;
  context?: Record<string, string>;
  label?: string;
  children: React.ReactNode;
}

export default function GateBlur({ trigger, context = {}, label, children }: Props) {
  const { user } = useAuth();
  const [showGate, setShowGate] = useState(false);

  // Authenticated users see content normally
  if (user) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred content */}
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          onClick={() => setShowGate(true)}
          className="px-5 py-3 rounded-xl text-sm font-bold transition hover:brightness-110 shadow-lg"
          style={{ background: '#E8A838', color: '#0F1C35' }}
        >
          {label || 'Sign up to see more'}
        </button>
      </div>

      <GateModal
        isOpen={showGate}
        onClose={() => setShowGate(false)}
        trigger={trigger}
        context={context}
      />
    </div>
  );
}
