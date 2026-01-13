import { Link } from 'react-router-dom';
import { ArrowLeft, EyeOff } from 'lucide-react';
import MutedSettingsPanel from '../components/MutedSettingsPanel';

export default function MutedSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link 
        to="/settings" 
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-100 rounded-full">
          <EyeOff className="w-8 h-8 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Muted & Snoozed</h1>
          <p className="text-gray-600">Manage content hidden from your Basecamp feed</p>
        </div>
      </div>

      <MutedSettingsPanel />
    </div>
  );
}
