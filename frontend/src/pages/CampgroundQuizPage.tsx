import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, ChevronRight, Mail, X, Check } from 'lucide-react';
import api from '../services/api';

const US_REGIONS: Record<string, string[]> = {
  'West': ['WA','OR','CA','NV','ID','MT','WY'],
  'Southwest': ['AZ','NM','UT','CO','TX','OK'],
  'Midwest': ['ND','SD','NE','KS','MN','IA','MO','WI','IL','IN','MI','OH'],
  'Southeast': ['FL','GA','SC','NC','VA','WV','KY','TN','AL','MS','LA','AR'],
  'Northeast': ['ME','NH','VT','MA','RI','CT','NY','NJ','PA','DE','MD'],
  'Pacific': ['HI','AK'],
};

const STEPS = ['rig','style','vibe','priorities','states'];

interface Recommendation {
  id: string; name: string; state: string; city?: string;
  imageUrl?: string; reason: string;
}

export default function CampgroundQuizPage() {
  const [step, setStep] = useState(0);
  const [rvType, setRvType] = useState('');
  const [travelStyle, setTravelStyle] = useState('');
  const [vibe, setVibe] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [results, setResults] = useState<Recommendation[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const togglePriority = (p: string) => {
    setPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : prev.length < 3 ? [...prev, p] : prev);
  };

  const toggleState = (s: string) => {
    setStates(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const toggleRegion = (region: string) => {
    const regionStates = US_REGIONS[region];
    const allSelected = regionStates.every(s => states.includes(s));
    if (allSelected) setStates(prev => prev.filter(s => !regionStates.includes(s)));
    else setStates(prev => [...new Set([...prev, ...regionStates])]);
  };

  const canProceed = () => {
    if (step === 0) return !!rvType;
    if (step === 1) return !!travelStyle;
    if (step === 2) return !!vibe;
    if (step === 3) return priorities.length > 0;
    return true; // states are optional
  };

  const handleSubmit = async () => {
    setLoading(true);
    const texts = ['Searching 31,000+ campgrounds...', 'Asking Hitch for recommendations...', 'Finding your perfect matches...', 'Almost there...'];
    let i = 0;
    setLoadingText(texts[0]);
    const interval = setInterval(() => { i++; setLoadingText(texts[i % texts.length]); }, 2000);

    try {
      const { data } = await api.post('/quiz/recommendations', { rvType, travelStyle, vibe, priorities, states });
      setResults(data.recommendations || []);
    } catch { setResults([]); }
    finally { clearInterval(interval); setLoading(false); }
  };

  const handleSendEmail = async () => {
    if (!email) return;
    setSendingEmail(true);
    try {
      await api.post('/quiz/send-email', { email, firstName, recommendations: results, quizData: { rvType, travelStyle, vibe, priorities, states } });
      setEmailSent(true);
    } catch {}
    finally { setSendingEmail(false); }
  };

  const next = () => { if (step < 4) setStep(step + 1); else handleSubmit(); };
  const back = () => { if (step > 0) setStep(step - 1); };

  const SelectCard = ({ selected, onClick, emoji, label }: { selected: boolean; onClick: () => void; emoji: string; label: string }) => (
    <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition text-left w-full ${selected ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
      <span className="text-2xl">{emoji}</span>
      <span className={`font-semibold text-sm ${selected ? 'text-orange-700' : 'text-gray-700'}`}>{label}</span>
      {selected && <Check className="w-5 h-5 text-orange-500 ml-auto" />}
    </button>
  );

  // Loading screen
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6 animate-bounce">🏕️</div>
        <div className="w-48 h-1.5 bg-orange-200 rounded-full mx-auto mb-4 overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full animate-pulse" style={{ width: '70%' }} />
        </div>
        <p className="text-gray-700 font-medium animate-pulse">{loadingText}</p>
      </div>
    </div>
  );

  // Results screen
  if (results.length > 0) return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Your Campground Picks — RVUnicorn</title></Helmet>
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white py-8 px-4 text-center">
        <h1 className="text-2xl font-bold mb-1">🦄 Your perfect campgrounds</h1>
        <p className="text-orange-100 text-sm">Hand-picked by Hitch based on your answers</p>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {results.map(r => (
            <Link key={r.id} to={`/campgrounds/${r.id}`} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-orange-200 transition group">
              <div className="h-36 bg-gray-100 overflow-hidden">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🏕️</div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-bold text-gray-900 text-sm leading-snug">{r.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{r.city ? `${r.city}, ` : ''}{r.state}</p>
                <p className="text-xs text-orange-600 mt-2 italic leading-relaxed">"{r.reason}"</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-center gap-3 z-40">
        <button onClick={() => setShowEmailModal(true)} className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 transition">
          <Mail className="w-4 h-4" /> Email me these picks
        </button>
        <Link to="/register?quiz=true" className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition">
          Join RVUnicorn to save these
        </Link>
      </div>

      {/* Email modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowEmailModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Email your picks</h2>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {emailSent ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-semibold text-gray-800">Check your inbox!</p>
                  <p className="text-sm text-gray-500 mt-1">We sent your picks to {email}</p>
                  <Link to="/register?quiz=true" className="mt-4 inline-block text-sm text-orange-600 font-semibold hover:text-orange-700">
                    Create your free RVUnicorn account →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">What's your name?</label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Optional" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <button onClick={handleSendEmail} disabled={!email || sendingEmail} className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition">
                    {sendingEmail ? 'Sending...' : 'Send my campground picks 🏕️'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="h-20" /> {/* spacer for sticky bar */}
    </div>
  );

  // Quiz steps
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <Helmet><title>Find My Campground — RVUnicorn Quiz</title></Helmet>

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← RVUnicorn</Link>
          <span className="text-xs text-gray-400 font-medium">Step {step + 1} of 5</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-lg mx-auto px-4 mt-4">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / 5) * 100}%` }} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Step 1 — RV Type */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">What's your rig?</h2>
            <p className="text-sm text-gray-500 mb-6">This helps us find campgrounds that fit your setup.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['🚌','Class A Motorhome','class-a'],['🚐','Class B / Van','class-b'],
                ['🚍','Class C Motorhome','class-c'],['🏠','Fifth Wheel','fifth-wheel'],
                ['🚗','Travel Trailer','travel-trailer'],['⛺','Tent / Other','tent'],
              ].map(([emoji, label, val]) => (
                <SelectCard key={val} selected={rvType === val} onClick={() => setRvType(val)} emoji={emoji} label={label} />
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Travel Style */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">How do you like to camp?</h2>
            <p className="text-sm text-gray-500 mb-6">We'll match you with the right hookup situation.</p>
            <div className="space-y-3">
              {[
                ['🔌','Full hookups only — I need electric, water & sewer','full-hookups'],
                ['💧','Partial hookups are fine','partial'],
                ['🌿','Love dry camping / boondocking','boondocking'],
                ['🤷','Whatever works','flexible'],
              ].map(([emoji, label, val]) => (
                <SelectCard key={val} selected={travelStyle === val} onClick={() => setTravelStyle(val)} emoji={emoji} label={label} />
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Vibe */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Pick your vibe</h2>
            <p className="text-sm text-gray-500 mb-6">What kind of camping experience are you looking for?</p>
            <div className="space-y-3">
              {[
                ['👨‍👩‍👧','Family fun — pools, playgrounds, activities','family'],
                ['🌲','Nature & quiet — peaceful, off the beaten path','nature'],
                ['🎉','Social scene — meet other campers, events','social'],
                ['🐶','Pet paradise — dog-friendly everywhere','pet'],
                ['🏔️','Adventure base — hiking, kayaking, exploring','adventure'],
              ].map(([emoji, label, val]) => (
                <SelectCard key={val} selected={vibe === val} onClick={() => setVibe(val)} emoji={emoji} label={label} />
              ))}
            </div>
          </div>
        )}

        {/* Step 4 — Priorities */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">What matters most?</h2>
            <p className="text-sm text-gray-500 mb-6">Pick up to 3 must-haves.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['🏊','Pool & water features','pool'],['📶','Good cell signal','cell'],
                ['🏪','Camp store on site','store'],['🚿','Clean bathrooms & showers','showers'],
                ['🌅','Scenic views','scenic'],['🏙️','Close to towns','towns'],
                ['🌲','Remote & secluded','remote'],['🐕','Pet friendly','pet'],
                ['💰','Budget friendly','budget'],['🦺','Big rig friendly','bigrig'],
              ].map(([emoji, label, val]) => (
                <button key={val} onClick={() => togglePriority(val)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left text-sm transition ${priorities.includes(val) ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'} ${priorities.length >= 3 && !priorities.includes(val) ? 'opacity-40' : ''}`}>
                  <span className="text-lg">{emoji}</span>
                  <span className={priorities.includes(val) ? 'font-semibold text-orange-700' : 'text-gray-700'}>{label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">{priorities.length}/3 selected</p>
          </div>
        )}

        {/* Step 5 — States */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Where do you want to explore?</h2>
            <p className="text-sm text-gray-500 mb-6">Pick states or regions. Leave blank for anywhere.</p>
            <div className="space-y-4">
              {Object.entries(US_REGIONS).map(([region, regionStates]) => (
                <div key={region}>
                  <button onClick={() => toggleRegion(region)} className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 hover:text-orange-600 transition">
                    {region} {regionStates.every(s => states.includes(s)) ? '✓' : ''}
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {regionStates.map(s => (
                      <button key={s} onClick={() => toggleState(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${states.includes(s) ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {states.length > 0 && <p className="text-xs text-gray-400 text-center mt-3">{states.length} state{states.length !== 1 ? 's' : ''} selected</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <button onClick={back} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm font-medium transition">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}
          <button onClick={next} disabled={!canProceed()}
            className="flex items-center gap-1 bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 disabled:opacity-40 transition">
            {step === 4 ? 'Find My Campgrounds 🏕️' : 'Next'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
