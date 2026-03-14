import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload';

const STEPS = ['Your Location', 'Tell Your Story', 'RV Details'];
const HOST_TYPES = ['WINERY','BREWERY','FARM','DISTILLERY','RANCH','MUSEUM','ATTRACTION','ORCHARD','EVENT_VENUE','OTHER'];
const HOST_TYPE_ICONS: Record<string,string> = {
  WINERY:'🍷',BREWERY:'🍺',FARM:'🌾',DISTILLERY:'🥃',RANCH:'🐄',
  MUSEUM:'🏛️',ATTRACTION:'🎡',ORCHARD:'🍎',EVENT_VENUE:'🎪',OTHER:'🌿',
};
const NETWORKS = ['HARVEST_HOSTS','BOONDOCKERS','RV_OVERNIGHTERS','IOVERLANDER','INDEPENDENT'];
const ACTIVITY_OPTIONS = ['Wine Tasting','Farm Animals','Live Music','Food Trucks','Stargazing','Hiking Trails','Brewery Patio','Orchard Picking','Farm Stand','Fishing','Swimming','Kayaking'];
const VIBE_OPTIONS = ['Social Host','Quiet Farm','Event Spot','Family Friendly','Stargazer Paradise','Party Patio','Peaceful Retreat','Big Rig Friendly'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function CreateHostPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name:'', hostType:'WINERY', networkType:'INDEPENDENT',
    address:'', city:'', state:'', latitude:'', longitude:'',
    website:'', phone:'', imageUrl:'',
    description:'', hostStory:'', supportMessage:'', suggestedPurchase:'', storeHours:'',
    activityTags:[] as string[], vibeScores:[] as string[],
    maxRvLength:'', maxRvs:'', surfaceType:'', maxNights:'1',
    hookups:false, bigRigFriendly:false, turnaroundAvailable:false,
    selfContainedRequired:false, familyFriendly:false,
    petPolicy:'', quietHours:'', arrivalWindow:'', departureTime:'',
    generatorPolicy:'', reservationType:'REQUEST', checkInInstructions:'',
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (k: string, v: string) => setForm(f => ({
    ...f, [k]: (f as any)[k].includes(v)
      ? (f as any)[k].filter((x: string) => x !== v)
      : [...(f as any)[k], v]
  }));

  const geocodeAddress = async () => {
    if (!form.address || !form.city || !form.state) return;
    try {
      const q = encodeURIComponent(`${form.address}, ${form.city}, ${form.state}`);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
      const d = await r.json();
      if (d[0]) { set('latitude', d[0].lat); set('longitude', d[0].lon); }
    } catch {}
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        maxRvLength: form.maxRvLength ? parseInt(form.maxRvLength) : null,
        maxRvs: form.maxRvs ? parseInt(form.maxRvs) : null,
        maxNights: parseInt(form.maxNights),
        status: 'PENDING',
      };
      const { data } = await api.post('/harvest-hosts', payload);
      navigate(`/hosts/${data.id}`);
    } catch { alert('Failed to submit. Please try again.'); }
    finally { setSubmitting(false); }
  };

  if (!user) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <p className="text-gray-600">Please sign in to list your location.</p>
      <Link to="/login" className="mt-4 inline-block px-6 py-2 bg-green-600 text-white rounded-xl font-semibold">Sign In</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/campgrounds')} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to RV Networks
      </button>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🏡 List Your RV Host Location</h1>
        <p className="text-gray-500 text-sm">Get discovered by thousands of RV travelers looking for unique overnight stops.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-green-600 text-white ring-4 ring-green-100' : 'bg-gray-100 text-gray-400'}`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-green-700' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-green-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">📍 Your Location</h2>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Business / Property Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Sunny Valley Winery" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Type of Host *</label>
              <div className="grid grid-cols-5 gap-2">
                {HOST_TYPES.map(t => (
                  <button key={t} onClick={() => set('hostType', t)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition ${form.hostType === t ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
                    <span className="text-xl">{HOST_TYPE_ICONS[t]}</span>
                    <span>{t.replace('_',' ')}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Network Affiliation</label>
              <div className="flex flex-wrap gap-2">
                {NETWORKS.map(n => (
                  <button key={n} onClick={() => set('networkType', n)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${form.networkType === n ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {n.replace(/_/g,' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Street Address *</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} onBlur={geocodeAddress}
                  placeholder="123 Vineyard Rd" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">City *</label>
                <input value={form.city} onChange={e => set('city', e.target.value)} onBlur={geocodeAddress}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">State *</label>
                <select value={form.state} onChange={e => { set('state', e.target.value); setTimeout(geocodeAddress, 200); }}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <option value="">Select...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {form.latitude && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Location pinned: {parseFloat(form.latitude).toFixed(4)}, {parseFloat(form.longitude).toFixed(4)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Website</label>
                <input value={form.website} onChange={e => set('website', e.target.value)}
                  placeholder="https://..." className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="(555) 000-0000" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Cover Photo</label>
              <ImageUpload onImageUploaded={url => set('imageUrl', url)} currentImage={form.imageUrl} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">📖 Tell Your Story</h2>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">About Your Location *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="What makes your place special for RV travelers?" rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Your Host Story</label>
              <textarea value={form.hostStory} onChange={e => set('hostStory', e.target.value)}
                placeholder="Family owned vineyard since 1982. Guests enjoy sunset tastings overlooking the valley..."
                rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Experiences & Activities</label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_OPTIONS.map(a => (
                  <button key={a} onClick={() => toggleArr('activityTags', a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${form.activityTags.includes(a) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Host Vibe</label>
              <div className="flex flex-wrap gap-2">
                {VIBE_OPTIONS.map(v => (
                  <button key={v} onClick={() => toggleArr('vibeScores', v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${form.vibeScores.includes(v) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Support Message</label>
              <input value={form.supportMessage} onChange={e => set('supportMessage', e.target.value)}
                placeholder="Guests typically support us by purchasing wine or merchandise"
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Suggested Purchase</label>
                <input value={form.suggestedPurchase} onChange={e => set('suggestedPurchase', e.target.value)}
                  placeholder="A bottle of wine ($25-$45)" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Store / Tasting Hours</label>
                <input value={form.storeHours} onChange={e => set('storeHours', e.target.value)}
                  placeholder="Fri-Sun 11am-6pm" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">🚐 RV & Stay Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Max RV Length (ft)</label>
                <input type="number" value={form.maxRvLength} onChange={e => set('maxRvLength', e.target.value)}
                  placeholder="40" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Max # of Rigs</label>
                <input type="number" value={form.maxRvs} onChange={e => set('maxRvs', e.target.value)}
                  placeholder="5" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Surface Type</label>
                <select value={form.surfaceType} onChange={e => set('surfaceType', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <option value="">Select...</option>
                  {['Gravel','Grass','Pavement','Dirt','Mixed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Max Nights</label>
                <input type="number" value={form.maxNights} onChange={e => set('maxNights', e.target.value)}
                  min="1" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Arrival Window</label>
                <input value={form.arrivalWindow} onChange={e => set('arrivalWindow', e.target.value)}
                  placeholder="After 3pm" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Departure Time</label>
                <input value={form.departureTime} onChange={e => set('departureTime', e.target.value)}
                  placeholder="By 11am" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Quiet Hours</label>
                <input value={form.quietHours} onChange={e => set('quietHours', e.target.value)}
                  placeholder="10pm - 7am" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Pet Policy</label>
                <input value={form.petPolicy} onChange={e => set('petPolicy', e.target.value)}
                  placeholder="Dogs welcome on leash" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Generator Policy</label>
              <input value={form.generatorPolicy} onChange={e => set('generatorPolicy', e.target.value)}
                placeholder="No generators after 9pm" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Reservation Type</label>
              <div className="flex gap-2">
                {[['REQUEST','📩 Request Stay'],['INSTANT','⚡ Instant Stay'],['CALL','📞 Call Ahead']].map(([v,l]) => (
                  <button key={v} onClick={() => set('reservationType', v)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${form.reservationType === v ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Check-in Instructions</label>
              <textarea value={form.checkInInstructions} onChange={e => set('checkInInstructions', e.target.value)}
                placeholder="Park near the barn, text us when you arrive..." rows={2}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['hookups','⚡ Has Hookups'],['bigRigFriendly','🚛 Big Rig Friendly'],['turnaroundAvailable','↩️ Turnaround Available'],['selfContainedRequired','🔒 Self-Contained Required'],['familyFriendly','👨‍👩‍👧 Family Friendly']].map(([k,l]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl border border-gray-100 hover:bg-gray-50">
                  <input type="checkbox" checked={(form as any)[k]} onChange={e => set(k, e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-700">{l}</span>
                </label>
              ))}
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm font-bold text-green-800 mb-1">🦄 Almost there!</p>
              <p className="text-xs text-green-700">Your listing will be reviewed by our team and published within 24 hours. You'll get a notification when it goes live.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-2 px-5 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)}
            disabled={!form.name || !form.address || !form.city || !form.state}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || !form.name || !form.latitude}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
            {submitting ? '⏳ Submitting...' : '🚀 Submit Listing'}
          </button>
        )}
      </div>
    </div>
  );
}
