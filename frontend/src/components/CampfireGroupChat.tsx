import { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, X, Search, Send, ChevronDown } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  campgroundId: string;
  campgroundName: string;
}

interface Group {
  id: string;
  name: string | null;
  members: { user: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null } }[];
  messages: { content: string; createdAt: string }[];
  _count: { messages: number };
}

interface GroupMessage {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; profilePicture: string | null };
}

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function CampfireGroupChat({ campgroundId, campgroundName }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadGroups(); }, [campgroundId]);

  useEffect(() => {
    if (!user?.id || !activeGroup) return;
    const socket = io(`${SOCKET_URL}/campfire`, {
      query: { campgroundId, userId: user.id },
      withCredentials: true, transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.emit('group:join', { groupId: activeGroup.id });
    socket.on('group:message:new', (msg: GroupMessage) => {
      if (msg.groupId === activeGroup.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
    });
    return () => { socket.disconnect(); };
  }, [activeGroup?.id, user?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/campfire/groups?campgroundId=${campgroundId}`);
      setGroups(data);
      if (data.length === 1 && !activeGroup) selectGroup(data[0]);
    } catch {}
    setLoading(false);
  };

  const selectGroup = async (group: Group) => {
    setActiveGroup(group);
    try {
      const { data } = await api.get(`/campfire/groups/${group.id}/messages`);
      setMessages(data);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeGroup) return;
    const content = input.trim();
    setInput('');
    if (socketRef.current) {
      socketRef.current.emit('group:message', { groupId: activeGroup.id, content });
    } else {
      try {
        const { data } = await api.post(`/campfire/groups/${activeGroup.id}/messages`, { content });
        setMessages(prev => [...prev, data]);
      } catch {}
    }
  };

  const createGroup = async () => {
    try {
      const { data } = await api.post('/campfire/groups', {
        campgroundId, name: newGroupName || null,
        memberIds: selectedFriends.map((f: any) => f.id),
      });
      setGroups(prev => [data, ...prev]);
      selectGroup(data);
      setShowCreate(false);
      setNewGroupName('');
      setSelectedFriends([]);
    } catch {}
  };

  const inviteMember = async (userId: string) => {
    if (!activeGroup) return;
    try {
      await api.post(`/campfire/groups/${activeGroup.id}/members`, { userId });
      loadGroups();
    } catch {}
  };

  const loadFriends = async () => {
    if (friends.length > 0) return;
    try { const { data } = await api.get('/friends'); setFriends(data); } catch {}
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /></div>;

  // No groups — show create
  if (groups.length === 0 && !showCreate) {
    return (
      <div className="text-center py-12 px-4">
        <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="font-bold text-slate-700">Group Chat</h3>
        <p className="text-sm text-slate-500 mt-1">Chat privately with your travel crew</p>
        <button onClick={() => { setShowCreate(true); loadFriends(); }}
          className="mt-4 px-5 py-2 bg-slate-800 text-white font-semibold rounded-xl text-sm hover:bg-slate-700 transition">
          Start a Group
        </button>
      </div>
    );
  }

  // Create group form
  if (showCreate) {
    const filtered = friends.filter(f => !inviteSearch || `${f.firstName} ${f.lastName} ${f.username}`.toLowerCase().includes(inviteSearch.toLowerCase()));
    return (
      <div className="p-4">
        <h3 className="font-bold text-slate-800 mb-3">Start a Group</h3>
        <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name (optional)"
          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2 mb-3" />
        <p className="text-xs text-slate-500 mb-2">Add members:</p>
        {selectedFriends.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedFriends.map((f: any) => (
              <span key={f.id} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-medium px-2 py-1 rounded-full">
                {f.firstName} <button onClick={() => setSelectedFriends(prev => prev.filter(p => p.id !== f.id))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} placeholder="Search friends..."
              className="w-full text-sm pl-9 pr-4 py-2 border-b border-slate-100" />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((f: any) => {
              const sel = selectedFriends.some(s => s.id === f.id);
              return (
                <button key={f.id} onClick={() => setSelectedFriends(prev => sel ? prev.filter(p => p.id !== f.id) : [...prev, f])}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 ${sel ? 'bg-blue-50' : ''}`}>
                  {f.profilePicture ? <img src={f.profilePicture} className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{f.firstName?.[0]}</div>}
                  <span className="text-sm text-slate-800">{f.firstName} {f.lastName}</span>
                  {sel && <span className="text-blue-600 text-xs ml-auto">Added</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={createGroup} disabled={selectedFriends.length === 0} className="flex-1 py-2 bg-slate-800 text-white font-semibold rounded-xl text-sm disabled:opacity-50">Create Group</button>
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm">Cancel</button>
        </div>
      </div>
    );
  }

  // Group selector (if multiple groups and none active)
  if (!activeGroup) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800">Your Groups</h3>
          <button onClick={() => { setShowCreate(true); loadFriends(); }} className="text-xs text-blue-600 font-semibold">+ New Group</button>
        </div>
        {groups.map(g => (
          <button key={g.id} onClick={() => selectGroup(g)} className="w-full text-left p-3 border border-slate-100 rounded-xl mb-2 hover:bg-slate-50 transition">
            <h4 className="font-semibold text-sm text-slate-800">{g.name || g.members.map(m => m.user.firstName).join(', ')}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{g.members.length} members · {g._count.messages} messages</p>
            {g.messages[0] && <p className="text-xs text-slate-500 mt-1 truncate">{g.messages[0].content}</p>}
          </button>
        ))}
      </div>
    );
  }

  // Active group chat
  const groupName = activeGroup.name || activeGroup.members.map(m => m.user.firstName).join(', ');

  return (
    <div className="flex flex-col" style={{ height: '400px' }}>
      {/* Group header */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          {groups.length > 1 && (
            <button onClick={() => setActiveGroup(null)} className="text-slate-400 hover:text-slate-600"><ChevronDown className="w-4 h-4 rotate-90" /></button>
          )}
          <button onClick={() => setShowMembers(!showMembers)} className="text-left">
            <h4 className="font-semibold text-sm text-slate-800">{groupName}</h4>
            <p className="text-[10px] text-slate-400">{activeGroup.members.length} members</p>
          </button>
        </div>
        <button onClick={() => { setShowInvite(!showInvite); loadFriends(); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Member list */}
      {showMembers && (
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex gap-2 flex-wrap">
          {activeGroup.members.map(m => (
            <span key={m.user.id} className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-100 rounded-full px-2 py-1">
              {m.user.profilePicture ? <img src={m.user.profilePicture} className="w-4 h-4 rounded-full" /> : null}
              {m.user.firstName}
            </span>
          ))}
        </div>
      )}

      {/* Invite bar */}
      {showInvite && (
        <div className="px-4 py-2 border-b border-slate-100 bg-blue-50">
          <div className="flex gap-2">
            <input value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} placeholder="Search username..." className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5" />
          </div>
          <div className="max-h-24 overflow-y-auto mt-1">
            {friends.filter(f => inviteSearch && `${f.firstName} ${f.lastName} ${f.username}`.toLowerCase().includes(inviteSearch.toLowerCase())).slice(0, 5).map(f => (
              <button key={f.id} onClick={() => { inviteMember(f.id); setShowInvite(false); setInviteSearch(''); }}
                className="w-full text-left text-xs text-slate-700 py-1 px-2 hover:bg-blue-100 rounded">
                {f.firstName} {f.lastName} (@{f.username})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">No messages yet. Say something!</p>
        )}
        {messages.map(msg => {
          const isMe = msg.user.id === user?.id;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                msg.user.profilePicture
                  ? <img src={msg.user.profilePicture} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">{msg.user.firstName[0]}</div>
              )}
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <span className="text-[10px] text-slate-400 mb-0.5 block">{msg.user.firstName}</span>}
                <div className={`rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                  {msg.content}
                </div>
                <span className="text-[9px] text-slate-300 mt-0.5 block">{new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 px-3 py-2 flex gap-2 items-center bg-white">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Message..." className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:border-blue-400" />
        <button onClick={sendMessage} disabled={!input.trim()} className="p-2 bg-blue-600 text-white rounded-full disabled:opacity-50 hover:bg-blue-700 transition">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
