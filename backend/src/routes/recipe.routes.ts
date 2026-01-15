import { Router } from 'express';
import { logRecipeCreated, logRecipeLiked, logRecipeCommented } from '../services/activity.service';
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

    // Get the commenter's info for notifications
    const commenter = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, username: true }
    });

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

    // === NOTIFY ALL PREVIOUS COMMENTERS (except muted users) ===
    const previousCommenters = await prisma.recipeComment.findMany({
      where: {
        recipeId,
        userId: { not: userId }
      },
      select: { userId: true },
      distinct: ['userId']
    });

    // Get users who have muted this recipe's comment notifications
    const mutedUsers = await prisma.recipeCommentMute.findMany({
      where: { recipeId },
      select: { userId: true }
    });
    const mutedUserIds = new Set(mutedUsers.map(m => m.userId));

    // Filter: exclude recipe owner, muted users, and current user
    const usersToNotify = previousCommenters
      .map(c => c.userId)
      .filter(id => id !== recipe.userId && id !== userId && !mutedUserIds.has(id));

    // Create Basecamp activity notifications for previous commenters
    const commenterName = commenter?.firstName && commenter?.lastName 
      ? `${commenter.firstName} ${commenter.lastName}`
      : commenter?.username || 'Someone';

    for (const notifyUserId of usersToNotify) {
      await prisma.basecampActivity.create({
        data: {
          userId: notifyUserId,
          actorId: userId,
          type: 'RECIPE_COMMENT_THREAD',
          entityType: 'RECIPE',
          entityId: recipeId,
          entityName: recipe.title,
          metadata: {
            commentPreview: content.trim().substring(0, 100),
            canMute: true,
            commenterName
          }
        }
      });
    }

    // === PROFILE ACTIVITY (visibility only - no notification alert) ===
    await logRecipeCommented(
      userId,
      recipeId,
      recipe.title,
      recipe.userId,
      content.trim().substring(0, 100)
    );

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

    // Log activity for friend feed
    if (recipe.userId !== userId) {
      const recipeOwner = await prisma.user.findUnique({ where: { id: recipe.userId }, select: { firstName: true, lastName: true } });
      await logRecipeLiked(userId, recipeId, recipe.title, recipe.userId, (recipeOwner?.firstName || '') + ' ' + (recipeOwner?.lastName || ''));
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

// PUT /api/recipes/:id/favorite - Toggle favorite status (auto-saves if not saved)
router.put('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;

    // Find the saved recipe
    let savedRecipe = await prisma.savedRecipe.findUnique({
      where: {
        userId_recipeId: {
          userId,
          recipeId
        }
      }
    });

    // If not saved yet, auto-save it and mark as favorite
    if (!savedRecipe) {
      savedRecipe = await prisma.savedRecipe.create({
        data: {
          userId,
          recipeId,
          favorite: true
        }
      });
      return res.json({ 
        message: 'Recipe saved and marked as favorite',
        favorite: true,
        isSaved: true
      });
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


// POST /api/recipes/:id/mute-comments - Mute comment notifications for a recipe
router.post('/:id/mute-comments', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const existing = await prisma.recipeCommentMute.findUnique({
      where: {
        userId_recipeId: { userId, recipeId }
      }
    });

    if (existing) {
      return res.json({ message: 'Already muted', muted: true });
    }

    await prisma.recipeCommentMute.create({
      data: { userId, recipeId }
    });

    res.json({ message: 'Recipe comment notifications muted', muted: true });
  } catch (error) {
    console.error('Mute recipe comments error:', error);
    res.status(500).json({ error: 'Failed to mute recipe comments' });
  }
});

// DELETE /api/recipes/:id/mute-comments - Unmute comment notifications for a recipe
router.delete('/:id/mute-comments', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;

    await prisma.recipeCommentMute.deleteMany({
      where: { userId, recipeId }
    });

    res.json({ message: 'Recipe comment notifications unmuted', muted: false });
  } catch (error) {
    console.error('Unmute recipe comments error:', error);
    res.status(500).json({ error: 'Failed to unmute recipe comments' });
  }
});

// GET /api/recipes/:id/mute-status - Check if user has muted a recipe's comments
router.get('/:id/mute-status', authenticateToken, async (req, res) => {
  try {
    const { id: recipeId } = req.params;
    const userId = (req as any).userId;

    const muted = await prisma.recipeCommentMute.findUnique({
      where: {
        userId_recipeId: { userId, recipeId }
      }
    });

    res.json({ muted: !!muted });
  } catch (error) {
    console.error('Check mute status error:', error);
    res.status(500).json({ error: 'Failed to check mute status' });
  }
});

export default router;
