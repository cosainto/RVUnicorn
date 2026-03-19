import { useState } from 'react';
import GuideUnlockPanel from '../components/GuideUnlockPanel';
import RoadSupport from '../components/RoadSupport';
import PrivateTriviaRoom from '../components/PrivateTriviaRoom';

import HitchAIAssistant from '../components/HitchAIAssistant';
import HitchRoutePlanner from '../components/HitchRoutePlanner';
import HiddenGemFinder from '../components/HiddenGemFinder';
import CampersLikeYou from '../components/CampersLikeYou';
import HitchCampgroundFinder from '../components/HitchCampgroundFinder';

const TABS = [
  { id: 'chat', label: '💬 Chat with Hitch' },
  { id: 'route', label: '🗺️ Route Planner' },
  { id: 'gems', label: '💎 Hidden Gems' },
  { id: 'similar', label: '🦄 Find Similar' },
  { id: 'foryou', label: '👥 For You' },
  { id: 'road', label: '🚨 Road Support' },
  { id: 'private', label: '🎮 Private Trivia' },
];

export default function HitchAIPage() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src="/hitch.png" alt="Hitch" className="w-12 h-12 rounded-full object-cover shadow-lg" />
          <h1 className="text-2xl font-bold text-gray-900">Hitch AI</h1>
        </div>
        <p className="text-gray-500 text-sm">Your personal RV travel planning companion</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${activeTab === tab.id ? 'bg-primary-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'chat' && (
        <div style={{ height: '65vh' }}>
          <HitchAIAssistant />
        </div>
      )}
      {activeTab === 'route' && <HitchRoutePlanner />}
      {activeTab === 'gems' && <HiddenGemFinder />}
      {activeTab === 'similar' && <HitchCampgroundFinder />}
      {activeTab === 'foryou' && <CampersLikeYou />}
      {activeTab === 'guides' && <GuideUnlockPanel />}
      {activeTab === 'road' && <RoadSupport />}
      {activeTab === 'private' && <PrivateTriviaRoom />}
    </div>
  );
}
