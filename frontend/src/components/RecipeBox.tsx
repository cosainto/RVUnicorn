import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChefHat, 
  Plus, 
  Clock, 
  Users, 
  Star, 
  Lock, 
  Globe,
  Search,
  Filter,
  X
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Recipe {
  id: string;
  title: string;
  description?: string;
  category?: string;
  difficulty: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  privacy: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  photos: {
    imageUrl: string;
  }[];
  _count: {
    comments: number;
    ratings: number;
    shares: number;
  };
  avgRating?: number;
  totalRatings?: number;
}

interface RecipeBoxProps {
  userId: string;
  isOwnProfile: boolean;
}

const CATEGORIES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
  'Dessert',
  'Appetizer',
  'Side Dish',
  'Drink'
];

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

export default function RecipeBox({ userId, isOwnProfile }: RecipeBoxProps) {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: 'ALL',
    difficulty: 'ALL',
  });

  useEffect(() => {
    loadRecipes();
  }, [userId, filters]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      
      // Build base params
      const baseParams: any = {};
      if (filters.category !== 'ALL') {
        baseParams.category = filters.category;
      }
      if (filters.difficulty !== 'ALL') {
        baseParams.difficulty = filters.difficulty;
      }

      // Fetch user's created recipes
      const createdParams = new URLSearchParams({ 
        ...baseParams, 
        relationship: 'my_recipes' 
      });
      const { data: createdRecipes } = await api.get(`/recipes?${createdParams.toString()}`);

      // Fetch user's saved/favorited recipes
      const savedParams = new URLSearchParams({ 
        ...baseParams, 
        relationship: 'saved' 
      });
      const { data: savedRecipes } = await api.get(`/recipes?${savedParams.toString()}`);

      // Combine and deduplicate (in case user saved their own recipe)
      const allRecipes = [...createdRecipes];
      const createdIds = new Set(createdRecipes.map((r: any) => r.id));
      
      for (const recipe of savedRecipes) {
        if (!createdIds.has(recipe.id)) {
          allRecipes.push({ ...recipe, isSaved: true });
        }
      }

      // Sort by created date
      allRecipes.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setRecipes(allRecipes);
    } catch (error) {
      console.error('Load recipes error:', error);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearFilters = () => {
    setFilters({ category: 'ALL', difficulty: 'ALL' });
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading recipes...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-primary-600" />
            <h2 className="text-2xl font-bold text-gray-900">Recipe Box</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary flex items-center"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
            {isOwnProfile && (
              <Link to="/recipes/new" className="btn btn-primary flex items-center">
                <Plus className="w-4 h-4 mr-2" />
                New Recipe
              </Link>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search recipes..."
            className="input pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="input"
                >
                  <option value="ALL">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty
                </label>
                <select
                  value={filters.difficulty}
                  onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                  className="input"
                >
                  <option value="ALL">All Levels</option>
                  {DIFFICULTIES.map((diff) => (
                    <option key={diff} value={diff}>
                      {diff.charAt(0) + diff.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={clearFilters}
              className="btn btn-secondary w-full mt-4"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition group"
            >
              {/* Recipe Image */}
              <div className="relative h-48 bg-gray-200">
                {recipe.photos[0] ? (
                  <img
                    src={`${recipe.photos[0].imageUrl}`}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                ) : (
                  <img
                    src="/Recipe_default.png"
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                )}
                
                {/* Privacy Badge */}
                <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded-full p-2">
                  {recipe.privacy === 'PUBLIC' ? (
                    <Globe className="w-4 h-4 text-green-600" />
                  ) : recipe.privacy === 'FRIENDS' ? (
                    <Users className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-gray-600" />
                  )}
                </div>

                {/* Rating Badge */}
                {recipe.avgRating && recipe.avgRating > 0 && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white rounded-full px-2 py-1 flex items-center gap-1 text-sm font-semibold">
                    <Star className="w-3 h-3 fill-current" />
                    {recipe.avgRating.toFixed(1)}
                  </div>
                )}
              </div>

              {/* Recipe Info */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1">
                  {recipe.title}
                </h3>
                
                {recipe.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {recipe.description}
                  </p>
                )}

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                  {recipe.prepTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {recipe.prepTime + (recipe.cookTime || 0)}m
                    </div>
                  )}
                  {recipe.servings && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {recipe.servings}
                    </div>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    recipe.difficulty === 'EASY' ? 'bg-green-100 text-green-700' :
                    recipe.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {recipe.difficulty.charAt(0) + recipe.difficulty.slice(1).toLowerCase()}
                  </span>
                </div>

                {/* Category */}
                {recipe.category && (
                  <div className="text-xs text-gray-500 mb-2">
                    {recipe.category}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-600 pt-3 border-t border-gray-200">
                  <span>{recipe._count.ratings} ratings</span>
                  <span>•</span>
                  <span>{recipe._count.comments} comments</span>
                  {recipe._count.shares > 0 && (
                    <>
                      <span>•</span>
                      <span>{recipe._count.shares} shares</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm || filters.category !== 'ALL' || filters.difficulty !== 'ALL'
              ? 'No recipes found'
              : 'No recipes yet'}
          </h3>
          {isOwnProfile && !searchTerm && filters.category === 'ALL' && filters.difficulty === 'ALL' && (
            <>
              <p className="text-gray-600 mb-4">Start building your recipe collection!</p>
              <Link to="/recipes/new" className="btn btn-primary inline-flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Recipe
              </Link>
            </>
          )}
          {(searchTerm || filters.category !== 'ALL' || filters.difficulty !== 'ALL') && (
            <button onClick={clearFilters} className="btn btn-secondary mt-4">
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
