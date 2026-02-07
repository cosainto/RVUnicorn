import { useState, useEffect } from 'react';
import { Plus, X, ChefHat, Users, Edit2, Trash2, UtensilsCrossed, Search, Bell, Check, XCircle, HelpCircle, BookOpen, Globe } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface MealPlannerProps {
  eventId: string;
  startDate: string;
  endDate: string;
  isOrganizer: boolean;
}

interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  user?: {
    firstName: string;
    lastName: string;
  };
  author?: {
    firstName: string;
    lastName: string;
  };
  isFavorite?: boolean;
}

interface MealRSVP {
  id: string;
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface EventMeal {
  id: string;
  date: string;
  mealType: string;
  scheduledTime?: string;
  menuItems: string[];
  ingredients: string[];
  notes?: string;
  cook?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  rsvps?: MealRSVP[];
  _count?: {
    rsvps: number;
  };
}

interface Attendee {
  id: string;
  userId: string;
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

const MEAL_ICONS: { [key: string]: string } = {
  'BREAKFAST': '🍳',
  'LUNCH': '🥪',
  'DINNER': '🍽️',
  'SNACK': '🍿'
};

const MEAL_COLORS: { [key: string]: string } = {
  'BREAKFAST': 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
  'LUNCH': 'bg-green-50 border-green-200 hover:bg-green-100',
  'DINNER': 'bg-orange-50 border-orange-200 hover:bg-orange-100',
  'SNACK': 'bg-purple-50 border-purple-200 hover:bg-purple-100'
};

type RecipeSource = 'manual' | 'mybox' | 'community';

export default function MealPlanner({ eventId, startDate, endDate, isOrganizer }: MealPlannerProps) {
  const { user } = useAuth();
  const [meals, setMeals] = useState<EventMeal[]>([]);
  const [communityRecipes, setCommunityRecipes] = useState<Recipe[]>([]);
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [selectedMealForRSVP, setSelectedMealForRSVP] = useState<EventMeal | null>(null);
  const [editingMeal, setEditingMeal] = useState<EventMeal | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('BREAKFAST');
  const [selectedTime, setSelectedTime] = useState('');
  const [recipeSource, setRecipeSource] = useState<RecipeSource>('manual');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [notifyAttendees, setNotifyAttendees] = useState(false);
  
  const [formData, setFormData] = useState({
    menuItems: '',
    ingredients: '',
    assignedTo: '',
    notes: '',
  });

  // Generate array of dates between start and end
  const eventDates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    eventDates.push(new Date(d).toISOString().split('T')[0]);
  }

  useEffect(() => {
    loadMeals();
    loadAttendees();
    loadCommunityRecipes();
    if (user) {
      loadMyRecipes();
    }
  }, [eventId, user]);

  useEffect(() => {
    const recipes = recipeSource === 'mybox' ? myRecipes : communityRecipes;
    if (recipeSearch) {
      setFilteredRecipes(
        recipes.filter(r => 
          r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
          r.description?.toLowerCase().includes(recipeSearch.toLowerCase())
        )
      );
    } else {
      setFilteredRecipes(recipes);
    }
  }, [recipeSearch, communityRecipes, myRecipes, recipeSource]);

  const loadMeals = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/event-meals/${eventId}`);
      setMeals(data);
    } catch (error) {
      console.error('Load meals error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommunityRecipes = async () => {
    try {
      const { data } = await api.get('/recipes');
      const recipeList = data.recipes || data;
      setCommunityRecipes(recipeList);
    } catch (error) {
      console.error('Load community recipes error:', error);
    }
  };

  const loadMyRecipes = async () => {
    if (!user) return;
    try {
      const { data } = await api.get(`/profile/${user.username}/recipes`);
      const recipeList = data.recipes || data;
      setMyRecipes(recipeList);
    } catch (error) {
      console.error('Load my recipes error:', error);
    }
  };

  const loadAttendees = async () => {
    try {
      // Get attendees
      const { data: attendeesData } = await api.get(`/events/${eventId}/attendees`);
      
      // Get event to include organizer
      const { data: eventData } = await api.get(`/events/${eventId}`);
      
      // Check if organizer is already in attendees list
      const organizerInAttendees = attendeesData.some((a: Attendee) => a.user.id === eventData.organizerId);
      
      if (!organizerInAttendees && eventData.organizer) {
        // Add organizer as a pseudo-attendee at the start of the list
        const organizerAsAttendee = {
          id: 'organizer',
          userId: eventData.organizerId,
          status: 'going',
          user: eventData.organizer
        };
        setAttendees([organizerAsAttendee, ...attendeesData]);
      } else {
        setAttendees(attendeesData);
      }
    } catch (error) {
      console.error('Load attendees error:', error);
    }
  };
  const openAddModal = (date: string, mealType: string) => {
    setEditingMeal(null);
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setRecipeSource('manual');
    setSelectedRecipe('');
    setRecipeSearch('');
    setNotifyAttendees(false);
    setFormData({ menuItems: '', ingredients: '', assignedTo: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (meal: EventMeal) => {
    setEditingMeal(meal);
    setSelectedDate(meal.date.split('T')[0]);
    setSelectedMealType(meal.mealType);
    setSelectedTime(meal.scheduledTime || '');
    setRecipeSource('manual');
    setSelectedRecipe('');
    setNotifyAttendees(false);
    setFormData({
      menuItems: meal.menuItems.length > 0 ? meal.menuItems.join(', ') : (meal.notes || ''),
      ingredients: meal.ingredients.join(', '),
      assignedTo: meal.cook?.id || '',
      notes: meal.notes || '',
    });
    setShowModal(true);
  };

  const openRSVPModal = (meal: EventMeal) => {
    setSelectedMealForRSVP(meal);
    setShowRSVPModal(true);
  };

  const handleRecipeSelect = (recipeId: string) => {
    const recipes = recipeSource === 'mybox' ? myRecipes : communityRecipes;
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      setSelectedRecipe(recipeId);
      setFormData({
        ...formData,
        menuItems: recipe.title,
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.join(', ') : '',
      });
    }
  };

  const handleSaveMeal = async () => {
    if ((!formData.menuItems && !selectedRecipe) || !selectedDate) {
      alert('Please enter menu items or select a recipe, and select a date');
      return;
    }

    try {
      const payload = {
        eventId,
        date: selectedDate,
        mealType: selectedMealType,
        menuItems: formData.menuItems.split(',').map(item => item.trim()),
        ingredients: formData.ingredients.split(',').map(item => item.trim()).filter(Boolean),
        assignedTo: formData.assignedTo || null,
        notes: formData.notes || null,
        scheduledTime: selectedTime || null,
        notifyAttendees,
      };

      if (editingMeal) {
        await api.put(`/event-meals/${editingMeal.id}`, payload);
      } else {
        await api.post('/event-meals', payload);
      }
      
      if (notifyAttendees) {
        alert('✅ Attendees have been notified! They can RSVP from the meal calendar.');
      }
      
      setShowModal(false);
      setEditingMeal(null);
      setFormData({ menuItems: '', ingredients: '', assignedTo: '', notes: '' });
      await loadMeals();
    } catch (error) {
      console.error('Save meal error:', error);
      alert('Failed to save meal');
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm('Remove this meal from the plan?')) return;

    try {
      await api.delete(`/event-meals/${mealId}`);
      await loadMeals();
    } catch (error) {
      console.error('Delete meal error:', error);
      alert('Failed to delete meal');
    }
  };

  const handleRSVP = async (mealId: string, status: string) => {
    try {
      await api.post(`/event-meals/${mealId}/rsvp`, { status });
      await loadMeals();
      alert(`✅ Your RSVP has been recorded: ${status.replace('_', ' ')}!`);
      setShowRSVPModal(false);
    } catch (error) {
      console.error('RSVP error:', error);
      alert('Failed to RSVP');
    }
  };

  const getUserRSVPStatus = (meal: EventMeal) => {
    if (!meal.rsvps || !user) return null;
    const userRSVP = meal.rsvps.find(r => r.user.id === user.id);
    return userRSVP?.status || null;
  };

  const getMealsForDateAndType = (date: string, mealType: string) => {
    return meals.filter(m => 
      m.date.split('T')[0] === date && m.mealType === mealType
    );
  };

  const getAttendingCount = (meal: EventMeal) => {
    if (!meal.rsvps) return 0;
    return meal.rsvps.filter(r => r.status === 'attending').length;
  };

  const getRecipeAuthor = (recipe: Recipe) => {
    const author = recipe.author || recipe.user;
    if (author) {
      return `${author.firstName} ${author.lastName}`;
    }
    return 'Unknown';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading meal plan...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-xl shadow-lg">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Meal Plan</h2>
            <p className="text-sm text-gray-600">Plan delicious meals & RSVP! 🍴</p>
          </div>
        </div>
        {isOrganizer && (
          <button
            onClick={() => openAddModal(eventDates[0], 'BREAKFAST')}
            className="btn btn-primary flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Meal
          </button>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Days Header */}
            <div className="flex border-b-2 border-gray-300">
              <div className="w-32 flex-shrink-0 p-4 bg-gradient-to-br from-primary-600 to-primary-700 font-bold text-white flex items-center justify-center sticky left-0 z-10">
                <UtensilsCrossed className="w-5 h-5 mr-2" />
                Meal Type
              </div>
              <div className="flex">
                {eventDates.map((date) => (
                  <div key={date} className="w-48 flex-shrink-0 p-3 bg-gradient-to-br from-gray-100 to-gray-50 border-r border-gray-200">
                    <div className="font-bold text-gray-900 text-center">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                      })}
                    </div>
                    <div className="text-sm text-gray-600 text-center">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Meal Rows */}
            {MEAL_TYPES.map((mealType) => (
              <div key={mealType} className="flex border-b border-gray-200">
                {/* Meal Type Label */}
                <div className="w-32 flex-shrink-0 p-4 bg-gradient-to-br from-gray-100 to-gray-50 font-semibold text-gray-700 flex items-center justify-center border-r border-gray-200 sticky left-0 z-10">
                  <span className="text-2xl mr-2">{MEAL_ICONS[mealType]}</span>
                  <span className="text-sm">{mealType.charAt(0) + mealType.slice(1).toLowerCase()}</span>
                </div>

                {/* Days */}
                <div className="flex">
                  {eventDates.map((date) => {
                    const dateMeals = getMealsForDateAndType(date, mealType);
                    
                    return (
                      <div
                        key={date}
                        className="w-48 flex-shrink-0 p-2 border-r border-gray-200 min-h-[140px] hover:bg-gray-50 transition"
                      >
                        {dateMeals.length > 0 ? (
                          <div className="space-y-2">
                            {dateMeals.map((meal) => {
                              const userRSVP = getUserRSVPStatus(meal);
                              const attendingCount = getAttendingCount(meal);
                              
                              return (
                                <div
                                  key={meal.id}
                                  className={`${MEAL_COLORS[mealType]} rounded-lg p-3 border-2 relative group shadow-sm hover:shadow-md transition cursor-pointer`}
                                  onClick={() => openRSVPModal(meal)}
                                >
                                  <div className="pr-16">
                                    <h4 className="font-semibold text-sm text-gray-900 mb-1">
                                      {meal.menuItems.join(', ')}
                                    </h4>
                                    {meal.cook ? (
                                      <p className="text-xs text-gray-700 flex items-center gap-1 mt-1">
                                        <ChefHat className="w-3 h-3" />
                                        <span className="font-medium">{meal.cook.firstName}</span>
                                      </p>
                                    ) : (<p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><ChefHat className="w-3 h-3" /><span className="italic">Not assigned</span></p>)}
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {attendingCount} attending
                                      </div>
                                      {userRSVP && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                          userRSVP === 'attending' 
                                            ? 'bg-green-100 text-green-700'
                                            : userRSVP === 'not_attending'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {userRSVP === 'attending' ? '✓ Yes' : userRSVP === 'not_attending' ? '✗ No' : '? Maybe'}
                                        </span>
                                      )}
                                    </div>
                                    {meal.notes && (
                                      <p className="text-xs text-gray-600 mt-1 italic">
                                        "{meal.notes}"
                                      </p>
                                    )}
                                  </div>
                                  
                                  {isOrganizer && (
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => openEditModal(meal)}
                                        className="bg-blue-500 text-white p-1 rounded hover:bg-blue-600 transition shadow"
                                        title="Edit meal"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteMeal(meal.id)}
                                        className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition shadow"
                                        title="Delete meal"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            {isOrganizer && (
                              <button
                                onClick={() => openAddModal(date, mealType)}
                                className="text-gray-400 hover:text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg transition font-medium text-sm"
                              >
                                + Add Meal
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RSVP Modal */}
      {showRSVPModal && selectedMealForRSVP && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">RSVP to Meal</h2>
                </div>
                <button
                  onClick={() => setShowRSVPModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-2">
                  {selectedMealForRSVP.menuItems.join(', ')}
                </h3>
                <p className="text-sm text-gray-600">
                  {MEAL_ICONS[selectedMealForRSVP.mealType]} {selectedMealForRSVP.mealType.charAt(0) + selectedMealForRSVP.mealType.slice(1).toLowerCase()}
                </p>
                <p className="text-sm text-gray-600">
                  📅 {new Date(selectedMealForRSVP.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                {selectedMealForRSVP.cook && (
                  <p className="text-sm text-gray-600 mt-1">
                    👨‍🍳 Cook: {selectedMealForRSVP.cook.firstName} {selectedMealForRSVP.cook.lastName}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Will you be attending this meal?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRSVP(selectedMealForRSVP.id, 'attending')}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition"
                  >
                    <Check className="w-8 h-8 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">Yes</span>
                  </button>
                  <button
                    onClick={() => handleRSVP(selectedMealForRSVP.id, 'maybe')}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-yellow-200 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition"
                  >
                    <HelpCircle className="w-8 h-8 text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-700">Maybe</span>
                  </button>
                  <button
                    onClick={() => handleRSVP(selectedMealForRSVP.id, 'not_attending')}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition"
                  >
                    <XCircle className="w-8 h-8 text-red-600" />
                    <span className="text-sm font-semibold text-red-700">No</span>
                  </button>
                </div>
              </div>

              {selectedMealForRSVP.rsvps && selectedMealForRSVP.rsvps.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Who's attending ({getAttendingCount(selectedMealForRSVP)} people):
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedMealForRSVP.rsvps
                      .filter(r => r.status === 'attending')
                      .map(rsvp => (
                        <div key={rsvp.id} className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="text-gray-700">
                            {rsvp.user.firstName} {rsvp.user.lastName}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Meal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-t-xl sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ChefHat className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">
                    {editingMeal ? 'Edit Meal' : 'Add Meal'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Recipe Source Toggle */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border-2 border-blue-200">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    onClick={() => { setRecipeSource('manual'); setSelectedRecipe(''); }}
                    className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                      recipeSource === 'manual'
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    ✏️ Manual
                  </button>
                  <button
                    onClick={() => { setRecipeSource('mybox'); setSelectedRecipe(''); setRecipeSearch(''); }}
                    className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                      recipeSource === 'mybox'
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    My Recipe Box
                    {myRecipes.length > 0 && (
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {myRecipes.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setRecipeSource('community'); setSelectedRecipe(''); setRecipeSearch(''); }}
                    className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                      recipeSource === 'community'
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    Community
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📅 Date *
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Select date...</option>
                  {eventDates.map((date) => (
                    <option key={date} value={date}>
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </option>
                  ))}
                </select>
              </div>

              {/* Meal Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🍴 Meal Type *
                </label>
                <select
                  value={selectedMealType}
                  onChange={(e) => setSelectedMealType(e.target.value)}
                  className="input w-full"
                  required
                >
                  {MEAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MEAL_ICONS[type]} {type.charAt(0) + type.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Scheduled Time */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🕐 Time (optional)
                </label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="input w-full"
                  placeholder="e.g., 8:00 AM"
                />
                <p className="text-xs text-gray-500 mt-1">When will this meal be served?</p>
              </div>

              {recipeSource !== 'manual' ? (
                /* Recipe Selection */
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    {recipeSource === 'mybox' ? '📚 Your Saved Recipes' : '🌍 Community Recipes'}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                      className="input w-full pl-10"
                      placeholder="Search recipes..."
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    {filteredRecipes.length > 0 ? (
                      filteredRecipes.map((recipe) => (
                        <button
                          key={recipe.id}
                          onClick={() => handleRecipeSelect(recipe.id)}
                          className={`w-full text-left p-3 border-b hover:bg-blue-50 transition ${
                            selectedRecipe === recipe.id ? 'bg-blue-100 border-l-4 border-l-blue-600' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{recipe.title}</span>
                            {recipe.isFavorite && <span className="text-red-500">❤️</span>}
                          </div>
                          {recipe.description && (
                            <div className="text-sm text-gray-600 line-clamp-1">{recipe.description}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            by {getRecipeAuthor(recipe)}
                            {recipe.prepTime && ` • ${recipe.prepTime} min prep`}
                            {recipe.servings && ` • Serves ${recipe.servings}`}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        {recipeSource === 'mybox' 
                          ? 'No recipes in your Recipe Box yet. Save some from the community!' 
                          : 'No recipes found. Try a different search!'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Manual Entry */
                <>
                  {/* Menu Items */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🍽️ Menu Items * <span className="text-gray-500 font-normal text-xs">(comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.menuItems}
                      onChange={(e) => setFormData({ ...formData, menuItems: e.target.value })}
                      className="input w-full"
                      placeholder="Grilled burgers, Potato salad, Corn on the cob"
                      required
                    />
                  </div>

                  {/* Ingredients */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🛒 Ingredients <span className="text-gray-500 font-normal text-xs">(comma-separated, optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.ingredients}
                      onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                      className="input w-full"
                      placeholder="Ground beef, Buns, Lettuce, Tomatoes"
                    />
                  </div>
                </>
              )}

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  👨‍🍳 Assigned Cook (Optional)
                </label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Not assigned</option>
                  {attendees.map((attendee) => (
                    <option key={attendee.id} value={attendee.user.id}>
                      {attendee.user.firstName} {attendee.user.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="input w-full"
                  placeholder="Any special instructions or dietary notes..."
                />
              </div>

              {/* Notify Attendees */}
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyAttendees}
                    onChange={(e) => setNotifyAttendees(e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded"
                  />
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">
                      Notify all attendees about this meal
                    </span>
                  </div>
                </label>
                <p className="text-xs text-gray-600 mt-2 ml-8">
                  Attendees will be able to RSVP from the meal calendar
                </p>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveMeal}
                  className="btn btn-primary flex-1 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition"
                  disabled={(!formData.menuItems && !selectedRecipe) || !selectedDate}
                >
                  {editingMeal ? '💾 Save Changes' : '✨ Add Meal'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
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
