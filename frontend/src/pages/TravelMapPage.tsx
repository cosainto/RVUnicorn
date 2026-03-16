import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Map, Heart, Navigation, Moon } from 'lucide-react';
import OvernightPlanner from '../components/OvernightPlanner';
import TravelMap from '../components/TravelMap';
import Attractions from '../components/Attractions';
import DrivePlanner from '../components/DrivePlanner';
import { useAuth } from '../contexts/AuthContext';

export default function TravelMapPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('map');

  // Handle URL parameter to switch to Drive Planner tab
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const campgroundId = searchParams.get('campgroundId');
    if (tabParam === 'drive-planner' || campgroundId) {
      setActiveTab('trips');
    }
  }, [searchParams]);

  const tabs = [
    { id: 'map', label: 'Map View', icon: Map },
    { id: 'attractions', label: 'Attractions', icon: Heart },
    { id: 'trips', label: 'Drive Planner', icon: Navigation },
    { id: 'overnight', label: 'Overnight Stops', icon: Moon },
  ];

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-600">Please log in to view your travel map</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Travel & Routes</h1>
        <p className="text-gray-600">
          Track your camping adventures, plan routes, and create your bucket list
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.icon && <tab.icon className="w-5 h-5" />}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'map' && (
            <TravelMap userId={user.id} isOwnProfile={true} />
          )}
          {activeTab === 'attractions' && <Attractions />}
          {activeTab === 'trips' && <DrivePlanner />}
          {activeTab === 'overnight' && <OvernightPlanner />}
        </div>
      </div>
    </div>
  );
}
