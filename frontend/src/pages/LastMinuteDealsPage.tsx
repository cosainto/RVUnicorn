import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import LastMinuteDeals from '../components/LastMinuteDeals';

export default function LastMinuteDealsPage() {
  const [radius, setRadius] = useState(150);

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Last-Minute Deals — RVUnicorn</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🔥 Last-Minute Deals</h1>
            <p className="text-sm text-gray-500 mt-0.5">Campground specials near you — updated in real time</p>
          </div>
          <select value={radius} onChange={e => setRadius(parseInt(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
            <option value={50}>50 miles</option>
            <option value={100}>100 miles</option>
            <option value={150}>150 miles</option>
            <option value={300}>300 miles</option>
          </select>
        </div>
        <LastMinuteDeals radiusMiles={radius} />
      </div>
    </div>
  );
}
