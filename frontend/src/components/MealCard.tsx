import { useState } from 'react';
import { Clock, MapPin, Users, Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ALLERGEN_COLORS: Record<string, string> = {
  nuts: 'bg-yellow-100 text-yellow-800', dairy: 'bg-blue-100 text-blue-800',
  gluten: 'bg-orange-100 text-orange-800', vegan: 'bg-green-100 text-green-800',
  shellfish: 'bg-red-100 text-red-800',
};

interface Props {
  meal: any;
  eventId: string;
  onUpdate?: () => void;
}

export default function MealCard({ meal, eventId, onUpdate }: Props) {
  const { user } = useAuth() as any;
  const [showAddDish, setShowAddDish] = useState(false);
  const [dishName, setDishName] = useState('');
  const [servings, setServings] = useState('');
  const [allergens, setAllergens] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddDish = async () => {
    if (!dishName.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/events-v2/${eventId}/meals/${meal.id}/dishes`, {
        dishName: dishName.trim(), servings: servings ? parseInt(servings) : null, allergens,
      });
      setDishName(''); setServings(''); setAllergens([]); setShowAddDish(false);
      onUpdate?.();
    } catch {}
    finally { setSubmitting(false); }
  };

  const formatTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-900 text-sm">{meal.title || 'Meal'}</h4>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meal.mealType === 'OFFICIAL' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                {meal.mealType === 'OFFICIAL' ? '⭐ Official' : '👥 Community'}
              </span>
            </div>
            {meal.description && <p className="text-xs text-gray-500 mt-0.5">{meal.description}</p>}
          </div>
          {meal.host?.profilePicture && <img src={meal.host.profilePicture} className="w-8 h-8 rounded-full object-cover" alt="" />}
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          {meal.scheduledAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(meal.scheduledAt)}</span>}
          {meal.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {meal.location}</span>}
          {meal.servings && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {meal.servings} servings</span>}
        </div>

        {/* Dishes */}
        {meal.dishes?.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {meal.dishes.map((dish: any) => (
              <div key={dish.id} className="flex items-center gap-2 text-xs">
                <span className="text-gray-700 font-medium">{dish.dishName}</span>
                {dish.servings && <span className="text-gray-400">({dish.servings} servings)</span>}
                <span className="text-gray-400">— {dish.user?.firstName}</span>
                {dish.allergens?.map((a: string) => (
                  <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded-full ${ALLERGEN_COLORS[a] || 'bg-gray-100 text-gray-600'}`}>{a}</span>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Add dish */}
        {user && !showAddDish && (
          <button onClick={() => setShowAddDish(true)}
            className="mt-3 flex items-center gap-1 text-xs text-orange-600 font-semibold hover:text-orange-700 transition">
            <Plus className="w-3 h-3" /> Add a dish
          </button>
        )}

        {showAddDish && (
          <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2">
            <input value={dishName} onChange={e => setDishName(e.target.value)} placeholder="What are you bringing?"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input value={servings} onChange={e => setServings(e.target.value)} placeholder="Servings (optional)" type="number"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <div className="flex gap-1.5 flex-wrap">
              {['nuts', 'dairy', 'gluten', 'vegan', 'shellfish'].map(a => (
                <button key={a} onClick={() => setAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition ${allergens.includes(a) ? ALLERGEN_COLORS[a] || 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                  {a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddDish} disabled={!dishName.trim() || submitting}
                className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition">
                {submitting ? 'Adding...' : 'Add'}
              </button>
              <button onClick={() => setShowAddDish(false)} className="text-xs text-gray-400">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
