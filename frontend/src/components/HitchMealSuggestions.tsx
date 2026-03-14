import { useState } from 'react';
import { ChefHat, Loader, Plus, Clock } from 'lucide-react';
import api from '../services/api';

interface Props {
  eventId: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  groupSize?: number;
}

export default function HitchMealSuggestions({ eventId, destination, startDate, endDate, groupSize }: Props) {
  const [loading, setLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<any>(null);
  const [shown, setShown] = useState(false);

  const nights = startDate && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 3;

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/meal-suggestions', {
        destination, nights, groupSize
      });
      setMealPlan(data);
      setShown(true);
    } catch { alert('Hitch had trouble generating meals. Try again!'); }
    finally { setLoading(false); }
  };

  const addMeal = async (mealName: string, mealType: string, day: number) => {
    try {
      await api.post(`/events/${eventId}/meals`, {
        name: mealName, mealType: mealType.toUpperCase(), day,
      });
    } catch {}
  };

  if (!shown) {
    return (
      <button onClick={generate} disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition shadow-sm">
        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <img src="/hitch.png" className="w-5 h-5 rounded-full" />}
        {loading ? 'Hitch is cooking...' : '🍳 Get AI Meal Plan'}
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <img src="/hitch.png" className="w-8 h-8 rounded-full" />
        <div>
          <p className="font-bold text-gray-900 text-sm">Hitch's Meal Plan</p>
          <p className="text-xs text-gray-500">{nights}-night campfire menu for {groupSize || 2} people</p>
        </div>
        <button onClick={generate} disabled={loading} className="ml-auto text-xs text-amber-600 hover:underline">
          Regenerate
        </button>
      </div>

      <div className="space-y-4">
        {(mealPlan?.meals || []).map((day: any) => (
          <div key={day.day} className="bg-white rounded-xl p-4 border border-amber-100">
            <p className="font-bold text-gray-800 text-sm mb-3">Day {day.day}</p>
            <div className="space-y-2">
              {['breakfast', 'lunch', 'dinner'].map(type => {
                const meal = day[type];
                if (!meal) return null;
                return (
                  <div key={type} className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase w-16">{type}</span>
                        <p className="text-sm font-semibold text-gray-800">{meal.name}</p>
                      </div>
                      <p className="text-xs text-gray-500 ml-16">{meal.description}</p>
                      <div className="flex items-center gap-3 ml-16 mt-0.5">
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{meal.prepTime}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${meal.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : meal.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{meal.difficulty}</span>
                      </div>
                    </div>
                    <button onClick={() => addMeal(meal.name, type, day.day)}
                      className="shrink-0 p-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            {day.snacks?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-50">
                <p className="text-xs text-gray-400">Snacks: {day.snacks.join(' · ')}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {mealPlan?.shoppingTips?.length > 0 && (
        <div className="mt-3 p-3 bg-white rounded-xl border border-amber-100">
          <p className="text-xs font-bold text-amber-700 mb-1">🛒 Shopping Tips</p>
          {mealPlan.shoppingTips.map((tip: string, i: number) => (
            <p key={i} className="text-xs text-gray-600">• {tip}</p>
          ))}
        </div>
      )}
    </div>
  );
}
