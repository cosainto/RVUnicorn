import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = express.Router();

// GET /api/wishlist - Get user's wish list with activities and collaborators
router.get('/', authenticateToken, async (req, res) => {
  try {
    const items = await prisma.wishListItem.findMany({
      where: { 
        OR: [
          { userId: req.user!.userId },
          { collaborators: { some: { userId: req.user!.userId } } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        activities: {
          include: {
            taggedUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    profilePicture: true,
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              }
            }
          }
        }
      },
      orderBy: [
        { isCompleted: 'asc' },
        { state: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(items);
  } catch (error) {
    console.error('Get wish list error:', error);
    res.status(500).json({ error: 'Failed to fetch wish list' });
  }
});

// POST /api/wishlist - Add to wish list
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { state, campgroundName, imageUrl, activities, targetDate, notes } = req.body;

    if (!state || !campgroundName) {
      return res.status(400).json({ error: 'State and campground name are required' });
    }

    const item = await prisma.wishListItem.create({
      data: {
        userId: req.user!.userId,
        state,
        campgroundName,
        imageUrl: imageUrl || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        notes: notes || null,
        isCompleted: false,
        activities: activities?.length > 0 ? {
          create: activities.map((activity: { name: string; imageUrl?: string; notes?: string }) => ({
            name: activity.name,
            imageUrl: activity.imageUrl || null,
            notes: activity.notes || null,
            isCompleted: false,
          }))
        } : undefined
      },
      include: {
        activities: {
          include: {
            taggedUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    profilePicture: true,
                  }
                }
              }
            }
          }
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              }
            }
          }
        }
      }
    });

    res.json(item);
  } catch (error) {
    console.error('Add wish list error:', error);
    res.status(500).json({ error: 'Failed to add to wish list' });
  }
});

// PUT /api/wishlist/:id - Update wish list item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isCompleted, state, campgroundName, imageUrl, targetDate, notes } = req.body;

    const item = await prisma.wishListItem.findUnique({
      where: { id },
      include: {
        collaborators: true
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Wish list item not found' });
    }

    const isOwner = item.userId === req.user!.userId;
    const isCollaborator = item.collaborators.some(c => c.userId === req.user!.userId && c.canEdit);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedItem = await prisma.wishListItem.update({
      where: { id },
      data: {
        isCompleted: isCompleted !== undefined ? isCompleted : undefined,
        state: state || undefined,
        campgroundName: campgroundName || undefined,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        targetDate: targetDate !== undefined ? (targetDate ? new Date(targetDate) : null) : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
      include: {
        activities: {
          include: {
            taggedUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    profilePicture: true,
                  }
                }
              }
            }
          }
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              }
            }
          }
        }
      }
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Update wish list error:', error);
    res.status(500).json({ error: 'Failed to update wish list item' });
  }
});

// DELETE /api/wishlist/:id - Delete wish list item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.wishListItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Wish list item not found' });
    }

    if (item.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.wishListItem.delete({
      where: { id }
    });

    res.json({ message: 'Wish list item deleted' });
  } catch (error) {
    console.error('Delete wish list error:', error);
    res.status(500).json({ error: 'Failed to delete wish list item' });
  }
});

// POST /api/wishlist/:id/activities - Add activity to wish list item
router.post('/:id/activities', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imageUrl, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Activity name is required' });
    }

    const item = await prisma.wishListItem.findUnique({
      where: { id },
      include: { collaborators: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Wish list item not found' });
    }

    const isOwner = item.userId === req.user!.userId;
    const isCollaborator = item.collaborators.some(c => c.userId === req.user!.userId && c.canEdit);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const activity = await prisma.wishListActivity.create({
      data: {
        wishListItemId: id,
        name,
        imageUrl: imageUrl || null,
        notes: notes || null,
        isCompleted: false,
      },
      include: {
        taggedUsers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              }
            }
          }
        }
      }
    });

    res.json(activity);
  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ error: 'Failed to add activity' });
  }
});

// PUT /api/wishlist/activities/:activityId - Update activity
router.put('/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { name, imageUrl, notes, isCompleted } = req.body;

    const activity = await prisma.wishListActivity.findUnique({
      where: { id: activityId },
      include: {
        wishListItem: {
          include: { collaborators: true }
        }
      }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const isOwner = activity.wishListItem.userId === req.user!.userId;
    const isCollaborator = activity.wishListItem.collaborators.some(c => c.userId === req.user!.userId && c.canEdit);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedActivity = await prisma.wishListActivity.update({
      where: { id: activityId },
      data: {
        name: name || undefined,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        notes: notes !== undefined ? notes : undefined,
        isCompleted: isCompleted !== undefined ? isCompleted : undefined,
      },
      include: {
        taggedUsers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              }
            }
          }
        }
      }
    });

    res.json(updatedActivity);
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// DELETE /api/wishlist/activities/:activityId - Delete activity
router.delete('/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await prisma.wishListActivity.findUnique({
      where: { id: activityId },
      include: {
        wishListItem: true
      }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (activity.wishListItem.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.wishListActivity.delete({
      where: { id: activityId }
    });

    res.json({ message: 'Activity deleted' });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

// POST /api/wishlist/activities/:activityId/tag - Tag user in activity
router.post('/activities/:activityId/tag', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const tag = await prisma.wishListActivityTag.create({
      data: {
        activityId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      }
    });

    res.json(tag);
  } catch (error) {
    console.error('Tag user error:', error);
    res.status(500).json({ error: 'Failed to tag user' });
  }
});

// DELETE /api/wishlist/activities/:activityId/tag/:userId - Untag user
router.delete('/activities/:activityId/tag/:userId', authenticateToken, async (req, res) => {
  try {
    const { activityId, userId } = req.params;

    await prisma.wishListActivityTag.delete({
      where: {
        activityId_userId: {
          activityId,
          userId,
        }
      }
    });

    res.json({ message: 'User untagged' });
  } catch (error) {
    console.error('Untag user error:', error);
    res.status(500).json({ error: 'Failed to untag user' });
  }
});

// POST /api/wishlist/:id/collaborators - Add collaborator
router.post('/:id/collaborators', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, canEdit } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const item = await prisma.wishListItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Wish list item not found' });
    }

    if (item.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const collaborator = await prisma.wishListCollaborator.create({
      data: {
        wishListItemId: id,
        userId,
        canEdit: canEdit || false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      }
    });

    res.json(collaborator);
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

// DELETE /api/wishlist/:id/collaborators/:userId - Remove collaborator
router.delete('/:id/collaborators/:userId', authenticateToken, async (req, res) => {
  try {
    const { id, userId } = req.params;

    const item = await prisma.wishListItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Wish list item not found' });
    }

    if (item.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.wishListCollaborator.delete({
      where: {
        wishListItemId_userId: {
          wishListItemId: id,
          userId,
        }
      }
    });

    res.json({ message: 'Collaborator removed' });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// GET /api/wishlist/explore - Get public wish lists from all users
router.get('/explore', authenticateToken, async (req, res) => {
  try {
    const items = await prisma.wishListItem.findMany({
      where: { 
        isPublic: true,
        userId: { not: req.user!.userId }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        activities: {
          include: {
            taggedUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    profilePicture: true,
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              }
            }
          }
        },
        _count: {
          select: {
            activities: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(items);
  } catch (error) {
    console.error('Get explore error:', error);
    res.status(500).json({ error: 'Failed to fetch public wish lists' });
  }
});

// GET /api/wishlist/feed - Get wish lists from people you follow
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    const following = await prisma.wishListFollow.findMany({
      where: { followerId: req.user!.userId },
      select: { followingId: true }
    });

    const followingIds = following.map(f => f.followingId);

    const items = await prisma.wishListItem.findMany({
      where: { 
        userId: { in: followingIds },
        isPublic: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        activities: {
          include: {
            taggedUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    profilePicture: true,
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(items);
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// POST /api/wishlist/follow/:userId - Follow a user
router.post('/follow/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const follow = await prisma.wishListFollow.create({
      data: {
        followerId: req.user!.userId,
        followingId: userId,
      },
      include: {
        following: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      }
    });

    res.json(follow);
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// DELETE /api/wishlist/follow/:userId - Unfollow a user
router.delete('/follow/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.wishListFollow.delete({
      where: {
        followerId_followingId: {
          followerId: req.user!.userId,
          followingId: userId,
        }
      }
    });

    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// GET /api/wishlist/following - Get list of users you're following
router.get('/following', authenticateToken, async (req, res) => {
  try {
    const following = await prisma.wishListFollow.findMany({
      where: { followerId: req.user!.userId },
      include: {
        following: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            _count: {
              select: {
                wishListItems: {
                  where: { isPublic: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(following);
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following list' });
  }
});

// PUT /api/wishlist/:id/privacy - Toggle public/private
router.put('/:id/privacy', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    const item = await prisma.wishListItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Wish list item not found' });
    }

    if (item.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedItem = await prisma.wishListItem.update({
      where: { id },
      data: { isPublic: isPublic !== undefined ? isPublic : !item.isPublic }
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Toggle privacy error:', error);
    res.status(500).json({ error: 'Failed to update privacy' });
  }
});

// POST /api/wishlist/save-destination/:itemId - Save someone's destination to your board
router.post('/save-destination/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { includeActivities } = req.body;

    const sourceItem = await prisma.wishListItem.findUnique({
      where: { id: itemId },
      include: {
        activities: includeActivities ? true : false
      }
    });

    if (!sourceItem) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    if (!sourceItem.isPublic && sourceItem.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'This destination is private' });
    }

    const savedItem = await prisma.wishListItem.create({
      data: {
        userId: req.user!.userId,
        state: sourceItem.state,
        campgroundName: sourceItem.campgroundName,
        imageUrl: sourceItem.imageUrl,
        notes: sourceItem.notes,
        isCompleted: false,
        isPublic: false,
        sourceItemId: sourceItem.id,
        activities: includeActivities && sourceItem.activities ? {
          create: sourceItem.activities.map(activity => ({
            name: activity.name,
            imageUrl: activity.imageUrl,
            notes: activity.notes,
            isCompleted: false,
            sourceActivityId: activity.id
          }))
        } : undefined
      },
      include: {
        activities: true
      }
    });

    res.json({ 
      message: 'Destination saved to your board!',
      item: savedItem 
    });
  } catch (error) {
    console.error('Save destination error:', error);
    res.status(500).json({ error: 'Failed to save destination' });
  }
});

// POST /api/wishlist/save-activity/:activityId - Save individual activity
router.post('/save-activity/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { targetBoardId } = req.body;

    const sourceActivity = await prisma.wishListActivity.findUnique({
      where: { id: activityId },
      include: {
        wishListItem: {
          select: {
            id: true,
            state: true,
            campgroundName: true,
            imageUrl: true,
            isPublic: true,
            userId: true
          }
        }
      }
    });

    if (!sourceActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (!sourceActivity.wishListItem.isPublic && sourceActivity.wishListItem.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'This activity is private' });
    }

    let destinationId = targetBoardId;

    if (!targetBoardId) {
      const existingDestination = await prisma.wishListItem.findFirst({
        where: {
          userId: req.user!.userId,
          state: sourceActivity.wishListItem.state,
          campgroundName: sourceActivity.wishListItem.campgroundName
        }
      });

      if (existingDestination) {
        destinationId = existingDestination.id;
      } else {
        const newDestination = await prisma.wishListItem.create({
          data: {
            userId: req.user!.userId,
            state: sourceActivity.wishListItem.state,
            campgroundName: sourceActivity.wishListItem.campgroundName,
            imageUrl: sourceActivity.wishListItem.imageUrl,
            isCompleted: false,
            isPublic: false,
            sourceItemId: sourceActivity.wishListItem.id
          }
        });
        destinationId = newDestination.id;
      }
    }

    const savedActivity = await prisma.wishListActivity.create({
      data: {
        wishListItemId: destinationId,
        name: sourceActivity.name,
        imageUrl: sourceActivity.imageUrl,
        notes: sourceActivity.notes,
        isCompleted: false,
        sourceActivityId: sourceActivity.id
      }
    });

    res.json({ 
      message: 'Activity saved to your board!',
      activity: savedActivity 
    });
  } catch (error) {
    console.error('Save activity error:', error);
    res.status(500).json({ error: 'Failed to save activity' });
  }
});

// GET /api/wishlist/user-boards - Get user's destinations for board selection
router.get('/user-boards', authenticateToken, async (req, res) => {
  try {
    const boards = await prisma.wishListItem.findMany({
      where: { userId: req.user!.userId },
      select: {
        id: true,
        state: true,
        campgroundName: true,
        imageUrl: true,
        _count: {
          select: { activities: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(boards);
  } catch (error) {
    console.error('Get user boards error:', error);
    res.status(500).json({ error: 'Failed to get boards' });
  }
});

export default router;
