import { useState, useEffect } from 'react';
import { Star, ShoppingCart, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';

interface Stats {
  totalSales: number;
  totalPurchases: number;
  avgSellerRating: number;
  avgBuyerRating: number;
  totalFeedbackCount: number;
}

interface FeedbackItem {
  id: string;
  role: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; firstName: string; lastName: string; profilePicture?: string };
  listing: { id: string; title: string };
}

interface Props {
  userId: string;
}

function getTrustBadge(stats: Stats) {
  const totalTrades = stats.totalSales + stats.totalPurchases;
  const avgRating = stats.totalFeedbackCount > 0
    ? ((stats.avgSellerRating * stats.totalSales + stats.avgBuyerRating * stats.totalPurchases) / stats.totalFeedbackCount)
    : 0;
  if (avgRating >= 4.5 && totalTrades >= 10) return { label: 'Top Trader', icon: '🏆' };
  if (totalTrades >= 5) return { label: 'Verified Trader', icon: '⭐' };
  if (totalTrades > 0) return null;
  return { label: 'New to Camp Market', icon: '🆕' };
}

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${cls} ${n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

export default function CampMarketProfile({ userId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [tab, setTab] = useState<'all' | 'SELLER' | 'BUYER'>('all');
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/camp-market/user/${userId}/stats`),
      api.get(`/camp-market/user/${userId}/feedback?limit=5`),
    ]).then(([statsRes, fbRes]) => {
      setStats(statsRes.data);
      setFeedback(fbRes.data.feedback);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!expanded) return;
    const params = tab === 'all' ? '' : `?role=${tab}`;
    api.get(`/camp-market/user/${userId}/feedback${params}&limit=20`)
      .then(({ data }) => setFeedback(data.feedback))
      .catch(console.error);
  }, [tab, expanded, userId]);

  if (loading) return null;
  if (!stats || stats.totalFeedbackCount === 0) return null;

  const totalTrades = stats.totalSales + stats.totalPurchases;
  const overallRating = stats.totalFeedbackCount > 0
    ? Math.round(((stats.avgSellerRating * stats.totalSales + stats.avgBuyerRating * stats.totalPurchases) / stats.totalFeedbackCount) * 10) / 10
    : 0;
  const badge = getTrustBadge(stats);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-gray-900 text-sm">Camp Market Reputation</span>
          {badge && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{badge.icon} {badge.label}</span>}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
          <ChevronDown className={`w-4 h-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="px-4 pb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <StarDisplay rating={overallRating} size="md" />
          <span className="font-bold text-gray-900">{overallRating}</span>
        </div>
        <span className="text-sm text-gray-500">{totalTrades} trade{totalTrades !== 1 ? 's' : ''}</span>
        {stats.totalSales > 0 && <span className="text-xs text-gray-400">Seller: {stats.avgSellerRating}⭐</span>}
        {stats.totalPurchases > 0 && <span className="text-xs text-gray-400">Buyer: {stats.avgBuyerRating}⭐</span>}
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="flex gap-1 px-4 pt-3">
            {(['all', 'SELLER', 'BUYER'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition ${tab === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {t === 'all' ? 'All' : t === 'SELLER' ? 'As Seller' : 'As Buyer'}
              </button>
            ))}
          </div>
          <div className="p-4 space-y-3">
            {feedback.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No feedback yet</p>
            ) : (
              feedback.map(fb => (
                <div key={fb.id} className="flex gap-3">
                  {fb.reviewer.profilePicture ? (
                    <img src={fb.reviewer.profilePicture} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold text-orange-700 flex-shrink-0">{fb.reviewer.firstName[0]}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">{fb.reviewer.firstName}</span>
                      <StarDisplay rating={fb.rating} />
                      <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(fb.createdAt), { addSuffix: true })}</span>
                    </div>
                    {fb.comment && <p className="text-xs text-gray-600 mt-0.5">{fb.comment}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">Re: {fb.listing.title} · {fb.role === 'SELLER' ? 'Sold' : 'Bought'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact inline badge for listing cards
export function CampMarketRepBadge({ userId }: { userId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get(`/camp-market/user/${userId}/stats`)
      .then(({ data }) => { if (data.totalFeedbackCount > 0) setStats(data); })
      .catch(() => {});
  }, [userId]);

  if (!stats) return null;

  const totalTrades = stats.totalSales + stats.totalPurchases;
  const overallRating = stats.totalFeedbackCount > 0
    ? Math.round(((stats.avgSellerRating * stats.totalSales + stats.avgBuyerRating * stats.totalPurchases) / stats.totalFeedbackCount) * 10) / 10
    : 0;
  const badge = getTrustBadge(stats);

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700">
      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
      <span className="font-semibold">{overallRating}</span>
      <span className="text-gray-400">· {totalTrades} trade{totalTrades !== 1 ? 's' : ''}</span>
      {badge && badge.label !== 'New to Camp Market' && <span className="ml-0.5">{badge.icon}</span>}
    </span>
  );
}
