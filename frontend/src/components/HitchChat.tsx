import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ChevronDown, Clock, Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Message { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date; }
interface ConvoSummary { id: string; title: string; summary: string; updatedAt: string; }

export default function HitchChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [starters, setStarters] = useState<string[]>([]);
  const [showBubble, setShowBubble] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ConvoSummary[]>([]);
  const [prefCount, setPrefCount] = useState(0);
  const [activeReminders, setActiveReminders] = useState<any[]>([]);
  const [showReminder, setShowReminder] = useState<any>(null);
  const [showReminderSchedule, setShowReminderSchedule] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (user && isOpen && messages.length === 0) {
      api.get('/hitch/starters').then(({ data }) => setStarters(data.starters)).catch(() => {});
      api.get('/hitch/preferences').then(({ data }) => setPrefCount(data.preferences?.length || 0)).catch(() => {});
    }
  }, [user, isOpen, messages.length]);

  useEffect(() => {
    if (!user) return;
    const scanAndFetch = async () => {
      try {
        await api.post('/hitch/reminders/scan');
        const { data } = await api.get('/hitch/reminders/active');
        setActiveReminders(data.reminders || []);
        if (data.reminders?.length > 0 && !showReminder) setShowReminder(data.reminders[0]);
      } catch {}
    };
    scanAndFetch();
    const interval = setInterval(scanAndFetch, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 300); }, [isOpen]);
  useEffect(() => { const t = setTimeout(() => setShowBubble(false), 10000); return () => clearTimeout(t); }, []);

  const handleReminderAction = async (reminder: any, action: string) => {
    if (action === 'snooze') {
      await api.post(`/hitch/reminders/${reminder.id}/snooze`).catch(() => {});
      setActiveReminders(prev => prev.filter(r => r.id !== reminder.id));
      setShowReminder(null); setShowReminderSchedule(false);
    } else if (action === 'dismiss') {
      await api.post(`/hitch/reminders/${reminder.id}/dismiss`).catch(() => {});
      setActiveReminders(prev => prev.filter(r => r.id !== reminder.id));
      setShowReminder(null); setShowReminderSchedule(false);
    } else if (action === 'ignore-forever') {
      await api.post(`/hitch/reminders/${reminder.id}/ignore-forever`).catch(() => {});
      setActiveReminders(prev => prev.filter(r => r.id !== reminder.id));
      setShowReminder(null); setShowReminderSchedule(false);
    } else if (action === 'respond') {
      setShowReminder(null); setShowReminderSchedule(false); setIsOpen(true);
      setMessages([{ id: `system-${Date.now()}`, role: 'assistant', content: `${reminder.message}\n\n💡 Just type your answer and I'll update it for you!`, timestamp: new Date() }]);
      (window as any).__hitchActiveReminder = reminder;
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: content.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]); setInput(''); setIsLoading(true); setStarters([]);
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      const apiMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const token = localStorage.getItem('token');
      const baseURL = api.defaults.baseURL || 'http://localhost:3001/api';
      const response = await fetch(`${baseURL}/hitch/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messages: apiMsgs, conversationId }),
      });
      if (!response.ok) throw new Error('Failed');
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) { fullText += parsed.text; setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)); }
              if (parsed.conversationId) setConversationId(parsed.conversationId);
            } catch {}
          }
        }
      }

      // Parse update commands
      const UPDATE_PATTERN = /\[UPDATE:(\w+):(\w+):(\w+):([^\]]+)\]/g;
      let match;
      while ((match = UPDATE_PATTERN.exec(fullText)) !== null) {
        let [, entityType, entityId, field, value] = match;
        if (entityId === 'CURRENT_USER' && user) entityId = (user as any).id;
        const reminder = (window as any).__hitchActiveReminder;
        try {
          await api.post('/hitch/reminders/update', { entityType, entityId, field, value, reminderId: reminder?.id });
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content.replace(match![0], '').trim() } : m));
        } catch {}
      }
      (window as any).__hitchActiveReminder = null;

    } catch (error) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Sorry, I hit a bump in the road! 🚧 Please try again.' } : m));
    } finally { setIsLoading(false); }
  }, [messages, isLoading, conversationId, user]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };

  const clearChat = () => {
    setMessages([]); setConversationId(null); setStarters([]); setShowHistory(false); setShowReminderSchedule(false);
    api.get('/hitch/starters').then(({ data }) => setStarters(data.starters)).catch(() => {});
  };

  const loadHistory = async () => { try { const { data } = await api.get('/hitch/history'); setHistory(data.conversations || []); setShowHistory(true); } catch { setShowHistory(true); } };

  const loadConversation = async (cid: string) => {
    try { const { data } = await api.get(`/hitch/conversation/${cid}`); setMessages(data.conversation.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.createdAt) }))); setConversationId(cid); setShowHistory(false); }
    catch { alert('Failed to load'); }
  };

  const fmt = (t: string) => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>').replace(/\n/g, '<br/>');

  if (!user) return null;

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
          {showBubble && (
            <div className="animate-fade-in bg-white rounded-2xl shadow-lg px-4 py-3 max-w-[200px] relative">
              <button onClick={() => setShowBubble(false)} className="absolute -top-2 -right-2 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-300 text-xs">×</button>
              <p className="text-sm text-gray-700">Hey! I'm <strong>Hitch</strong> 🦄 Need help finding a campsite?</p>
              <div className="absolute bottom-3 right-[-8px] w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-white"></div>
            </div>
          )}
          <button onClick={() => setIsOpen(true)} className="group relative w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110" title="Chat with Hitch">
            <img src="/hitch.png" alt="Hitch" className="w-10 h-10 rounded-full object-cover" />
            {activeReminders.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{activeReminders.length}</span>}
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 animate-slide-up">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center overflow-hidden"><img src="/hitch.png" alt="Hitch" className="w-10 h-10 rounded-full object-cover" /></div>
              <div><h3 className="text-white font-bold text-base">Hitch</h3><p className="text-white/80 text-xs flex items-center gap-1">Your RV Trail Guide{prefCount > 0 && <span className="inline-flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]"><Brain className="w-2.5 h-2.5" />{prefCount}</span>}</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={loadHistory} className="text-white/70 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition" title="History"><Clock className="w-4 h-4" /></button>
              {messages.length > 0 && <button onClick={clearChat} className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition">New</button>}
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition"><ChevronDown className="w-5 h-5" /></button>
            </div>
          </div>

          {showHistory && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><h4 className="font-semibold text-gray-800 text-sm">Past Conversations</h4><button onClick={() => setShowHistory(false)} className="text-xs text-orange-600 hover:text-orange-700">Back</button></div>
              {history.length === 0 ? <div className="text-center py-12 text-gray-400"><Clock className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No past conversations</p></div> : (
                <div className="divide-y divide-gray-50">{history.map(c => (
                  <button key={c.id} onClick={() => loadConversation(c.id)} className="w-full text-left px-4 py-3 hover:bg-orange-50 transition">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.title || 'Chat with Hitch'}</p>
                    {c.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.summary}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(c.updatedAt).toLocaleDateString()}</p>
                  </button>
                ))}</div>
              )}
            </div>
          )}

          {!showHistory && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
                {messages.length === 0 && (
                  <div className="text-center py-6">
                    <img src="/hitch.png" alt="Hitch" className="w-16 h-16 rounded-full object-cover mx-auto mb-3" />
                    <h4 className="text-lg font-bold text-gray-900 mb-1">Hey{user ? `, ${(user as any).firstName || ''}` : ''}! I'm Hitch</h4>
                    <p className="text-gray-500 text-sm mb-5">Your AI campground guide. Ask me anything!</p>
                    {prefCount > 0 && <div className="flex items-center justify-center gap-1.5 mb-4 text-xs text-orange-600 bg-orange-50 rounded-full px-3 py-1.5 mx-auto w-fit"><Brain className="w-3.5 h-3.5" />I remember {prefCount} preference{prefCount !== 1 ? 's' : ''}</div>}

                    {showReminder && (
                      <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-xl p-4 text-left">
                        <p className="text-sm text-gray-800 mb-3">{showReminder.message}</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleReminderAction(showReminder, 'respond')} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-medium py-2 rounded-lg hover:from-amber-400 hover:to-orange-500 transition">Update Now</button>
                          <button onClick={() => handleReminderAction(showReminder, 'snooze')} className="px-3 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">Later</button>
                          <button onClick={() => handleReminderAction(showReminder, 'dismiss')} className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition" title="Dismiss">✕</button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          {showReminder.priority === 'HIGH' && <p className="text-[10px] text-orange-500">⚡ Your trip is coming up soon!</p>}
                          <div className="flex items-center gap-3 ml-auto">
                            <button onClick={() => setShowReminderSchedule(!showReminderSchedule)} className="text-[10px] text-gray-400 hover:text-gray-600 transition">Set reminder...</button>
                            <button onClick={() => handleReminderAction(showReminder, 'ignore-forever')} className="text-[10px] text-gray-400 hover:text-red-500 transition">Don't ask again</button>
                          </div>
                        </div>
                        {showReminderSchedule && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {['1d','3d','1w','2w','1m'].map(t => (
                              <button key={t} onClick={async () => {
                                await api.post(`/hitch/reminders/${showReminder.id}/remind-at`, { remindAt: t }).catch(() => {});
                                setActiveReminders(prev => prev.filter(r => r.id !== showReminder.id));
                                setShowReminder(null); setShowReminderSchedule(false);
                              }} className="text-[10px] px-2.5 py-1 bg-white border border-gray-200 rounded-full hover:border-orange-300 hover:bg-orange-50 transition">
                                {t === '1d' ? 'Tomorrow' : t === '3d' ? 'In 3 days' : t === '1w' ? 'Next week' : t === '2w' ? 'In 2 weeks' : 'Next month'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {starters.length > 0 && <div className="space-y-2">{starters.map((s, i) => (
                      <button key={i} onClick={() => sendMessage(s)} className="w-full text-left px-4 py-2.5 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 rounded-xl text-sm text-gray-700 transition border border-orange-100 hover:border-orange-200">{s}</button>
                    ))}</div>}
                  </div>
                )}

                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.role === 'user' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {m.role === 'assistant' && !m.content && isLoading && (
                        <div className="flex items-center gap-1.5 py-1">
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      )}
                      {m.content && <div className="text-sm leading-relaxed whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: fmt(m.content) }} />}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
                <div className="flex items-end gap-2">
                  <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask Hitch anything..." rows={1} className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 max-h-24 overflow-y-auto" style={{ minHeight: '42px' }} disabled={isLoading} />
                  <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all flex-shrink-0"><Send className="w-4 h-4" /></button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 text-center">Hitch learns your preferences over time • AI-powered</p>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes slide-up { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes fade-in { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:translateX(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </>
  );
}
