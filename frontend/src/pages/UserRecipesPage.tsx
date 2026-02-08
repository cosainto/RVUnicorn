import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChefHat, Star, Clock, Users, Heart, Trash2, Calendar } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AddRecipeToEventModal from '../components/AddRecipeToEventModal';

interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  ingredients?: string[];
  createdAt: string;
  isFavorite?: boolean;
  favorite?: boolean;
  savedRecipeId?: string;
  source?: 'uploaded' | 'saved' | 'liked';
  author: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  _count?: {
    ratings: number;
  };
}

export default function UserRecipesPage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [showAddToEventModal, setShowAddToEventModal] = useState(false);
  const [selectedRecipeForEvent, setSelectedRecipeForEvent] = useState<Recipe | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'uploaded' | 'saved' | 'liked'>('all');
  const [counts, setCounts] = useState({ uploaded: 0, saved: 0, liked: 0 });

  const isOwnProfile = user?.username === username;

  useEffect(() => {
    loadRecipes();
  }, [username]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/profile/${username}/recipes`);
      setRecipes(data.recipes || []);
      setCounts(data.counts || { uploaded: 0, saved: 0, liked: 0 });
      if (data.profileName) {
        setProfileName(data.profileName);
      } else if (user?.username === username) {
        setProfileName(`${user.firstName} ${user.lastName}`);
      }
    } catch (error) {
      console.error('Load recipes error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = async (recipeId: string, currentFavorite: boolean) => {
    if (!user) {
      alert('Please login to favorite recipes');
      return;
    }

    try {
      await api.put(`/recipes/${recipeId}/favorite`);
      
      setRecipes(recipes.map(recipe => 
        recipe.id === recipeId 
          ? { ...recipe, isFavorite: !currentFavorite, favorite: !currentFavorite }
          : recipe
      ));
    } catch (error) {
      console.error('Favorite toggle error:', error);
      alert('Failed to toggle favorite');
    }
  };

  const handleDelete = async (recipeId: string, recipeTitle: string) => {
    if (!confirm(`Remove "${recipeTitle}" from your Recipe Box?`)) return;

    try {
      await api.delete(`/recipes/${recipeId}/save`);
      
      setRecipes(recipes.filter(recipe => recipe.id !== recipeId));
      
      alert('Recipe removed from your Recipe Box!');
    } catch (error) {
      console.error('Delete recipe error:', error);
      alert('Failed to remove recipe');
    }
  };

  const handleAddToEvent = (recipe: Recipe) => {
    setSelectedRecipeForEvent(recipe);
    setShowAddToEventModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={`/profile/${username}`}
          className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-block"
        >
          ← Back to Profile
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ChefHat className="w-8 h-8 text-red-600" />
          {isOwnProfile ? 'My Recipe Box' : `${profileName}'s Recipe Box`}
        </h1>
        <p className="text-gray-600 mt-2">
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
        </p>

        {/* Filter Tabs */}
        {isOwnProfile && recipes.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All ({recipes.length})
            </button>
            <button
              onClick={() => setActiveFilter('uploaded')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeFilter === 'uploaded' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              📝 My Recipes ({counts.uploaded})
            </button>
            <button
              onClick={() => setActiveFilter('saved')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeFilter === 'saved' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              🔖 Saved ({counts.saved})
            </button>
            <button
              onClick={() => setActiveFilter('liked')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeFilter === 'liked' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              ❤️ Liked ({counts.liked})
            </button>
          </div>
        )}
      </div>

      {/* Recipes Grid */}
      {recipes.filter(r => activeFilter === 'all' || r.source === activeFilter).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.filter(r => activeFilter === 'all' || r.source === activeFilter).map((recipe) => {
            const isFavorited = recipe.isFavorite || recipe.favorite || false;
            
            return (
              <div
                key={recipe.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition relative"
              >
                {/* Recipe Image */}
                <Link to={`/recipes/${recipe.id}`} className="block">
                  <div className="aspect-video bg-gradient-to-br from-red-100 to-orange-100 relative">
                    {recipe.imageUrl ? (
                      <img
                        src={`${recipe.imageUrl}`}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat className="w-16 h-16 text-red-300" />
                      </div>
                    )}
                    
                    {/* Source Badge */}
                    {recipe.source === 'uploaded' && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full shadow">📝 My Recipe</div>
                    )}
                    {recipe.source === 'saved' && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-full shadow">🔖 Saved</div>
                    )}
                    {recipe.source === 'liked' && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow">❤️ Liked</div>
                    )}

                    {/* Favorite Badge */}
                    {isFavorited && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 shadow-lg">
                        <Heart className="w-5 h-5 fill-white" />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Recipe Info */}
                <div className="p-4">
                  <Link to={`/recipes/${recipe.id}`} className="block">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-gray-900 line-clamp-2 flex-1">
                        {recipe.title}
                      </h3>
                      {isFavorited && (
                        <span className="ml-2 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full flex-shrink-0">
                          ⭐ Favorite
                        </span>
                      )}
                    </div>
                    
                    {recipe.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {recipe.description}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      {recipe.prepTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{recipe.prepTime + (recipe.cookTime || 0)} min</span>
                        </div>
                      )}
                      
                      {recipe.servings && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{recipe.servings} servings</span>
                        </div>
                      )}

                      {recipe._count && recipe._count.ratings > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          <span>{recipe._count.ratings} ratings</span>
                        </div>
                      )}
                    </div>

                    {/* Author */}
                    <p className="text-xs text-gray-500">
                      By {recipe.author.firstName} {recipe.author.lastName}
                    </p>
                  </Link>

                  {/* Action Buttons - Only show on own profile */}
                  {isOwnProfile && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                      {/* Add to Event Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToEvent(recipe);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg transition"
                        title="Add to Event Meal Plan"
                      >
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">Add to Event</span>
                      </button>

                      {/* Favorite Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFavoriteToggle(recipe.id, isFavorited);
                        }}
                        className={`px-3 py-2 rounded-lg transition ${
                          isFavorited
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={isFavorited ? 'Remove from Favorites' : 'Mark as Favorite'}
                      >
                        <Heart className={`w-4 h-4 ${isFavorited ? 'fill-white' : ''}`} />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(recipe.id, recipe.title);
                        }}
                        className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
                        title="Remove from Recipe Box"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <ChefHat className="w-24 h-24 mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Recipes Yet</h2>
          <p className="text-gray-600 mb-6">
            {isOwnProfile 
              ? "You haven't saved any recipes yet. Browse the community recipes to get started!"
              : `${profileName} hasn't saved any recipes yet.`
            }
          </p>
          {isOwnProfile && (
            <Link to="/recipes" className="btn btn-primary">
              Browse Community Recipes
            </Link>
          )}
        </div>
      )}

      {/* Add to Event Modal */}
      {selectedRecipeForEvent && (
        <AddRecipeToEventModal
          recipe={{
            id: selectedRecipeForEvent.id,
            title: selectedRecipeForEvent.title,
            ingredients: selectedRecipeForEvent.ingredients
          }}
          isOpen={showAddToEventModal}
          onClose={() => {
            setShowAddToEventModal(false);
            setSelectedRecipeForEvent(null);
          }}
        />
      )}
    </div>
  );
}
