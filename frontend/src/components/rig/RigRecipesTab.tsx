import { useState, useEffect } from 'react';
import { Star, Heart, Bookmark, Loader2, Clock, Users, ChefHat } from 'lucide-react';
import api from '../../services/api';

const METHOD_EMOJI: Record<string, string> = { CAMPFIRE: '🔥', DUTCH_OVEN: '🏺', GRILL: '🥩', SKILLET: '🍳', NO_COOK: '🥗', INSTANT_POT: '⚡', OTHER: '🍽️' };
const DIFF_COLORS: Record<string, string> = { EASY: 'bg-green-500/20 text-green-400', MODERATE: 'bg-amber-500/20 text-amber-400', HARD: 'bg-red-500/20 text-red-400' };

interface Props { slug: string; isOwner: boolean; }

export default function RigRecipesTab({ slug, isOwner }: Props) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, [slug]);

  const load = async () => {
    try { const { data } = await api.get(`/rigs/${slug}/recipes`); setRecipes(data); } catch {}
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;

  if (recipes.length === 0) return (
    <div className="text-center py-12">
      <span className="text-4xl block mb-2">🔥</span>
      <h3 className="font-bold text-white">Campfire Kitchen</h3>
      <p className="text-xs text-white/40 mt-1">Share your favorite recipes from the road</p>
    </div>
  );

  const filters = ['ALL', 'CAMPFIRE', 'DUTCH_OVEN', 'GRILL', 'SKILLET', 'NO_COOK'];
  const filtered = filter === 'ALL' ? recipes : recipes.filter(r => r.cookingMethod === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">🔥 Campfire Kitchen · {recipes.length} recipes</h3>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${filter === f ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/40'}`}>
            {f === 'ALL' ? '✨ All' : `${METHOD_EMOJI[f] || '🍽️'} ${f.replace(/_/g, ' ')}`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {r.photoUrls?.[0] && <img src={r.photoUrls[0]} alt={r.title} className="w-full h-44 object-cover" />}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-bold text-white flex-1">{r.title}</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">{METHOD_EMOJI[r.cookingMethod] || '🍽️'} {r.cookingMethod.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex gap-2 text-[10px] text-white/40">
                <span className={`px-1.5 py-0.5 rounded-full ${DIFF_COLORS[r.difficulty] || DIFF_COLORS.EASY}`}>{r.difficulty}</span>
                {r.prepTimeMinutes && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{r.prepTimeMinutes + (r.cookTimeMinutes || 0)} min</span>}
                {r.servings && <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{r.servings} servings</span>}
              </div>
              {r.description && <p className="text-xs text-white/50 mt-1.5 line-clamp-2">{r.description}</p>}

              <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-[10px] text-amber-400 mt-2 font-semibold">
                {expanded === r.id ? 'Hide Details' : 'View Recipe →'}
              </button>

              {expanded === r.id && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                  {Array.isArray(r.ingredients) && (
                    <div>
                      <h5 className="text-xs font-bold text-white/70 mb-1">Ingredients</h5>
                      <ul className="space-y-0.5">
                        {r.ingredients.map((ing: any, i: number) => (
                          <li key={i} className="text-xs text-white/50">• {typeof ing === 'string' ? ing : `${ing.amount || ''} ${ing.unit || ''} ${ing.name || ''}`}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(r.steps) && (
                    <div>
                      <h5 className="text-xs font-bold text-white/70 mb-1">Steps</h5>
                      <ol className="space-y-1">
                        {r.steps.map((step: any, i: number) => (
                          <li key={i} className="text-xs text-white/50"><span className="font-bold text-amber-400 mr-1">{i + 1}.</span> {typeof step === 'string' ? step : step.instruction || step.text || ''}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                <span><Heart className="w-3 h-3 inline" /> {r.likes}</span>
                <span><Bookmark className="w-3 h-3 inline" /> {r.saves}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
