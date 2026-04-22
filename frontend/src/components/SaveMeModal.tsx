import { X, Phone, Navigation, Fuel, Moon, MapPin, Coffee } from 'lucide-react';

interface SaveMeStop {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  distanceMiles: number;
  phone?: string | null;
  hasRVParking?: boolean;
}

interface SaveMeModalProps {
  stops: SaveMeStop[];
  loading: boolean;
  onClose: () => void;
}

const typeIcons: Record<string, any> = {
  FUEL: Fuel,
  REST: Coffee,
  OVERNIGHT: Moon,
  CAMPGROUND: MapPin,
};

const typeColors: Record<string, string> = {
  FUEL: '#f59e0b',
  REST: '#3b82f6',
  OVERNIGHT: '#8b5cf6',
  CAMPGROUND: '#22c55e',
};

export default function SaveMeModal({ stops, loading, onClose }: SaveMeModalProps) {
  function openNavigation(lat: number, lon: number, name: string) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${encodeURIComponent(name)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
        style={{ background: '#1a0a0a', border: '2px solid rgba(239,68,68,0.4)' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-4 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white text-lg font-bold">Save Me Mode</h2>
            <p className="text-red-100/80 text-xs">Finding nearest safe stops...</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : stops.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/50 text-sm">No stops found nearby.</p>
              <p className="text-white/30 text-xs mt-1">Try calling 911 if this is an emergency.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stops.map((stop, i) => {
                const Icon = typeIcons[stop.type] || MapPin;
                const color = typeColors[stop.type] || '#94a3b8';
                return (
                  <div key={stop.id}
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Rank + Icon */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <Icon size={20} style={{ color }} />
                      </div>
                      <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{stop.name}</p>
                      <p className="text-xs text-white/40">
                        {stop.distanceMiles}mi away · {stop.type.toLowerCase()}
                        {stop.hasRVParking && ' · RV parking'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => openNavigation(stop.lat, stop.lon, stop.name)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                      >
                        <Navigation size={10} /> Go
                      </button>
                      {stop.phone && (
                        <a href={`tel:${stop.phone}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition">
                          <Phone size={10} /> Call
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 text-center">
          <p className="text-[10px] text-white/30">If this is an emergency, call 911</p>
        </div>
      </div>
    </div>
  );
}
