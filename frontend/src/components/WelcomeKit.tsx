import { useState, useEffect } from 'react';
import { X, Wifi, Key, Clock, Phone, MapPin, FileText, ExternalLink, Copy, Check, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface Props {
  campgroundId: string;
  campgroundName: string;
  checkInDate?: string;
  checkOutDate?: string;
}

export default function WelcomeKit({ campgroundId, campgroundName, checkInDate, checkOutDate }: Props) {
  const [kit, setKit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    api.get(`/welcome-kit/${campgroundId}/guest`)
      .then(({ data }) => {
        if (data.kit) {
          setKit(data.kit);
          // Show welcome overlay once per check-in
          const key = `rvu_welcome_${campgroundId}`;
          if (!sessionStorage.getItem(key)) {
            setShowWelcome(true);
            sessionStorage.setItem(key, 'true');
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campgroundId]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button onClick={() => copyToClipboard(text, field)}
      className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium transition">
      {copied === field ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
    </button>
  );

  if (loading || !kit) return null;

  // Welcome overlay
  if (showWelcome) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowWelcome(false)}>
        <div className="bg-white rounded-2xl max-w-sm w-full p-8 text-center" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to {campgroundName}!</h2>
          <p className="text-sm text-gray-500 mb-6">Your digital welcome kit is ready with WiFi, maps, and everything you need for your stay.</p>
          <button onClick={() => { setShowWelcome(false); setShowFull(true); }}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition mb-2">
            Open Welcome Kit
          </button>
          <button onClick={() => setShowWelcome(false)} className="text-sm text-gray-400 hover:text-gray-600">Dismiss</button>
        </div>
      </div>
    );
  }

  // Compact card for Basecamp
  if (!showFull) {
    return (
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-sm">{campgroundName}</p>
            {checkInDate && checkOutDate && (
              <p className="text-green-100 text-xs">{new Date(checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            )}
          </div>
          <span className="text-lg">🎁</span>
        </div>
        <div className="flex gap-2 mb-3 flex-wrap">
          {kit.wifiName && (
            <button onClick={() => copyToClipboard(kit.wifiPassword || kit.wifiName, 'wifi')}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
              <Wifi className="w-3 h-3" /> {copied === 'wifi' ? 'Copied!' : 'WiFi'}
            </button>
          )}
          {kit.gateCode && (
            <button onClick={() => copyToClipboard(kit.gateCode, 'gate')}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
              <Key className="w-3 h-3" /> {copied === 'gate' ? 'Copied!' : 'Gate'}
            </button>
          )}
          {kit.checkoutTime && (
            <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1.5 rounded-lg text-xs">
              <Clock className="w-3 h-3" /> Out by {kit.checkoutTime}
            </span>
          )}
          {kit.officePhone && (
            <a href={`tel:${kit.officePhone}`} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
              <Phone className="w-3 h-3" /> Office
            </a>
          )}
        </div>
        <button onClick={() => setShowFull(true)}
          className="w-full bg-white/20 hover:bg-white/30 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1">
          View Full Welcome Kit <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Full Welcome Kit modal
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => setShowFull(false)}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-white font-bold">{campgroundName}</h2>
            <p className="text-green-100 text-xs">Your Welcome Kit</p>
          </div>
          <button onClick={() => setShowFull(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Welcome message */}
          {kit.welcomeMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-800 leading-relaxed">{kit.welcomeMessage}</p>
            </div>
          )}

          {/* Essentials */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-gray-900 text-sm">Stay Essentials</h3>
            {kit.wifiName && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">WiFi Network</p>
                    <p className="text-sm font-medium text-gray-900">{kit.wifiName}</p>
                    {kit.wifiPassword && <p className="text-xs text-gray-500">Password: <span className="font-mono font-medium text-gray-700">{kit.wifiPassword}</span></p>}
                  </div>
                </div>
                {kit.wifiPassword && <CopyButton text={kit.wifiPassword} field="wifi-full" />}
              </div>
            )}
            {kit.gateCode && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Gate Code</p>
                    <p className="text-sm font-mono font-bold text-gray-900">{kit.gateCode}</p>
                  </div>
                </div>
                <CopyButton text={kit.gateCode} field="gate-full" />
              </div>
            )}
            {kit.checkoutTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <div><p className="text-xs text-gray-500">Checkout</p><p className="text-sm font-medium">{kit.checkoutTime}</p></div>
              </div>
            )}
            {(kit.quietHoursStart || kit.quietHoursEnd) && (
              <div className="flex items-center gap-2">
                <span className="text-sm">🤫</span>
                <div><p className="text-xs text-gray-500">Quiet Hours</p><p className="text-sm font-medium">{kit.quietHoursStart} – {kit.quietHoursEnd}</p></div>
              </div>
            )}
          </div>

          {/* Phones */}
          {(kit.officePhone || kit.emergencyPhone || kit.maintenancePhone) && (
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-sm">Contact</h3>
              {kit.officePhone && <a href={`tel:${kit.officePhone}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition"><Phone className="w-4 h-4 text-green-600" /><div><p className="text-xs text-gray-500">Office</p><p className="text-sm font-medium">{kit.officePhone}</p></div></a>}
              {kit.emergencyPhone && <a href={`tel:${kit.emergencyPhone}`} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl hover:bg-red-100 transition"><Phone className="w-4 h-4 text-red-600" /><div><p className="text-xs text-red-500">Emergency</p><p className="text-sm font-medium">{kit.emergencyPhone}</p></div></a>}
              {kit.maintenancePhone && <a href={`tel:${kit.maintenancePhone}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition"><Phone className="w-4 h-4 text-gray-500" /><div><p className="text-xs text-gray-500">Maintenance</p><p className="text-sm font-medium">{kit.maintenancePhone}</p></div></a>}
            </div>
          )}

          {/* Map */}
          {kit.mapImageUrl && (
            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-2">Campground Map</h3>
              <img src={kit.mapImageUrl} className="w-full rounded-xl border border-gray-200" alt="Map" />
            </div>
          )}

          {/* Custom sections */}
          {kit.sections?.map((section: any) => (
            <div key={section.id}>
              <h3 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-1">
                {section.icon && <span>{section.icon}</span>} {section.title}
              </h3>

              {section.type === 'document' && section.fileUrl && (
                <a href={section.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium flex-1">{section.title}</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              )}

              {section.type === 'rules' && section.items?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  {section.items.map((item: any) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      <span>{item.icon || '•'}</span>
                      <span className="text-gray-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {section.type === 'recommendations' && section.items?.length > 0 && (
                <div className="space-y-2">
                  {section.items.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="text-lg">{item.icon || '📍'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        {item.value && <p className="text-xs text-gray-500">{item.value}</p>}
                      </div>
                      {item.url && (
                        <a href={item.url.startsWith('http') ? item.url : `https://maps.google.com/?q=${encodeURIComponent(item.label + ' ' + (item.value || ''))}`}
                          target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-medium flex-shrink-0">
                          <MapPin className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {section.type === 'contacts' && section.items?.length > 0 && (
                <div className="space-y-2">
                  {section.items.map((item: any) => (
                    <a key={item.id} href={item.value ? `tel:${item.value}` : '#'}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                      <Phone className="w-4 h-4 text-green-600" />
                      <div className="flex-1"><p className="text-sm font-medium">{item.label}</p>{item.value && <p className="text-xs text-gray-500">{item.value}</p>}</div>
                    </a>
                  ))}
                </div>
              )}

              {section.type === 'links' && section.items?.length > 0 && (
                <div className="space-y-2">
                  {section.items.map((item: any) => (
                    <a key={item.id} href={item.url || '#'} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                      <ExternalLink className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700 flex-1">{item.label}</span>
                    </a>
                  ))}
                </div>
              )}

              {section.type === 'custom' && section.content && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
