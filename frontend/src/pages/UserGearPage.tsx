import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Backpack, Tag } from 'lucide-react';
import api from '../services/api';

interface GearItem {
  id: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  description?: string;
  imageUrl?: string;
  createdAt: string;
}

export default function UserGearPage() {
  const { username } = useParams<{ username: string }>();
  const [gear, setGear] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    loadGear();
  }, [username]);

  const loadGear = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/profile/${username}/gear`);
      setGear(data.gear || []);
      
      // Get profile name
      const profileRes = await api.get(`/profile/${username}`);
      setProfileName(`${profileRes.data.firstName} ${profileRes.data.lastName}`);
    } catch (error) {
      console.error('Load gear error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group gear by category
  const gearByCategory = gear.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, GearItem[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <><style>{`.pg-dark{background:#0F1C35!important;color:#F5F0E8!important;min-height:100vh}.pg-dark .bg-white{background:rgba(15,28,53,0.95)!important;color:#F5F0E8!important}.pg-dark .bg-gray-50,.pg-dark .bg-gray-100{background:#1B2E50!important}.pg-dark .bg-gray-200,.pg-dark .bg-gray-300{background:rgba(27,46,80,0.6)!important}.pg-dark .text-gray-900,.pg-dark .text-gray-800{color:#F5F0E8!important}.pg-dark .text-gray-700,.pg-dark .text-gray-600{color:rgba(245,240,232,0.65)!important}.pg-dark .text-gray-500,.pg-dark .text-gray-400{color:rgba(245,240,232,0.4)!important}.pg-dark .text-gray-300{color:rgba(245,240,232,0.25)!important}.pg-dark .border-gray-100,.pg-dark .border-gray-200,.pg-dark .border-gray-300{border-color:rgba(232,168,56,0.08)!important}.pg-dark .shadow-lg,.pg-dark .shadow-xl{box-shadow:0 4px 20px rgba(0,0,0,0.4)!important}.pg-dark .shadow-md,.pg-dark .shadow-sm,.pg-dark .shadow{box-shadow:0 2px 10px rgba(0,0,0,0.3)!important}.pg-dark input,.pg-dark textarea,.pg-dark select{background:#1B2E50!important;border-color:rgba(232,168,56,0.12)!important;color:#F5F0E8!important}.pg-dark .btn-primary,.pg-dark .bg-primary-600,.pg-dark .bg-primary-500{background:#E8622A!important;color:white!important}.pg-dark .btn-secondary{background:transparent!important;border-color:rgba(255,255,255,0.1)!important;color:rgba(245,240,232,0.5)!important}.pg-dark .text-primary-600,.pg-dark .text-primary-700{color:#E8A838!important}.pg-dark .hover\:bg-gray-50:hover,.pg-dark .hover\:bg-gray-100:hover{background:rgba(27,46,80,0.6)!important}.pg-dark .bg-green-50,.pg-dark .bg-blue-50,.pg-dark .bg-amber-50,.pg-dark .bg-red-50,.pg-dark .bg-purple-50,.pg-dark .bg-orange-50,.pg-dark .bg-yellow-50{background:rgba(27,46,80,0.4)!important}.pg-dark .bg-primary-50,.pg-dark .bg-primary-100{background:rgba(232,168,56,0.08)!important}`}</style>

    <div className="pg-dark max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={`/profile/${username}`}
          className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-block"
        >
          ← Back to Profile
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Backpack className="w-8 h-8 text-indigo-600" />
          {profileName ? `${profileName}'s Gear List` : 'Gear List'}
        </h1>
        <p className="text-gray-600 mt-2">
          {gear.length} {gear.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Gear List */}
      {gear.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(gearByCategory).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary-600" />
                {category}
                <span className="text-sm font-normal text-gray-500">({items.length})</span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition"
                  >
                    {item.imageUrl && (
                      <img
                        src={`${item.imageUrl}`}
                        alt={item.name}
                        className="w-full h-32 object-cover rounded mb-3"
                      />
                    )}
                    
                    <h3 className="font-bold text-gray-900 mb-1">{item.name}</h3>
                    
                    {(item.brand || item.model) && (
                      <p className="text-sm text-gray-600 mb-2">
                        {item.brand} {item.model}
                      </p>
                    )}
                    
                    {item.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Backpack className="w-24 h-24 mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Gear Listed</h2>
          <p className="text-gray-600 mb-6">
            {profileName} hasn't added any gear to their list yet.
          </p>
        </div>
      )}
    </div>
    </>
  );
}
