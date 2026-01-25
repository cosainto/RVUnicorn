import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChefHat, Plus, Globe, Users, Lock, Clock, Star, X, Search, Filter, Camera, Upload, Loader2, SlidersHorizontal, ChevronDown, Heart, MessageCircle, Bookmark } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  category?: string;
  dietaryPreferences?: string[];
  imageUrl?: string;
  likeCount?: number;
  commentCount?: number;
  saveCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

const CATEGORIES = [
  { value: 'All', label: 'All Meals' },
  { value: 'BREAKFAST', label: 'Breakfast' },
  { value: 'LUNCH', label: 'Lunch' },
  { value: 'DINNER', label: 'Dinner' },
  { value: 'SNACK', label: 'Snack' },
  { value: 'DESSERT', label: 'Dessert' },
  { value: 'DRINK', label: 'Drinks' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most_liked', label: 'Most Liked' },
  { value: 'most_commented', label: 'Most Commented' },
  { value: 'most_saved', label: 'Most Saved' },
  { value: 'trending', label: 'Trending' },
  { value: 'top_rated', label: 'Top Rated' },
];

const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'All Recipes' },
  { value: 'my_recipes', label: 'My Recipes' },
  { value: 'liked', label: 'Recipes I\'ve Liked' },
  { value: 'saved', label: 'Recipes I\'ve Saved' },
  { value: 'commented', label: 'Recipes I\'ve Commented On' },
];

const DIETARY_OPTIONS = [
  { value: 'VEGETARIAN', label: 'Vegetarian' },
  { value: 'VEGAN', label: 'Vegan' },
  { value: 'GLUTEN_FREE', label: 'Gluten-Free' },
  { value: 'DAIRY_FREE', label: 'Dairy-Free' },
  { value: 'KETO', label: 'Keto' },
  { value: 'LOW_CARB', label: 'Low-Carb' },
  { value: 'PALEO', label: 'Paleo' },
];

const PREP_TIME_OPTIONS = [
  { value: '', label: 'Any Time' },
  { value: 'under_15', label: 'Under 15 min' },
  { value: '15_30', label: '15-30 min' },
  { value: '30_60', label: '30-60 min' },
  { value: 'over_60', label: '60+ min' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'All', label: 'Any Difficulty' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

const CREATOR_OPTIONS = [
  { value: '', label: 'Anyone' },
  { value: 'by_me', label: 'By Me' },
  { value: 'by_friends', label: 'By Friends' },
];

const DIFFICULTY_COLORS = {
  EASY: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HARD: 'bg-red-100 text-red-700',
};

export default function RecipesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRelationship, setSelectedRelationship] = useState(searchParams.get('tab') || '');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedPrepTime, setSelectedPrepTime] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedCreator, setSelectedCreator] = useState('');

  // Image upload state
  const [recipeImage, setRecipeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ingredients: '',
    instructions: '',
    prepTime: '',
    cookTime: '',
    servings: '',
    difficulty: 'MEDIUM',
    category: 'DINNER',
    dietaryPreferences: [] as string[],
    imageUrl: '',
  });

  // Load recipes when filters change
  useEffect(() => {
    loadRecipes();
  }, [sortBy, selectedCategory, selectedRelationship, selectedDietary, selectedPrepTime, selectedDifficulty, selectedCreator]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadRecipes();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (searchQuery) params.append('search', searchQuery);
      if (sortBy) params.append('sortBy', sortBy);
      if (selectedCategory !== 'All') params.append('category', selectedCategory);
      if (selectedRelationship) params.append('relationship', selectedRelationship);
      if (selectedDietary.length > 0) params.append('dietary', selectedDietary.join(','));
      if (selectedPrepTime) params.append('prepTimeRange', selectedPrepTime);
      if (selectedDifficulty !== 'All') params.append('difficulty', selectedDifficulty);
      if (selectedCreator) params.append('creatorType', selectedCreator);

      const { data } = await api.get(`/recipes?${params.toString()}`);
      setRecipes(data.recipes || []);
    } catch (error) {
      console.error('Load recipes error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDietary = (value: string) => {
    setSelectedDietary(prev => 
      prev.includes(value) 
        ? prev.filter(d => d !== value)
        : [...prev, value]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSortBy('newest');
    setSelectedCategory('All');
    setSelectedRelationship('');
    setSelectedDietary([]);
    setSelectedPrepTime('');
    setSelectedDifficulty('All');
    setSelectedCreator('');
  };

  const activeFilterCount = [
    selectedCategory !== 'All',
    selectedRelationship !== '',
    selectedDietary.length > 0,
    selectedPrepTime !== '',
    selectedDifficulty !== 'All',
    selectedCreator !== '',
  ].filter(Boolean).length;

  const getActiveFilterChips = () => {
    const chips: { label: string; onRemove: () => void }[] = [];
    
    if (selectedCategory !== 'All') {
      chips.push({
        label: CATEGORIES.find(c => c.value === selectedCategory)?.label || selectedCategory,
        onRemove: () => setSelectedCategory('All')
      });
    }
    if (selectedRelationship) {
      chips.push({
        label: RELATIONSHIP_OPTIONS.find(r => r.value === selectedRelationship)?.label || '',
        onRemove: () => setSelectedRelationship('')
      });
    }
    selectedDietary.forEach(d => {
      chips.push({
        label: DIETARY_OPTIONS.find(opt => opt.value === d)?.label || d,
        onRemove: () => setSelectedDietary(prev => prev.filter(x => x !== d))
      });
    });
    if (selectedPrepTime) {
      chips.push({
        label: PREP_TIME_OPTIONS.find(p => p.value === selectedPrepTime)?.label || '',
        onRemove: () => setSelectedPrepTime('')
      });
    }
    if (selectedDifficulty !== 'All') {
      chips.push({
        label: DIFFICULTY_OPTIONS.find(d => d.value === selectedDifficulty)?.label || '',
        onRemove: () => setSelectedDifficulty('All')
      });
    }
    if (selectedCreator) {
      chips.push({
        label: CREATOR_OPTIONS.find(c => c.value === selectedCreator)?.label || '',
        onRemove: () => setSelectedCreator('')
      });
    }
    
    return chips;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRecipeImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      let imageUrl = formData.imageUrl;

      // Upload image if selected
      if (recipeImage) {
        const imageFormData = new FormData();
        imageFormData.append('image', recipeImage);
        const { data: uploadData } = await api.post('/upload/image', imageFormData);
        imageUrl = uploadData.url;
      }

      const ingredientsArray = formData.ingredients
        .split('\n')
        .map(i => i.trim())
        .filter(i => i);

      const instructionsArray = formData.instructions
        .split('\n')
        .map(i => i.trim())
        .filter(i => i);

      await api.post('/recipes', {
        ...formData,
        ingredients: ingredientsArray,
        instructions: instructionsArray,
        prepTime: formData.prepTime ? parseInt(formData.prepTime) : null,
        cookTime: formData.cookTime ? parseInt(formData.cookTime) : null,
        servings: formData.servings ? parseInt(formData.servings) : null,
        imageUrl,
      });

      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        ingredients: '',
        instructions: '',
        prepTime: '',
        cookTime: '',
        servings: '',
        difficulty: 'MEDIUM',
        category: 'DINNER',
        dietaryPreferences: [],
        imageUrl: '',
      });
      setRecipeImage(null);
      setImagePreview(null);
      loadRecipes();
    } catch (error) {
      console.error('Create recipe error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-xl shadow-lg">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Community Recipes</h1>
            <p className="text-gray-600">Discover delicious camping recipes! 🍳</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Recipe
        </button>
      </div>

      {/* Search and Sort Bar */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes, ingredients..."
              className="input w-full pl-10"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn flex items-center gap-2 ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Drawer */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Meal Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Meal Type</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input w-full"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* My Relationship */}
            {user && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">My Relationship</label>
                <select
                  value={selectedRelationship}
                  onChange={(e) => setSelectedRelationship(e.target.value)}
                  className="input w-full"
                >
                  {RELATIONSHIP_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Prep Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prep Time</label>
              <select
                value={selectedPrepTime}
                onChange={(e) => setSelectedPrepTime(e.target.value)}
                className="input w-full"
              >
                {PREP_TIME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="input w-full"
              >
                {DIFFICULTY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Creator */}
            {user && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Creator</label>
                <select
                  value={selectedCreator}
                  onChange={(e) => setSelectedCreator(e.target.value)}
                  className="input w-full"
                >
                  {CREATOR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dietary Preferences */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Preferences</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleDietary(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      selectedDietary.includes(opt.value)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Chips */}
      {getActiveFilterChips().length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {getActiveFilterChips().map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
            >
              {chip.label}
              <button onClick={chip.onRemove} className="hover:text-orange-900">
                <X className="w-4 h-4" />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        {loading ? 'Loading...' : `${recipes.length} recipe${recipes.length !== 1 ? 's' : ''} found`}
      </div>

      {/* Recipe Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : recipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition group"
            >
              {/* Recipe Image */}
              <div className="h-48 bg-gradient-to-br from-orange-100 to-red-100 relative overflow-hidden">
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `${recipe.imageUrl}`}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ChefHat className="w-16 h-16 text-orange-300" />
                  </div>
                )}
                {recipe.difficulty && (
                  <span className={`absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-semibold ${DIFFICULTY_COLORS[recipe.difficulty as keyof typeof DIFFICULTY_COLORS]}`}>
                    {recipe.difficulty}
                  </span>
                )}
              </div>

              {/* Recipe Info */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                  {recipe.title}
                </h3>
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
                      <span>{recipe.prepTime} min</span>
                    </div>
                  )}
                  {recipe.category && (
                    <span className="bg-gray-100 px-2 py-0.5 rounded">
                      {recipe.category}
                    </span>
                  )}
                </div>

                {/* Engagement Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <div className="flex items-center gap-1">
                    <Heart className={`w-3 h-3 ${recipe.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                    <span>{recipe.likeCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>{recipe.commentCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bookmark className={`w-3 h-3 ${recipe.isSaved ? 'fill-orange-500 text-orange-500' : ''}`} />
                    <span>{recipe.saveCount || 0}</span>
                  </div>
                </div>

                {/* Author */}
                <div className="flex items-center gap-2">
                  {recipe.user?.profilePicture ? (
                    <img
                      src={recipe.user.profilePicture}
                      alt={recipe.user.firstName}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center">
                      <span className="text-xs text-orange-700">
                        {recipe.user?.firstName?.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="text-sm text-gray-600">
                    {recipe.user?.firstName} {recipe.user?.lastName}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your filters or search terms</p>
          <button
            onClick={clearAllFilters}
            className="btn btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Create Recipe Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold">Create New Recipe</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="p-6 space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipe Photo</label>
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-orange-500 transition"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded" />
                  ) : (
                    <>
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">Click to upload a photo</p>
                    </>
                  )}
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input w-full"
                  >
                    {CATEGORIES.filter(c => c.value !== 'All').map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="input w-full"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              {/* Dietary Preferences for Create */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Preferences</label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const current = formData.dietaryPreferences;
                        if (current.includes(opt.value)) {
                          setFormData({ ...formData, dietaryPreferences: current.filter(d => d !== opt.value) });
                        } else {
                          setFormData({ ...formData, dietaryPreferences: [...current, opt.value] });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        formData.dietaryPreferences.includes(opt.value)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (min)</label>
                  <input
                    type="number"
                    value={formData.prepTime}
                    onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cook Time (min)</label>
                  <input
                    type="number"
                    value={formData.cookTime}
                    onChange={(e) => setFormData({ ...formData, cookTime: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
                  <input
                    type="number"
                    value={formData.servings}
                    onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingredients (one per line) *</label>
                <textarea
                  value={formData.ingredients}
                  onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                  className="input w-full"
                  rows={4}
                  placeholder="1 cup flour&#10;2 eggs&#10;1/2 cup sugar"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (one per line) *</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="input w-full"
                  rows={4}
                  placeholder="Preheat oven to 350°F&#10;Mix dry ingredients&#10;Add wet ingredients"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn btn-primary flex-1 flex items-center justify-center"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Recipe'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
