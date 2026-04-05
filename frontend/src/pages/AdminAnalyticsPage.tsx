import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Users, MapPin, Calendar, MessageSquare, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const RANGES = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'all', label: 'All time' },
];

function AnimNum({ value, color = '#E8A838' }: { value: number; color?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let c = 0; const inc = value / 25;
    const t = setInterval(() => { c += inc; if (c >= value) { setN(value); clearInterval(t); } else setN(Math.floor(c)); }, 40);
    return () => clearInterval(t);
  }, [value]);
  return <span style={{ color, fontSize: '32px', fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{n.toLocaleString()}</span>;
}

function MiniBar({ data, maxVal, color = '#E8A838', height = 120 }: { data: { date: string; count: number }[]; maxVal: number; color?: string; height?: number }) {
  const w = 100 / Math.max(data.length, 1);
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 relative group" style={{ minWidth: '4px' }}>
          <div className="w-full rounded-t-sm transition-all" style={{ height: `${maxVal > 0 ? (d.count / maxVal) * 100 : 0}%`, background: color, minHeight: d.count > 0 ? '2px' : '0' }} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition z-10" style={{ background: '#0F1C35', color: '#F5F0E8', border: '1px solid rgba(232,168,56,0.2)' }}>
            {d.date}: {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function HBar({ items, color = '#D4621A' }: { items: { name: string; count: number }[]; color?: string }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] w-32 truncate text-right" style={{ color: 'rgba(245,240,232,0.5)' }}>{item.name}</span>
          <div className="flex-1 h-4 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="h-full rounded-sm transition-all" style={{ width: `${(item.count / max) * 100}%`, background: color }} />
          </div>
          <span className="text-[10px] w-8 text-right" style={{ color: '#E8A838' }}>{item.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { user } = useAuth() as any;
  const [range, setRange] = useState('30d');
  const [summary, setSummary] = useState<any>(null);
  const [growth, setGrowth] = useState<any[]>([]);
  const [dau, setDau] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<{ daily: any[]; topCampgrounds: any[] }>({ daily: [], topCampgrounds: [] });
  const [community, setCommunity] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [retention, setRetention] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [s, g, d, c, cm, st, r] = await Promise.all([
        api.get(`/admin/analytics/summary?range=${range}`),
        api.get(`/admin/analytics/user-growth?range=${range}`),
        api.get(`/admin/analytics/dau?range=${range}`),
        api.get(`/admin/analytics/checkins?range=${range}`),
        api.get(`/admin/analytics/community?range=${range}`),
        api.get(`/admin/analytics/signups-by-state?range=${range}`),
        api.get(`/admin/analytics/retention`),
      ]);
      setSummary(s.data); setGrowth(g.data.data || []); setDau(d.data.data || []);
      setCheckins(c.data); setCommunity(cm.data.data || []); setStates(st.data.data || []);
      setRetention(r.data);
    } catch (e) { console.error('Analytics load error:', e); }
    setLoading(false);
  }, [range]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/analytics/recent-users?page=${userPage}&limit=25&search=${userSearch}`);
      setUsers(data.users || []); setUserTotal(data.total || 0);
    } catch {}
  }, [userPage, userSearch]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { const interval = setInterval(loadAll, 5 * 60 * 1000); return () => clearInterval(interval); }, [loadAll]);

  const pctChange = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

  const exportCsv = () => {
    const headers = 'Name,Username,Email,Joined,Location,RV Type,Check-ins,Trips\n';
    const rows = users.map(u => `"${u.firstName} ${u.lastName}",${u.username},${u.email},${new Date(u.createdAt).toLocaleDateString()},"${u.location || ''}",${u.rvType || ''},${u._count?.checkIns || 0},${u._count?.organizedEvents || 0}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `rvunicorn-users-${new Date().toISOString().split('T')[0]}.csv`; link.click();
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1C35' }}><div className="animate-spin w-10 h-10 border-b-2 rounded-full" style={{ borderColor: '#E8A838' }} /></div>;

  const s = summary || {};

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: '#0F1C35', color: '#F5F0E8', fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display',serif", color: '#E8A838' }}>RVUnicorn Analytics</h1>
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => { setRange(r.key); setLoading(true); }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition"
                style={{ background: range === r.key ? '#E8A838' : '#1B2E50', color: range === r.key ? '#0F1C35' : 'rgba(245,240,232,0.5)' }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-5">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Users', value: s.totalUsers || 0, sub: `+${s.weekSignups || 0} this week`, icon: Users },
            { label: 'New Signups', value: s.newSignups || 0, sub: `${pctChange(s.newSignups, s.prevSignups) >= 0 ? '+' : ''}${pctChange(s.newSignups, s.prevSignups)}% vs prev`, trend: pctChange(s.newSignups, s.prevSignups) },
            { label: 'Active Users', value: s.activeUsers || 0, sub: `${s.activePercent || 0}% of total`, icon: Users },
            { label: 'Check-ins', value: s.totalCheckins || 0, sub: `${pctChange(s.totalCheckins, s.prevCheckins) >= 0 ? '+' : ''}${pctChange(s.totalCheckins, s.prevCheckins)}% vs prev`, trend: pctChange(s.totalCheckins, s.prevCheckins) },
            { label: 'Trips Created', value: s.tripsCreated || 0, sub: `${pctChange(s.tripsCreated, s.prevTrips) >= 0 ? '+' : ''}${pctChange(s.tripsCreated, s.prevTrips)}% vs prev`, trend: pctChange(s.tripsCreated, s.prevTrips) },
            { label: 'Community Posts', value: s.postsCreated || 0, sub: `${pctChange(s.postsCreated, s.prevPosts) >= 0 ? '+' : ''}${pctChange(s.postsCreated, s.prevPosts)}% vs prev`, trend: pctChange(s.postsCreated, s.prevPosts) },
          ].map((card, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: '#1B2E50' }}>
              <p className="text-[11px] uppercase mb-2" style={{ color: 'rgba(245,240,232,0.4)', letterSpacing: '0.08em' }}>{card.label}</p>
              <AnimNum value={card.value} />
              <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'rgba(245,240,232,0.35)' }}>
                {card.trend !== undefined && (card.trend >= 0
                  ? <TrendingUp className="w-3 h-3" style={{ color: '#2ECC71' }} />
                  : <TrendingDown className="w-3 h-3" style={{ color: '#D4621A' }} />)}
                {card.sub}
              </p>
            </div>
          ))}
        </div>

        {/* User Growth Chart */}
        <div className="p-5 rounded-xl" style={{ background: '#1B2E50' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: '#E8A838' }}>User Growth</h3>
          <MiniBar data={growth.map(g => ({ date: g.date, count: g.newUsers }))} maxVal={Math.max(...growth.map(g => g.newUsers), 1)} color="#D4621A" height={100} />
          <div className="flex justify-between mt-2 text-[9px]" style={{ color: 'rgba(245,240,232,0.25)' }}>
            <span>{growth[0]?.date || ''}</span>
            <span>{growth[growth.length - 1]?.date || ''}</span>
          </div>
        </div>

        {/* DAU + Check-ins side by side */}
        <div className="grid md:grid-cols-2 gap-5">
          <div className="p-5 rounded-xl" style={{ background: '#1B2E50' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#5DCAA5' }}>Daily Active Users</h3>
            <MiniBar data={dau} maxVal={Math.max(...dau.map(d => d.count), 1)} color="#5DCAA5" height={80} />
          </div>
          <div className="p-5 rounded-xl" style={{ background: '#1B2E50' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#E8A838' }}>Campground Check-ins</h3>
            <MiniBar data={checkins.daily} maxVal={Math.max(...checkins.daily.map(d => d.count), 1)} color="#E8A838" height={80} />
          </div>
        </div>

        {/* Top Campgrounds + Signups by State */}
        <div className="grid md:grid-cols-2 gap-5">
          <div className="p-5 rounded-xl" style={{ background: '#1B2E50' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#D4621A' }}>Most Visited Campgrounds</h3>
            {checkins.topCampgrounds.length > 0
              ? <HBar items={checkins.topCampgrounds} color="#D4621A" />
              : <p className="text-[12px]" style={{ color: 'rgba(245,240,232,0.3)' }}>No data yet</p>}
          </div>
          <div className="p-5 rounded-xl" style={{ background: '#1B2E50' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#E8A838' }}>Signups by State</h3>
            {states.length > 0
              ? <HBar items={states.map(s => ({ name: s.state, count: s.count }))} color="#E8A838" />
              : <p className="text-[12px]" style={{ color: 'rgba(245,240,232,0.3)' }}>No data yet</p>}
          </div>
        </div>

        {/* Community Activity */}
        <div className="p-5 rounded-xl" style={{ background: '#1B2E50' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: '#E8A838' }}>Community Activity</h3>
          <MiniBar data={community.map(c => ({ date: c.date, count: (c.posts || 0) + (c.recipes || 0) + (c.threads || 0) }))} maxVal={Math.max(...community.map(c => (c.posts || 0) + (c.recipes || 0) + (c.threads || 0)), 1)} color="#E8A838" height={80} />
        </div>

        {/* Retention */}
        {retention && (
          <div className="p-5 rounded-xl" style={{ background: '#1B2E50' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#E8A838' }}>Retention</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Day 1', value: retention.day1 },
                { label: 'Day 7', value: retention.day7 },
                { label: 'Day 30', value: retention.day30 },
              ].map(r => (
                <div key={r.label}>
                  <span className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display',serif", color: r.value >= 40 ? '#2ECC71' : r.value >= 20 ? '#E8A838' : '#D4621A' }}>{r.value}%</span>
                  <p className="text-[11px] mt-1" style={{ color: 'rgba(245,240,232,0.4)' }}>{r.label} Retention</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Users Table */}
        <div className="p-5 rounded-xl" style={{ background: '#1B2E50' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-sm font-bold" style={{ color: '#E8A838' }}>Recent Signups ({userTotal})</h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(245,240,232,0.3)' }} />
                <input value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1); }} placeholder="Search..." className="pl-8 pr-3 py-1.5 rounded-lg text-[12px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(232,168,56,0.1)', color: '#F5F0E8', width: '180px' }} />
              </div>
              <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: '#E8622A', color: 'white' }}><Download className="w-3 h-3" />CSV</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ color: 'rgba(245,240,232,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['User', 'Username', 'Email', 'Joined', 'Location', 'RV Type', 'Check-ins', 'Trips'].map(h => (
                    <th key={h} className="text-left py-2 px-2 uppercase text-[10px] font-semibold" style={{ letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="transition" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,168,56,0.05)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="py-2 px-2">
                      <Link to={`/profile/${u.username}`} className="flex items-center gap-2 hover:opacity-80">
                        {u.profilePicture ? <img src={u.profilePicture} className="w-6 h-6 rounded-full object-cover" alt="" /> : <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>{u.firstName?.[0]}{u.lastName?.[0]}</div>}
                        <span style={{ color: '#F5F0E8' }}>{u.firstName} {u.lastName}</span>
                      </Link>
                    </td>
                    <td className="py-2 px-2" style={{ color: 'rgba(245,240,232,0.5)' }}>@{u.username}</td>
                    <td className="py-2 px-2" style={{ color: 'rgba(245,240,232,0.5)' }}>{u.email}</td>
                    <td className="py-2 px-2" style={{ color: 'rgba(245,240,232,0.4)' }}>{timeAgo(u.createdAt)}</td>
                    <td className="py-2 px-2" style={{ color: 'rgba(245,240,232,0.4)' }}>{u.location || '—'}</td>
                    <td className="py-2 px-2" style={{ color: 'rgba(245,240,232,0.4)' }}>{u.rvType || '—'}</td>
                    <td className="py-2 px-2" style={{ color: '#E8A838' }}>{u._count?.checkIns || 0}</td>
                    <td className="py-2 px-2" style={{ color: '#E8A838' }}>{u._count?.organizedEvents || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {userTotal > 25 && (
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-[11px]" style={{ color: 'rgba(245,240,232,0.3)' }}>Page {userPage} of {Math.ceil(userTotal / 25)}</span>
              <div className="flex gap-1">
                <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage <= 1} className="p-1.5 rounded disabled:opacity-30" style={{ background: 'rgba(255,255,255,0.05)' }}><ChevronLeft className="w-3.5 h-3.5" /></button>
                <button onClick={() => setUserPage(p => p + 1)} disabled={userPage >= Math.ceil(userTotal / 25)} className="p-1.5 rounded disabled:opacity-30" style={{ background: 'rgba(255,255,255,0.05)' }}><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
