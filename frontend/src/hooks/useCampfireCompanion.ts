import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const CHARACTERS = ['HITCH', 'WALLET', 'WALTER', 'SCOUT'] as const;

interface CompanionState {
  active: boolean;
  character: string | null;
  characterImage: string | null;
  messages: { role: 'user' | 'assistant'; content: string; character?: string }[];
  isThinking: boolean;
  isLurkMode: boolean;
  isQuietMode: boolean;
  openerSent: boolean;
  userResponded: boolean;
}

export function useCampfireCompanion(userId: string | undefined, campgroundId: string, activeUserCount: number) {
  const [state, setState] = useState<CompanionState>({
    active: false, character: null, characterImage: null, messages: [],
    isThinking: false, isLurkMode: false, isQuietMode: false,
    openerSent: false, userResponded: false,
  });

  const lurkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const openerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const quietCooldownRef = useRef<number>(0);
  const conversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Trigger companion on low user count
  useEffect(() => {
    if (!userId || !campgroundId) return;
    if (activeUserCount >= 3) {
      // Quiet mode — companion steps back
      if (state.active && !state.isQuietMode) {
        setState(s => ({ ...s, isQuietMode: true }));
        quietCooldownRef.current = Date.now() + 2 * 60 * 1000; // 2 min cooldown
      }
      return;
    }

    // If was in quiet mode and count dropped, check cooldown
    if (state.isQuietMode && Date.now() < quietCooldownRef.current) return;
    if (state.isQuietMode) setState(s => ({ ...s, isQuietMode: false }));

    // Don't re-trigger if already active or lurk mode
    if (state.openerSent || state.isLurkMode) return;

    // 8 second delay before companion appears
    openerTimerRef.current = setTimeout(async () => {
      try {
        const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        setState(s => ({ ...s, isThinking: true }));

        const { data } = await api.post('/chat/companion-opener', { userId, campgroundId, character });
        if (!data.enabled) { setState(s => ({ ...s, isThinking: false })); return; }

        setState(s => ({
          ...s, active: true, character: data.character, characterImage: data.image,
          messages: [{ role: 'assistant', content: data.message, character: data.character }],
          isThinking: false, openerSent: true,
        }));
        conversationRef.current = [{ role: 'assistant', content: data.message }];

        // Start lurk mode timer — 15 seconds without response
        lurkTimerRef.current = setTimeout(() => {
          setState(s => {
            if (!s.userResponded) return { ...s, isLurkMode: true };
            return s;
          });
        }, 15000);
      } catch { setState(s => ({ ...s, isThinking: false })); }
    }, 8000);

    return () => { if (openerTimerRef.current) clearTimeout(openerTimerRef.current); };
  }, [userId, campgroundId, activeUserCount]);

  // Send user message to companion
  const sendToCompanion = useCallback(async (userMessage: string) => {
    if (state.isLurkMode || state.isQuietMode || !state.character) return null;

    // Clear lurk timer
    if (lurkTimerRef.current) { clearTimeout(lurkTimerRef.current); lurkTimerRef.current = null; }

    // Check for @mention to switch character
    let targetCharacter = state.character;
    const mentionMatch = userMessage.match(/@(Hitch|Wallet|Walter|Scout)/i);
    if (mentionMatch) {
      targetCharacter = mentionMatch[1].toUpperCase();
    }

    setState(s => ({
      ...s, userResponded: true, isThinking: true,
      messages: [...s.messages, { role: 'user', content: userMessage }],
    }));
    conversationRef.current.push({ role: 'user', content: userMessage });

    try {
      const { data } = await api.post('/chat/companion-reply', {
        userId, campgroundId, character: targetCharacter,
        conversationHistory: conversationRef.current.slice(-10),
        userMessage,
      });

      conversationRef.current.push({ role: 'assistant', content: data.message });
      setState(s => ({
        ...s, isThinking: false,
        messages: [...s.messages, { role: 'assistant', content: data.message, character: data.character }],
      }));

      return data;
    } catch {
      setState(s => ({ ...s, isThinking: false }));
      return null;
    }
  }, [state.character, state.isLurkMode, state.isQuietMode, userId, campgroundId]);

  const dismissQuietMode = useCallback(() => {
    setState(s => ({ ...s, isQuietMode: false }));
  }, []);

  return { ...state, sendToCompanion, dismissQuietMode };
}
