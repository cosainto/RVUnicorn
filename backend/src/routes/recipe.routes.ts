import { Router } from 'express';
import { logRecipeCreated } from '../services/activity.service';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// GET /api/recipes - Get all recipes with privacy filtering (Community Box - NO PRIVATE)
// GET /api/recipes/saved - Get current user's saved recipes
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const savedRecipes = await prisma.savedRecipe.findMany({
      where: { userId },
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            prepTime: true,
            cookTime: true,
            user: {
              select: {
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { favorite: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(savedRecipes);
  } catch (error) {
    console.error('Get saved recipes error:', error);
    res.status(500).json({ error: 'Failed to fetch saved recipes' });
  }
});


router.get('/', optionalAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const { search, limit, category } = req.query;

    let privacyConditions: any[] = [];

    if (currentUserId) {
      // Get user's accepted friendships
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { initiatorId: currentUserId, status: 'ACCEPTED' },
            { receiverId: currentUserId, status: 'ACCEPTED' }
          ]
        }
      });

      const friendIds = friendships.map(f => 
        f.initiatorId === currentUserId ? f.receiverId : f.initiatorId
      );

      // Logged in: PUBLIC recipes, FRIENDS-only from friends, own FRIENDS-only
      // PRIVATE recipes are NEVER shown in community box
      privacyConditions = [
        { privacy: 'PUBLIC' }, // Public recipes from anyone
        { AND: [{ privacy: 'FRIENDS' }, { userId: { in: friendIds } }] }, // Friends-only from friends
        { AND: [{ privacy: 'FRIENDS' }, { userId: currentUserId }] }, // Own friends-only recipes
      ];
    } else {
      // Not logged in: only public recipes
      privacyConditions = [{ privacy: 'PUBLIC' }];
    }

    // Build where clause with search and category filters
    const whereClause: any = {
      OR: privacyConditions
    };

    if (search) {
      whereClause.AND = [
        {
          OR: [
            { title: { contains: search as string, mode: 'insensitive' } },
            { description: { contains: search as string, mode: 'insensitive' } },
          ]
        }
      ];
    }

    if (category) {
      whereClause.category = category as string;
    }

    const recipes = await prisma.recipe.findMany({
      where: whereClause,
      take: limit ? parseInt(limit as string) : undefined,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          }
        },
        _count: {
          select: {
            ratings: true,
            comments: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate average rating for each recipe
    const recipesWithRatings = await Promise.all(
      recipes.map(async (recipe) => {
        const ratings = await prisma.recipeRating.findMany({
          where: { recipeId: recipe.id },
          select: { rating: true }
        });

        const averageRating = ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          : 0;

        // Check if current user saved this recipe
        const savedRecipe = currentUserId
          ? await prisma.savedRecipe.findUnique({
              where: {
                userId_recipeId: {
                  userId: currentUserId,
                  recipeId: recipe.id
                }
              }
            })
          : null;

        return {
          ...recipe,
          averageRating,
          author: recipe.user,
          isSaved: !!savedRecipe,
          isFavorite: savedRecipe?.favorite || false,
        };
      })
    );

    res.json({ recipes: recipesWithRatings });
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ error: 'Failed to get recipes' });
  }
});

// GET /api/recipes/:id - Get single recipe with privacy check
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = (req as any).userId;

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          }
        },
        _count: {
          select: {
            ratings: true,
            comments: true,
          }
        }
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Privacy check
    if (recipe.privacy === 'PRIVATE' && recipe.userId !== currentUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (recipe.privacy === 'FRIENDS' && recipe.userId !== currentUserId) {
      if (!currentUserId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const isFriend = await prisma.friendship.findFirst({
        where: {
          OR: [
            { initiatorId: currentUserId, receiverId: recipe.userId, status: 'ACCEPTED' },
            { initiatorId: recipe.userId, receiverId: currentUserId, status: 'ACCEPTED' }
          ]
        }
      });

      if (!isFriend) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get average rating
    const ratings = await prisma.recipeRating.findMany({
      where: { recipeId: recipe.id },
      select: { rating: true }
    });

    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    // Get user's rating if logged in
    const userRating = currentUserId
      ? await prisma.recipeRating.findUnique({
          where: {
            recipeId_userId: {
              recipeId: recipe.id,
              userId: currentUserId
            }
          }
        })
      : null;

    // Check if current user saved this recipe
    const savedRecipe = currentUserId
      ? await prisma.savedRecipe.findUnique({
          where: {
            userId_recipeId: {
              userId: currentUserId,
              recipeId: recipe.id
            }
          }
        })
      : null;

    const formattedRecipe = {
      ...recipe,
      averageRating,
      userRating: userRating?.rating || 0,
      isSaved: !!savedRecipe,
      isFavorite: savedRecipe?.favorite || false,
    };

    res.json(formattedRecipe);
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ error: 'Failed to get recipe' });
  }
});

// POST /api/recipes - Create new recipe
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const {
      title,
      description,
      ingredients,
      instructions,
      prepTime,
      cookTime,
      servings,
      difficulty,
      cuisine,
      category,
      privacy,
      imageUrl,
    } = req.body;

    if (!title || !ingredients || !instructions) {
      return res.status(400).json({ error: 'Title, ingredients, and instructions are required' });
    }

    const recipe = await prisma.recipe.create({
      data: {
        userId,
        title,
        description,
        ingredients,
        instructions: Array.isArray(instructions) ? instructions : [instructions],
        prepTime: prepTime ? parseInt(prepTime) : null,
        cookTime: cookTime ? parseInt(cookTime) : null,
        servings: servings ? parseInt(servings) : null,
        difficulty,
        cuisine,
        category,
        privacy: privacy || 'PUBLIC',
        imageUrl,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          }
        }
      }
    });

    await logRecipeCreated(userId, recipe.id, recipe.title);
    res.status(201).json(recipe);
  } catch (error) {
    console.error('Create recipe error:', error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// PUT /api/recipes/:id - Update recipe
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const {
      title,
      description,
      ingredients,
      instructions,
      prepTime,
      cookTime,
      servings,
      difficulty,
      cuisine,
      category,
      privacy,
      imageUrl,
    } = req.body;

    // Check ownership
    const recipe = await prisma.recipe.findUnique({
      where: { id }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    if (recipe.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.recipe.update({
      where: { id },
      data: {
        title,
        description,
        ingredients,
        instructions: Array.isArray(instructions) ? instructions : [instructions],
        prepTime: prepTime ? parseInt(prepTime) : null,
        cookTime: cookTime ? parseInt(cookTime) : null,
        servings: servings ? parseInt(servings) : null,
        difficulty,
        cuisine,
        category,
        privacy,
        imageUrl,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// DELETE /api/recipes/:id - Delete recipe
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const recipe = await prisma.recipe.findUnique({
      where: { id }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    if (recipe.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.recipe.delete({
      where: { id }
    });

    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// POST /api/recipes/:id/rate - Rate a recipe
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Upsert rating (create or update)
    const recipeRating = await prisma.recipeRating.upsert({
      where: {
        recipeId_userId: {
          recipeId,
          userId
        }
      },
      create: {
        recipeId,
        userId,
        rating: parseInt(rating),
        review
      },
      update: {
        rating: parseInt(rating),
        review
      }
    });

    res.json(recipeRating);
  } catch (error) {
    console.error('Rate recipe error:', error);
    res.status(500).json({ error: 'Failed to rate recipe' });
  }
});

// GET /api/recipes/:id/comments - Get recipe comments
router.get('/:id/comments', async (req, res) => {
  try {
    const { id: recipeId } = req.params;

    const comments = await prisma.recipeComment.findMany({
      where: { recipeId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// POST /api/recipes/:id/comments - Add comment to recipe
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;
    const { content, imageUrl } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { userId: true, title: true }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const comment = await prisma.recipeComment.create({
      data: {
        recipeId,
        userId,
        content: content.trim(),
        imageUrl
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          }
        }
      }
    });

    // Create notification for recipe owner (if not commenting on own recipe)
    if (recipe.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: recipe.userId,
          type: 'COMMENT',
          content: `commented on your recipe "${recipe.title}"`,
          link: `/recipes/${recipeId}`,
        }
      });
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// POST /api/recipes/:id/save - Save recipe to user's collection
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { userId: true, title: true }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Check if already saved
    const existingSave = await prisma.savedRecipe.findUnique({
      where: {
        userId_recipeId: {
          userId,
          recipeId
        }
      }
    });

    if (existingSave) {
      return res.status(400).json({ error: 'Recipe already saved' });
    }

    // Save recipe
    const savedRecipe = await prisma.savedRecipe.create({
      data: {
        userId,
        recipeId,
        favorite: false
      }
    });

    // Create notification for recipe owner (if not saving own recipe)
    if (recipe.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: recipe.userId,
          type: 'RECIPE_SAVE',
          content: `saved your recipe "${recipe.title}"`,
          link: `/recipes/${recipeId}`,
        }
      });
    }

    res.status(201).json({ message: 'Recipe saved', savedRecipe });
  } catch (error) {
    console.error('Save recipe error:', error);
    res.status(500).json({ error: 'Failed to save recipe' });
  }
});

// DELETE /api/recipes/:id/save - Unsave recipe from user's collection
router.delete('/:id/save', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;

    await prisma.savedRecipe.delete({
      where: {
        userId_recipeId: {
          userId,
          recipeId
        }
      }
    });

    res.json({ message: 'Recipe unsaved' });
  } catch (error) {
    console.error('Unsave recipe error:', error);
    res.status(500).json({ error: 'Failed to unsave recipe' });
  }
});

// PUT /api/recipes/:id/favorite - Toggle favorite status of saved recipe
router.put('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;

    // Find the saved recipe
    const savedRecipe = await prisma.savedRecipe.findUnique({
      where: {
        userId_recipeId: {
          userId,
          recipeId
        }
      }
    });

    if (!savedRecipe) {
      return res.status(404).json({ error: 'Recipe not saved yet. Save it first to mark as favorite.' });
    }

    // Toggle favorite
    const updated = await prisma.savedRecipe.update({
      where: {
        userId_recipeId: {
          userId,
          recipeId
        }
      },
      data: {
        favorite: !savedRecipe.favorite
      }
    });

    res.json({ 
      message: updated.favorite ? 'Marked as favorite' : 'Removed from favorites',
      favorite: updated.favorite 
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

export default router;
