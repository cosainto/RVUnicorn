import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface GateState {
  isOpen: boolean;
  trigger: string;
  context: Record<string, string>;
}

export function useGate() {
  const { user } = useAuth();
  const [gateState, setGateState] = useState<GateState>({
    isOpen: false,
    trigger: 'default',
    context: {},
  });

  const requireAuth = useCallback(
    (trigger: string, context: Record<string, string>, callback: () => void) => {
      if (user) {
        callback();
      } else {
        setGateState({ isOpen: true, trigger, context });
      }
    },
    [user]
  );

  const closeGate = useCallback(() => {
    setGateState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    requireAuth,
    gateModalProps: {
      isOpen: gateState.isOpen,
      onClose: closeGate,
      trigger: gateState.trigger,
      context: gateState.context,
    },
  };
}
