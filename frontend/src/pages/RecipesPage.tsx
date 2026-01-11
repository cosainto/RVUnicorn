import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, Plus, Globe, Users, Lock, Clock, Star, X, Search, Filter, Camera, Upload, Loader2 } from 'lucide-react';
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
  imageUrl?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

const CATEGORIES = [
  'All',
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'SNACK',
  'DESSERT',
  'DRINK',
];

const DIFFICULTY_COLORS = {
  EASY: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HARD: 'bg-red-100 text-red-700',
};

export default function RecipesPage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    imageUrl: '',
  });

  useEffect(() => {
    loadRecipes();
  }, []);

  useEffect(() => {
    filterRecipes();
  }, [recipes, searchQuery, selectedCategory]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/recipes');
      setRecipes(data.recipes || []);
    } catch (error) {
      console.error('Load recipes error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterRecipes = () => {
    let filtered = recipes;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(r => r.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredRecipes(filtered);
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRecipeImage(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  // Remove selected image
  const removeImage = () => {
    setRecipeImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleCreateRecipe = async () => {
    if (!formData.title || !formData.ingredients || !formData.instructions) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setUploading(true);
      let imageUrl = formData.imageUrl;

      // Upload image if selected
      if (recipeImage) {
        const uploadData = new FormData();
        uploadData.append('image', recipeImage);
        
        const uploadRes = await api.post('/upload', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageUrl = uploadRes.data.url;
      }

      await api.post('/recipes', {
        ...formData,
        imageUrl,
        ingredients: formData.ingredients.split('\n').filter(i => i.trim()),
        prepTime: formData.prepTime ? parseInt(formData.prepTime) : null,
        cookTime: formData.cookTime ? parseInt(formData.cookTime) : null,
        servings: formData.servings ? parseInt(formData.servings) : null,
      });

      alert('✅ Recipe created successfully!');
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
        imageUrl: '',
      });
      removeImage();
      loadRecipes();
    } catch (error) {
      console.error('Create recipe error:', error);
      alert('Failed to create recipe');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

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

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes..."
              className="input w-full pl-10"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
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
              <div className="h-48 bg-gradient-to-br from-orange-100 to-red-100 relative overflow-hidden">
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `http://127.0.0.1:3001${recipe.imageUrl}`}
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
                  {recipe.servings && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>Serves {recipe.servings}</span>
                    </div>
                  )}
                </div>

                {/* Author */}
                <div className="flex items-center gap-2 pt-3 border-t">
                  {recipe.user.profilePicture ? (
                    <img
                      src={recipe.user.profilePicture}
                      alt={recipe.user.firstName}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs text-gray-600">
                        {recipe.user.firstName[0]}
                      </span>
                    </div>
                  )}
                  <span className="text-sm text-gray-700">
                    {recipe.user.firstName} {recipe.user.lastName}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No recipes found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Create Recipe Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-8">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-t-xl sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ChefHat className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">Create Recipe</h2>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    removeImage();
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Recipe Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recipe Photo
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Recipe preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition"
                  >
                    <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Click to upload a photo</p>
                    <p className="text-gray-400 text-sm mt-1">PNG, JPG up to 5MB</p>
                  </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recipe Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full"
                  placeholder="Campfire Chili"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="input w-full"
                  placeholder="A hearty and delicious camping meal..."
                />
              </div>

              {/* Category & Difficulty */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input w-full"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Difficulty *
                  </label>
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

              {/* Time & Servings */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    value={formData.prepTime}
                    onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
                    className="input w-full"
                    placeholder="15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cook Time (min)
                  </label>
                  <input
                    type="number"
                    value={formData.cookTime}
                    onChange={(e) => setFormData({ ...formData, cookTime: e.target.value })}
                    className="input w-full"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Servings
                  </label>
                  <input
                    type="number"
                    value={formData.servings}
                    onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                    className="input w-full"
                    placeholder="4"
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ingredients * (one per line)
                </label>
                <textarea
                  value={formData.ingredients}
                  onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                  rows={6}
                  className="input w-full"
                  placeholder="1 lb ground beef&#10;1 onion, diced&#10;2 cans beans&#10;1 can tomatoes"
                  required
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Instructions *
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={8}
                  className="input w-full"
                  placeholder="1. Brown the ground beef...&#10;2. Add onions and cook until soft...&#10;3. Add remaining ingredients..."
                  required
                />
              </div>

              {/* OR Image URL (fallback) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Or paste Image URL
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="input w-full"
                  placeholder="https://example.com/recipe-image.jpg"
                  disabled={!!recipeImage}
                />
                {recipeImage && (
                  <p className="text-xs text-gray-500 mt-1">URL disabled while image is uploaded</p>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleCreateRecipe}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={!formData.title || !formData.ingredients || !formData.instructions || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>✨ Create Recipe</>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    removeImage();
                  }}
                  className="btn btn-secondary"
                  disabled={uploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
