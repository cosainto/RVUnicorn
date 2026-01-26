import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Clock, RefreshCw } from 'lucide-react';
import api from '../services/api';

interface Recipe {
  id: string;
  title: string;
  imageUrl?: string;
  category?: string;
  prepTime?: number;
  cookTime?: number;
  user: {
    firstName: string;
    lastName: string;
    username: string;
  };
  photos?: { imageUrl: string }[];
}

export default function RecipeSuggestions() {
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/recipes/suggestions');
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          Recipes You Might Like
        </h3>
        <button
          onClick={loadSuggestions}
          className="p-1.5 text-gray-400 hover:text-gray-600 transition"
          title="Get new suggestions"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {suggestions.map(recipe => (
          <Link
            key={recipe.id}
            to={`/recipes/${recipe.id}`}
            className="group block rounded-lg overflow-hidden border border-gray-100 hover:border-orange-300 hover:shadow-md transition"
          >
            <div className="aspect-video bg-gray-100 relative overflow-hidden">
              {(recipe.imageUrl || recipe.photos?.[0]?.imageUrl) ? (
                <img
                  src={recipe.imageUrl || recipe.photos?.[0]?.imageUrl}
                  alt={recipe.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  🍳
                </div>
              )}
              {recipe.category && (
                <span className="absolute top-1 left-1 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                  {recipe.category}
                </span>
              )}
            </div>
            <div className="p-2">
              <h4 className="font-medium text-sm text-gray-900 truncate group-hover:text-orange-600">
                {recipe.title}
              </h4>
              <p className="text-xs text-gray-500 truncate">
                by {recipe.user.firstName} {recipe.user.lastName}
              </p>
              {(recipe.prepTime || recipe.cookTime) && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {(recipe.prepTime || 0) + (recipe.cookTime || 0)} min
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
