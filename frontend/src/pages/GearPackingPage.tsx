import { useState } from 'react';
import { Package, MessageSquare, ShoppingBag } from 'lucide-react';
import MyGear from '../components/MyGear';
import BorrowRequests from '../components/BorrowRequests';
import GearMarketplace from '../components/GearMarketplace';

export default function GearPackingPage() {
  const [activeTab, setActiveTab] = useState('gear');

  const tabs = [
    { id: 'gear', label: 'My Gear', icon: Package },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
    { id: 'requests', label: 'Borrow Requests', icon: MessageSquare },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gear & Packing</h1>
        <p className="text-gray-600">
          Manage your camping gear, browse the marketplace, and borrow from campground neighbors
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
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'gear' && <MyGear />}
          {activeTab === 'marketplace' && <GearMarketplace />}
          {activeTab === 'requests' && <BorrowRequests />}
        </div>
      </div>
    </div>
  );
}
