import { useState } from 'react';
import { Users, MessageSquare, Calendar, Camera, ShoppingCart, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import CampfireChat from './CampfireChat';
import CampMarket from './CampMarket';
import { useEventPresence } from '../hooks/useEventPresence';

interface Props {
  eventId: string;
  campgroundId: string;
  campgroundName: string;
  isCheckedIn: boolean;
  scheduleItems?: any[];
}

export default function CampBoard({ eventId, campgroundId, campgroundName, isCheckedIn, scheduleItems = [] }: Props) {
  const [activeSection, setActiveSection] = useState<'feed' | 'chat' | 'schedule' | 'market'>('feed');
  const { hereNow, going } = useEventPresence(eventId);

  // Find what's happening now and what's next
  const now = new Date();
  const happeningNow = scheduleItems.find(item =>
    new Date(item.startTime) <= now && (!item.endTime || new Date(item.endTime) >= now)
  );
  const upcoming = scheduleItems
    .filter(item => new Date(item.startTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const sections = [
    { id: 'feed', emoji: '📡', label: 'Pulse' },
    { id: 'chat', emoji: '💬', label: 'Huddle' },
    { id: 'schedule', emoji: '📅', label: 'Schedule' },
    { id: 'market', emoji: '🛒', label: 'Market' },
  ] as const;

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <div>
              <p className="text-white font-bold text-sm">Camp Board</p>
              <p className="text-emerald-200 text-[10px]">{campgroundName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {hereNow.length} here
            </span>
            {going.length > 0 && (
              <span className="bg-white/10 text-white/70 text-[10px] px-2 py-0.5 rounded-full">
                +{going.length} coming
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Who's Here strip */}
      {hereNow.length > 0 && (
        <div className="px-4 py-2.5 border-b border-gray-100 bg-emerald-50/50">
          <div className="flex items-center gap-2 overflow-x-auto">
            {hereNow.map(p => (
              <Link
                key={p.userId}
                to={`/profile/${p.user.username || p.userId}`}
                className="flex flex-col items-center gap-0.5 flex-shrink-0"
              >
                {p.user.profilePicture ? (
                  <img src={p.user.profilePicture} className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-400" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-[10px] font-bold text-emerald-700 ring-2 ring-emerald-400">
                    {p.user.firstName?.[0]}
                  </div>
                )}
                <span className="text-[9px] text-gray-500 truncate max-w-[48px]">{p.user.firstName}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Happening Now banner */}
      {happeningNow && (
        <div className="bg-orange-500 text-white px-4 py-2 flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="font-bold">Now:</span>
          <span className="truncate">{happeningNow.title}</span>
          {happeningNow.location && <span className="text-orange-100 text-xs">· {happeningNow.location}</span>}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex border-b border-gray-100">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition ${
              activeSection === s.id
                ? 'text-emerald-700 border-b-2 border-emerald-500 bg-emerald-50/50'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span>{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="p-0">
        {/* Pulse Feed */}
        {activeSection === 'feed' && (
          <div className="p-4 space-y-3">
            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-2">
              <button className="flex flex-col items-center gap-1 bg-gray-50 hover:bg-gray-100 rounded-xl py-3 transition">
                <Camera className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] text-gray-600 font-medium">Post Photo</span>
              </button>
              <button
                onClick={() => setActiveSection('chat')}
                className="flex flex-col items-center gap-1 bg-gray-50 hover:bg-gray-100 rounded-xl py-3 transition"
              >
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] text-gray-600 font-medium">Start Huddle</span>
              </button>
              <button
                onClick={() => setActiveSection('market')}
                className="flex flex-col items-center gap-1 bg-gray-50 hover:bg-gray-100 rounded-xl py-3 transition"
              >
                <ShoppingCart className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] text-gray-600 font-medium">Marketplace</span>
              </button>
            </div>

            {/* Upcoming schedule */}
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">Coming Up</p>
                <div className="space-y-1.5">
                  {upcoming.slice(0, 4).map(item => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-gray-400 font-mono w-14 flex-shrink-0">
                        {new Date(item.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                        {item.location && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />{item.location}
                          </p>
                        )}
                      </div>
                      {item.isOptional && <span className="text-[9px] text-gray-400">Optional</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Who's nearby but not here yet */}
            {going.length > 0 && (
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-blue-600 font-semibold">
                  🚐 {going.length} camper{going.length !== 1 ? 's' : ''} still on the way
                </p>
              </div>
            )}

            {upcoming.length === 0 && going.length === 0 && hereNow.length === 0 && (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">🏕️</p>
                <p className="text-xs text-gray-500">Camp is quiet — start a huddle or snap a photo!</p>
              </div>
            )}
          </div>
        )}

        {/* Huddle Chat */}
        {activeSection === 'chat' && (
          <CampfireChat
            campgroundId={campgroundId}
            campgroundName={campgroundName}
            isUserCheckedIn={isCheckedIn}
          />
        )}

        {/* Schedule */}
        {activeSection === 'schedule' && (
          <div className="p-4 space-y-2">
            {scheduleItems.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">📅</p>
                <p className="text-xs text-gray-500">No schedule items yet</p>
              </div>
            ) : (
              scheduleItems.map(item => {
                const isNow = new Date(item.startTime) <= now && (!item.endTime || new Date(item.endTime) >= now);
                return (
                  <div key={item.id} className={`rounded-lg px-3 py-2.5 border ${
                    isNow ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-semibold ${isNow ? 'text-orange-800' : 'text-gray-800'}`}>
                          {isNow && <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5 animate-pulse" />}
                          {item.title}
                        </p>
                        {item.description && <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>}
                      </div>
                      {item.isOptional && <span className="text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Optional</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                      <span>{new Date(item.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      {item.endTime && <span>– {new Date(item.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                      {item.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{item.location}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Market */}
        {activeSection === 'market' && (
          <div className="p-2">
            <CampMarket campgroundId={campgroundId} />
          </div>
        )}
      </div>
    </div>
  );
}
