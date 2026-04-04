import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Trip {
  id: string;
  startDate: string;
  endDate: string;
  type: 'camping' | 'driving' | 'planned';
}

interface VisitedCampground {
  id: string;
  name: string;
  city: string;
  state: string;
  photoUrl?: string;
  slug: string;
  visitDate: string;
  planned: boolean;
}

interface Props {
  userId: string;
  username?: string;
  trips: Trip[];
  visitedCampgrounds: VisitedCampground[];
  plannedCount: number;
  visitedCount: number;
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOT_COLORS: Record<string, string> = { camping: '#E8A838', driving: '#D4621A', planned: '#4A90D9' };

export default function CalendarCampgroundCard({ trips, visitedCampgrounds, visitedCount, plannedCount, username }: Props) {
  const navigate = useNavigate();
  const now = new Date();
  const [month] = useState(now.getMonth());
  const [year] = useState(now.getFullYear());
  const monthLabel = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dotMap: Record<number, string> = {};
  trips.forEach((trip) => {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() === month && d.getFullYear() === year) dotMap[d.getDate()] = trip.type;
    }
  });

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const recentCampgrounds = visitedCampgrounds.slice(0, 5);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
      {/* LEFT — Mini Calendar */}
      <div style={{ background: 'rgba(15, 28, 54, 0.85)', padding: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#E8A838', textTransform: 'uppercase', margin: '0 0 12px' }}>{monthLabel}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
          {DOW.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {cells.map((day, i) => {
            const dot = day ? dotMap[day] : null;
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            return (
              <div key={i} style={{ textAlign: 'center', padding: '3px 0', position: 'relative' }}>
                {day && (<>
                  <span style={{ fontSize: '10px', color: isToday ? '#E8A838' : 'rgba(255,255,255,0.65)', fontWeight: isToday ? 700 : 400, display: 'block', lineHeight: 1.4 }}>{day}</span>
                  {dot && <span style={{ display: 'block', width: '4px', height: '4px', borderRadius: '50%', background: DOT_COLORS[dot], margin: '1px auto 0' }} />}
                </>)}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[{ type: 'camping', label: 'camping' }, { type: 'driving', label: 'driving' }, { type: 'planned', label: 'planned' }].map(({ type, label }) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: DOT_COLORS[type], flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — Campgrounds */}
      <div style={{ background: 'rgba(15, 28, 54, 0.75)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <div onClick={() => navigate(username ? `/profile/${username}/rig` : '/campgrounds')}
            style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
            <div style={{ fontSize: '14px', marginBottom: '2px' }}>{'\u{1F4CD}'}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#E8A838', lineHeight: 1 }}>{visitedCount}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Visited</div>
          </div>
          <div onClick={() => navigate('/trips')}
            style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
            <div style={{ fontSize: '14px', marginBottom: '2px' }}>{'\u{1F5D3}'}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#4A90D9', lineHeight: 1 }}>{plannedCount}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Planned</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentCampgrounds.length === 0 && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: '16px' }}>No campgrounds yet</p>}
          {recentCampgrounds.map((cg) => (
            <div key={cg.id} onClick={() => navigate(`/campgrounds/${cg.slug}`)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px', borderRadius: '8px', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: cg.photoUrl ? `url(${cg.photoUrl}) center/cover` : 'rgba(232,168,56,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                {!cg.photoUrl && '\u{26FA}'}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cg.name}</p>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>{cg.city}, {cg.state}{cg.planned ? ' · planned' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
