import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ChefHat,
  Share2, 
  Clock, 
  Users, 
  Star, 
  ArrowLeft, 
  Globe, 
  Lock, 
  MessageSquare,
  Bookmark,
  BookmarkCheck,
  Heart,
  Edit,
  Trash2,
  Camera,
  X,
  Copy,
  Calendar,
  Save,
  Loader2,
  AtSign,
  ThumbsUp,
  ThumbsDown,
  MessageCircle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AddRecipeToEventModal from '../components/AddRecipeToEventModal';

interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  cuisine?: string;
  category?: string;
  privacy?: string;
  imageUrl?: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  _count?: {
    ratings: number;
    comments: number;
  };
  averageRating?: number;
  userRating?: number;
  isSaved?: boolean;
  isFavorite?: boolean;
  isLiked?: boolean;
  likeCount?: number;
}

interface Friend {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture?: string;
}

interface Comment {
  id: string;
  content: string;
  imageUrl?: string;
  mentions?: string[];
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

const CATEGORIES = [
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'SNACK',
  'DESSERT',
  'DRINK',
];

export default function RecipeDetailPage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const handleLike = async () => {
    if (!user || !recipe) return;
    try {
      const { data } = await api.post(`/recipes/${recipe.id}/like`);
      setIsLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleShare = async () => {
    if (!user || !recipe) return;
    try {
      await api.post(`/recipes/${recipe.id}/share`);
      alert('Recipe shared to your feed!');
    } catch (error) {
      console.error('Share error:', error);
      alert('Failed to share recipe');
    }
  };
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingQuickImage, setUploadingQuickImage] = useState(false);
  const quickImageInputRef = useRef<HTMLInputElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [showAddToEventModal, setShowAddToEventModal] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    ingredients: '',
    instructions: '',
    prepTime: '',
    cookTime: '',
    servings: '',
    difficulty: 'MEDIUM',
    category: 'DINNER',
    privacy: 'PUBLIC',
  });
  const [recipeImage, setRecipeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (recipeId) {
      loadRecipe();
      loadComments();
    }
  }, [recipeId]);

  const loadRecipe = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/recipes/${recipeId}`);
      setRecipe(data);
      setRating(data.userRating || 0);
      
      // Initialize edit form data
      setEditFormData({
        title: data.title || '',
        description: data.description || '',
        ingredients: (data.ingredients || []).join('\n'),
        instructions: (data.instructions || []).join('\n'),
        prepTime: data.prepTime?.toString() || '',
        cookTime: data.cookTime?.toString() || '',
        servings: data.servings?.toString() || '',
        difficulty: data.difficulty || 'MEDIUM',
        category: data.category || 'DINNER',
        privacy: data.privacy || 'PUBLIC',
      });
      
      console.log('Recipe loaded:', {
        isSaved: data.isSaved,
        isFavorite: data.isFavorite,
        averageRating: data.averageRating,
        userRating: data.userRating,
        ratingsCount: data._count?.ratings
      });
    } catch (error) {
      console.error('Load recipe error:', error);
      alert('Failed to load recipe');
      navigate('/recipes');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const { data } = await api.get(`/recipes/${recipeId}/comments`);
      setComments(data);
    } catch (error) {
      console.error('Load comments error:', error);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!user) return;
    try {
      const { data } = await api.post(`/recipes/comments/${commentId}/like`);
      setComments(comments.map(c => 
        c.id === commentId 
          ? { ...c, userHasLiked: data.liked, likeCount: c.likeCount + (data.liked ? 1 : -1) }
          : c
      ));
    } catch (error) {
      console.error('Comment like error:', error);
    }
  };

  const handleCommentReaction = async (commentId: string, reaction: string) => {
    if (!user) return;
    try {
      await api.post(`/recipes/comments/${commentId}/react`, { reaction });
      setComments(comments.map(c => 
        c.id === commentId 
          ? { ...c, userReaction: c.userReaction === reaction ? null : reaction }
          : c
      ));
    } catch (error) {
      console.error('Comment reaction error:', error);
    }
  };

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data.map((f: any) => f.friend));
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const handleCommentInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);
    setCursorPosition(e.target.selectionStart || 0);

    const textBeforeCursor = value.substring(0, e.target.selectionStart || 0);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setShowMentions(true);
      setMentionSearch(mentionMatch[1].toLowerCase());
      if (friends.length === 0) loadFriends();
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username: string) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    const newText = textBeforeCursor.replace(/@(\w*)$/, `@${username} `) + textAfterCursor;
    setNewComment(newText);
    setShowMentions(false);
    commentInputRef.current?.focus();
  };

  const filteredFriends = friends.filter(
    (f) => f.username.toLowerCase().includes(mentionSearch) ||
           `${f.firstName} ${f.lastName}`.toLowerCase().includes(mentionSearch)
  );

  const renderCommentContent = (commentContent: string) => {
    return commentContent.split(/(@\w+)/g).map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        return (
          <Link
            key={index}
            to={`/profile/${username}`}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  // Handle recipe image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRecipeImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  // Quick image upload for recipe (without edit mode)
  const handleQuickImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recipe) return;

    setUploadingQuickImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const { data: uploadData } = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update recipe with new image
      await api.put(`/recipes/${recipe.id}`, { imageUrl: uploadData.url });
      
      // Update local state
      setRecipe({ ...recipe, imageUrl: uploadData.url });
    } catch (error) {
      console.error('Quick image upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingQuickImage(false);
      if (quickImageInputRef.current) {
        quickImageInputRef.current.value = '';
      }
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

  // Start editing
  const startEditing = () => {
    setIsEditing(true);
    // Reset image state
    setRecipeImage(null);
    setImagePreview(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    removeImage();
    // Reset form to original values
    if (recipe) {
      setEditFormData({
        title: recipe.title || '',
        description: recipe.description || '',
        ingredients: (recipe.ingredients || []).join('\n'),
        instructions: (recipe.instructions || []).join('\n'),
        prepTime: recipe.prepTime?.toString() || '',
        cookTime: recipe.cookTime?.toString() || '',
        servings: recipe.servings?.toString() || '',
        difficulty: recipe.difficulty || 'MEDIUM',
        category: recipe.category || 'DINNER',
        privacy: recipe.privacy || 'PUBLIC',
      });
    }
  };

  // Save recipe edits
  const handleSaveEdits = async () => {
    if (!editFormData.title.trim()) {
      alert('Please enter a recipe title');
      return;
    }

    try {
      setSaving(true);
      let imageUrl = recipe?.imageUrl;

      // Upload new image if selected
      if (recipeImage) {
        const uploadData = new FormData();
        uploadData.append('image', recipeImage);
        
        const uploadRes = await api.post('/upload', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageUrl = uploadRes.data.url;
      }

      await api.put(`/recipes/${recipeId}`, {
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || null,
        ingredients: editFormData.ingredients.split('\n').filter(i => i.trim()),
        instructions: editFormData.instructions.split('\n').filter(i => i.trim()),
        prepTime: editFormData.prepTime ? parseInt(editFormData.prepTime) : null,
        cookTime: editFormData.cookTime ? parseInt(editFormData.cookTime) : null,
        servings: editFormData.servings ? parseInt(editFormData.servings) : null,
        difficulty: editFormData.difficulty,
        category: editFormData.category,
        privacy: editFormData.privacy,
        imageUrl,
      });

      setIsEditing(false);
      removeImage();
      await loadRecipe();
      alert('Recipe updated successfully!');
    } catch (error) {
      console.error('Save recipe error:', error);
      alert('Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!user) {
      alert('Please login to save recipes');
      return;
    }

    try {
      if (recipe?.isSaved) {
        await api.delete(`/recipes/${recipeId}/save`);
      } else {
        await api.post(`/recipes/${recipeId}/save`);
      }
      await loadRecipe();
    } catch (error) {
      console.error('Save toggle error:', error);
      alert('Failed to save recipe');
    }
  };

  const handleFavoriteToggle = async () => {
    if (!user) {
      alert('Please login to favorite recipes');
      return;
    }


    try {
      await api.put(`/recipes/${recipeId}/favorite`);
      await loadRecipe();
    } catch (error) {
      console.error('Favorite toggle error:', error);
      alert('Failed to toggle favorite');
    }
  };

  const handleRate = async (newRating: number) => {
    if (!user) {
      alert('Please login to rate recipes');
      return;
    }

    try {
      await api.post(`/recipes/${recipeId}/rate`, { rating: newRating });
      setRating(newRating);
      await loadRecipe();
    } catch (error) {
      console.error('Rate recipe error:', error);
      alert('Failed to rate recipe');
    }
  };

  const handleCommentImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCommentImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeCommentImage = () => {
    setCommentImage(null);
    setCommentImagePreview('');
  };

  const handleAddComment = async () => {
    if (!user) {
      alert('Please login to comment');
      return;
    }

    if (!newComment.trim()) {
      alert('Please enter a comment');
      return;
    }

    try {
      setSubmittingComment(true);
      let imageUrl = '';

      if (commentImage) {
        const formData = new FormData();
        formData.append('image', commentImage);

        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageUrl = uploadRes.data.url;
      }

      // Extract mentions from content
      const mentionRegex = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(newComment)) !== null) {
        mentions.push(match[1]);
      }

      await api.post(`/recipes/${recipeId}/comments`, { 
        content: newComment.trim(),
        imageUrl: imageUrl || undefined,
        mentions
      });

      setNewComment('');
      setCommentImage(null);
      setCommentImagePreview('');
      await loadComments();
      await loadRecipe();
    } catch (error) {
      console.error('Add comment error:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCopyRecipe = async () => {
    if (!user) {
      alert('Please login to copy recipes');
      return;
    }

    if (!recipe) return;

    try {
      const { data: savedRecipes } = await api.get(`/profile/${user.username}/recipes`);
      
      const duplicateTitle = savedRecipes.recipes?.find(
        (r: any) => r.title.toLowerCase() === recipe.title.toLowerCase() || 
                    r.title.toLowerCase() === `${recipe.title} (copy)`.toLowerCase()
      );

      if (duplicateTitle) {
        alert(`You already have a recipe called "${duplicateTitle.title}" in your Recipe Box. Please choose a different name.`);
        return;
      }

      const copiedRecipe = await api.post('/recipes', {
        title: `${recipe.title} (Copy)`,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        category: recipe.category,
        privacy: 'PRIVATE',
        imageUrl: recipe.imageUrl,
      });

      const newRecipeId = copiedRecipe.data.id;

      await api.post(`/recipes/${newRecipeId}/save`);

      if (recipe.isFavorite) {
        await api.put(`/recipes/${newRecipeId}/favorite`);
      }

      alert('Recipe copied to your Recipe Box! Redirecting...');
      navigate(`/recipes/${newRecipeId}`);
    } catch (error) {
      console.error('Copy recipe error:', error);
      alert('Failed to copy recipe');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await api.delete(`/recipes/${recipeId}`);
      alert('Recipe deleted!');
      navigate('/recipes');
    } catch (error) {
      console.error('Delete recipe error:', error);
      alert('Failed to delete recipe');
    }
  };

  const getPrivacyIcon = () => {
    const privacy = isEditing ? editFormData.privacy : recipe?.privacy;
    switch (privacy) {
      case 'PRIVATE':
        return <Lock className="w-5 h-5 text-gray-600" />;
      case 'FRIENDS':
        return <Users className="w-5 h-5 text-blue-600" />;
      default:
        return <Globe className="w-5 h-5 text-green-600" />;
    }
  };

  const getPrivacyLabel = () => {
    const privacy = isEditing ? editFormData.privacy : recipe?.privacy;
    switch (privacy) {
      case 'PRIVATE':
        return 'Private';
      case 'FRIENDS':
        return 'Friends Only';
      default:
        return 'Public';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Recipe not found</h2>
          <Link to="/recipes" className="btn btn-primary">
            Browse Recipes
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = recipe.user.id === user?.id;
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Link
        to="/recipes"
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Recipes
      </Link>

      {/* Recipe Header */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        {/* Recipe Image */}
        {isEditing ? (
          <div className="relative">
            {imagePreview || recipe.imageUrl ? (
              <div className="relative">
                <img
                  src={imagePreview || `${recipe.imageUrl}`}
                  alt={recipe.title}
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center gap-4">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="bg-white text-gray-800 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-100 transition"
                  >
                    <Camera className="w-5 h-5" />
                    Change Photo
                  </button>
                  {imagePreview && (
                    <button
                      onClick={removeImage}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-600 transition"
                    >
                      <X className="w-5 h-5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                onClick={() => imageInputRef.current?.click()}
                className="w-full h-64 bg-gradient-to-br from-red-100 to-orange-100 flex flex-col items-center justify-center cursor-pointer hover:from-red-200 hover:to-orange-200 transition"
              >
                <Camera className="w-16 h-16 text-orange-400 mb-3" />
                <p className="text-orange-600 font-medium">Click to add a recipe photo</p>
                <p className="text-orange-400 text-sm mt-1">PNG, JPG up to 5MB</p>
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
        ) : (
          <div className="relative group">
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `${recipe.imageUrl}`}
                alt={recipe.title}
                className="w-full h-64 object-cover"
              />
            ) : (
              <div className="w-full h-64 bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center">
                <ChefHat className="w-24 h-24 text-red-300" />
              </div>
            )}
            {isOwner && (
              <label className={`absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${recipe.imageUrl ? 'bg-black/50 text-white opacity-0 group-hover:opacity-100' : 'bg-white shadow-lg text-gray-700 hover:bg-gray-50'}`}>
                {uploadingQuickImage ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
                <span className="font-medium">{recipe.imageUrl ? 'Change Photo' : 'Add Photo'}</span>
                <input
                  ref={quickImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQuickImageUpload}
                  className="hidden"
                  disabled={uploadingQuickImage}
                />
              </label>
            )}
          </div>
        )}

        <div className="p-6">
          {isEditing ? (
            /* Edit Mode */
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="input w-full text-xl font-bold"
                  placeholder="Recipe title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="input w-full"
                  rows={2}
                  placeholder="A brief description of your recipe..."
                />
              </div>

              {/* Category, Difficulty, Privacy */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="input w-full"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Difficulty</label>
                  <select
                    value={editFormData.difficulty}
                    onChange={(e) => setEditFormData({ ...editFormData, difficulty: e.target.value })}
                    className="input w-full"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Privacy</label>
                  <select
                    value={editFormData.privacy}
                    onChange={(e) => setEditFormData({ ...editFormData, privacy: e.target.value })}
                    className="input w-full"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="FRIENDS">Friends Only</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                </div>
              </div>

              {/* Time & Servings */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Prep Time (min)</label>
                  <input
                    type="number"
                    value={editFormData.prepTime}
                    onChange={(e) => setEditFormData({ ...editFormData, prepTime: e.target.value })}
                    className="input w-full"
                    placeholder="15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cook Time (min)</label>
                  <input
                    type="number"
                    value={editFormData.cookTime}
                    onChange={(e) => setEditFormData({ ...editFormData, cookTime: e.target.value })}
                    className="input w-full"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Servings</label>
                  <input
                    type="number"
                    value={editFormData.servings}
                    onChange={(e) => setEditFormData({ ...editFormData, servings: e.target.value })}
                    className="input w-full"
                    placeholder="4"
                  />
                </div>
              </div>

              {/* Save/Cancel Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveEdits}
                  disabled={saving}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
              {/* Title, Privacy, and Action Buttons */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{recipe.title}</h1>
                  {recipe.description && (
                    <p className="text-gray-600">{recipe.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                    {getPrivacyIcon()}
                    <span className="text-sm font-medium text-gray-700">{getPrivacyLabel()}</span>
                  </div>
                  
                  {/* Add to Event Button - Available to all logged in users */}
                  {user && (
                    <button
                      onClick={() => setShowAddToEventModal(true)}
                      className="btn btn-primary btn-sm flex items-center gap-2"
                      title="Add to Event Meal Plan"
                    >
                      <Calendar className="w-4 h-4" />
                      Add to Event
                    </button>
                  )}
                  
                  {/* Favorite Button - Available to all logged in users */}
                  {user && (
                    <button
                      onClick={handleFavoriteToggle}
                      className={`p-2 rounded-full transition ${
                        recipe.isFavorite
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      title={recipe.isFavorite ? "Remove from Favorites" : "Mark as Favorite"}
                    >
                      <Heart className={`w-5 h-5 ${recipe.isFavorite ? "fill-white" : ""}`} />
                    </button>
                  )}
                  
                  {/* Non-owner actions: Save, Favorite, Copy */}
                  {user && !isOwner && (
                    <>
                      {/* Save to Recipe Box Button */}
                      <button
                        onClick={handleSaveToggle}
                        className={`p-2 rounded-full transition ${
                          recipe.isSaved
                            ? 'bg-primary-600 text-white hover:bg-primary-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={recipe.isSaved ? 'Remove from Recipe Box' : 'Save to Recipe Box'}
                      >
                        {recipe.isSaved ? (
                          <BookmarkCheck className="w-5 h-5" />
                        ) : (
                          <Bookmark className="w-5 h-5" />
                        )}
                      </button>


                      {/* Save a Copy Button */}
                      <button
                        onClick={handleCopyRecipe}
                        className="btn btn-secondary btn-sm flex items-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Save a Copy
                      </button>
                    </>
                  )}

                  {/* Like and Share - visible to all logged in users */}
                  {user && (
                    <>
                      <button
                        onClick={handleLike}
                        className={`p-2 rounded-full transition flex items-center gap-1 ${
                          isLiked
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={isLiked ? 'Unlike' : 'Like this recipe'}
                      >
                        <Heart className={`w-5 h-5 ${isLiked ? 'fill-white' : ''}`} />
                        {likeCount > 0 && <span className="text-sm">{likeCount}</span>}
                      </button>
                      <button
                        onClick={handleShare}
                        className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                        title="Share to your feed"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Author */}
              <Link
                to={`/profile/${recipe.user.username}`}
                className="flex items-center gap-3 mb-4 hover:bg-gray-50 p-2 rounded-lg transition"
              >
                {recipe.user.profilePicture ? (
                  <img
                    src={`${recipe.user.profilePicture}`}
                    alt={recipe.user.firstName}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">
                    {recipe.user.firstName[0]}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {recipe.user.firstName} {recipe.user.lastName}
                  </p>
                  <p className="text-sm text-gray-500">@{recipe.user.username}</p>
                </div>
              </Link>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-6 text-sm text-gray-600 mb-6">
                {totalTime > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{totalTime} minutes</span>
                  </div>
                )}
                {recipe.servings && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{recipe.servings} servings</span>
                  </div>
                )}
                {recipe.difficulty && (
                  <div className="px-3 py-1 bg-gray-100 rounded-full">
                    <span className="font-medium">{recipe.difficulty}</span>
                  </div>
                )}
                {recipe.category && (
                  <div className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full">
                    <span className="font-medium">{recipe.category}</span>
                  </div>
                )}
              </div>

              {/* Rating Display and Rate */}
              <div className="border-t border-gray-200 pt-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Ratings</h3>
                
                {recipe.averageRating !== undefined && recipe.averageRating > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= Math.round(recipe.averageRating!)
                              ? 'text-yellow-500 fill-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-bold text-gray-900">{recipe.averageRating.toFixed(1)}</span>
                    <span className="text-sm text-gray-500">
                      ({recipe._count?.ratings || 0} {recipe._count?.ratings === 1 ? 'rating' : 'ratings'})
                    </span>
                  </div>
                )}

                {(!recipe.averageRating || recipe.averageRating === 0) && (
                  <p className="text-sm text-gray-500 mb-4">No ratings yet. Be the first to rate!</p>
                )}

                {user && !isOwner && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      {rating > 0 ? 'Your rating:' : 'Rate this recipe:'}
                    </p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRate(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="transition hover:scale-110"
                        >
                          <Star
                            className={`w-7 h-7 ${
                              star <= (hoverRating || rating)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        You rated this recipe {rating} {rating === 1 ? 'star' : 'stars'}
                      </p>
                    )}
                  </div>
                )}

                {isOwner && (
                  <p className="text-sm text-gray-500 italic">You can't rate your own recipe</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ingredients</h2>
        {isEditing ? (
          <textarea
            value={editFormData.ingredients}
            onChange={(e) => setEditFormData({ ...editFormData, ingredients: e.target.value })}
            className="input w-full"
            rows={8}
            placeholder="1 lb ground beef&#10;1 onion, diced&#10;2 cans beans"
          />
        ) : (
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-primary-600 mt-1">•</span>
                <span className="text-gray-700">{ingredient}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Instructions</h2>
        {isEditing ? (
          <textarea
            value={editFormData.instructions}
            onChange={(e) => setEditFormData({ ...editFormData, instructions: e.target.value })}
            className="input w-full"
            rows={10}
            placeholder="1. Brown the ground beef...&#10;2. Add onions and cook until soft...&#10;3. Add remaining ingredients..."
          />
        ) : (
          <ol className="space-y-4">
            {recipe.instructions.map((instruction, index) => (
              <li key={index} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <p className="text-gray-700 pt-1">{instruction}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Comments Section - Hide when editing */}
      {!isEditing && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Comments ({recipe._count?.comments || 0})
            </h2>
          </div>

          {user && (
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={handleCommentInputChange}
                  placeholder="Share your thoughts about this recipe... Use @username to mention someone"
                  className="input w-full"
                  rows={3}
                  disabled={submittingComment}
                />
                
                {/* Mention Dropdown */}
                {showMentions && filteredFriends.length > 0 && (
                  <div className="absolute bottom-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg mb-1 max-h-48 overflow-y-auto z-10">
                    {filteredFriends.slice(0, 5).map((friend) => (
                      <button
                        key={friend.id}
                        type="button"
                        onClick={() => insertMention(friend.username)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
                      >
                        {friend.profilePicture ? (
                          <img
                            src={friend.profilePicture}
                            alt=""
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-700 text-xs font-semibold">
                              {friend.firstName[0]}
                            </span>
                          </div>
                        )}
                        <span className="font-medium">{friend.firstName} {friend.lastName}</span>
                        <span className="text-gray-400 text-sm">@{friend.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                <AtSign className="w-3 h-3 inline" /> Type @ to mention friends
              </p>

              <div className="mt-3">
                {commentImagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={commentImagePreview}
                      alt="Comment preview"
                      className="h-32 rounded-lg object-cover"
                    />
                    <button
                      onClick={removeCommentImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      disabled={submittingComment}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 rounded-lg cursor-pointer transition border border-gray-300">
                    <Camera className="w-4 h-4" />
                    <span className="text-sm">Add Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCommentImageChange}
                      className="hidden"
                      disabled={submittingComment}
                    />
                  </label>
                )}
              </div>

              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || submittingComment}
                className="btn btn-primary mt-3"
              >
                {submittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          )}

          {!user && (
            <div className="mb-6 bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-gray-600">
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  Login
                </Link>
                {' '}to leave a comment
              </p>
            </div>
          )}

          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-0">
                  <Link
                    to={`/profile/${comment.user.username}`}
                    className="flex items-center gap-3 mb-2 hover:bg-gray-50 p-2 rounded-lg transition"
                  >
                    {comment.user.profilePicture ? (
                      <img
                        src={`${comment.user.profilePicture}`}
                        alt={comment.user.firstName}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
                        {comment.user.firstName[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {comment.user.firstName} {comment.user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </Link>
                  <p className="text-gray-700 ml-11 mb-2">{renderCommentContent(comment.content)}</p>
                  
                  {/* Reaction buttons */}
                  {user && (
                    <div className="ml-11 mt-2 flex items-center gap-3">
                      <button
                        onClick={() => handleCommentLike(comment.id)}
                        className={`flex items-center gap-1 text-sm transition ${comment.userReaction === 'like' || comment.userHasLiked ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                        title="Like"
                      >
                        <ThumbsUp className={`w-4 h-4 ${comment.userReaction === 'like' || comment.userHasLiked ? 'fill-current' : ''}`} />
                        {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
                      </button>
                      <button
                        onClick={() => handleCommentReaction(comment.id, 'love')}
                        className={`flex items-center gap-1 text-sm transition ${comment.userReaction === 'love' ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                        title="Love"
                      >
                        <Heart className={`w-4 h-4 ${comment.userReaction === 'love' ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleCommentReaction(comment.id, 'dislike')}
                        className={`flex items-center gap-1 text-sm transition ${comment.userReaction === 'dislike' ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'}`}
                        title="Dislike"
                      >
                        <ThumbsDown className={`w-4 h-4 ${comment.userReaction === 'dislike' ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  )}
                  {comment.imageUrl && (
                    <img
                      src={`${comment.imageUrl}`}
                      alt="Comment"
                      className="ml-11 rounded-lg max-w-md hover:scale-105 transition cursor-pointer"
                      onClick={() => window.open(`${comment.imageUrl}`, '_blank')}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Owner Actions */}
      {isOwner && !isEditing && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Manage Recipe</h3>
          <div className="flex gap-3">
            <button onClick={handleFavoriteToggle} className={`btn flex items-center gap-2 ${recipe.isFavorite ? "btn-danger" : "btn-secondary"}`}>
              <Heart className={`w-4 h-4 ${recipe.isFavorite ? "fill-current" : ""}`} />
              {recipe.isFavorite ? "Unfavorite" : "Favorite"}
            </button>
            <button onClick={startEditing} className="btn btn-secondary flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Edit Recipe
            </button>
            <button onClick={handleDelete} className="btn btn-danger flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Delete Recipe
            </button>
          </div>
        </div>
      )}

      {/* Add to Event Modal */}
      {recipe && (
        <AddRecipeToEventModal
          recipe={{
            id: recipe.id,
            title: recipe.title,
            ingredients: recipe.ingredients
          }}
          isOpen={showAddToEventModal}
          onClose={() => setShowAddToEventModal(false)}
        />
      )}
    </div>
  );
}
