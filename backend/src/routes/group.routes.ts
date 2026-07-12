import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { checkAndAwardBadges, BadgeTrigger } from '../services/badge.service';
import { recordCampgroundVisit } from '../services/visit-stats.service';

import { prisma } from '../lib/prisma';
const router = Router();

// Helper function to generate slug
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// GET /api/groups - Get all groups
router.get('/', optionalAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const { search, tag } = req.query;

    const where: any = {};
    
    // Search by name or description
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    // Filter by tag
    if (tag) {
      where.tags = { has: tag as string };
    }

    const groups = await prisma.group.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(groups);
  } catch (error: any) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/groups/my - Get groups the current user is a member of
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const memberships = await prisma.groupMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        group: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get unread notification counts per group
    const unreadNotifications = await prisma.notification.findMany({
      where: {
        userId,
        read: false,
        type: 'GROUP_EVENT',
      },
      select: {
        link: true,
      },
    });

    // Count notifications per group (extract group from /trips/:id links)
    const groupNotifCounts: { [key: string]: number } = {};
    
    // Get events for each group to map notifications
    const groupIds = memberships.map((m: any) => m.group.id);
    const groupEvents = await prisma.event.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true, groupId: true },
    });
    
    const eventToGroup: { [key: string]: string } = {};
    groupEvents.forEach((e: any) => {
      if (e.groupId) eventToGroup[e.id] = e.groupId;
    });

    unreadNotifications.forEach((n: any) => {
      if (n.link) {
        const match = n.link.match(/\/trips\/([a-zA-Z0-9]+)/);
        if (match) {
          const eventId = match[1];
          const groupId = eventToGroup[eventId];
          if (groupId) {
            groupNotifCounts[groupId] = (groupNotifCounts[groupId] || 0) + 1;
          }
        }
      }
    });

    const groups = memberships.map((m: any) => ({
      ...m.group,
      myRole: m.role,
      joinedAt: m.createdAt,
      unreadCount: groupNotifCounts[m.group.id] || 0,
    }));

    res.json(groups);
  } catch (error: any) {
    console.error('Get my groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/groups/invites/my - Get my pending invites
router.get('/invites/my', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const invites = await prisma.groupInvite.findMany({
      where: { inviteeId: userId, status: 'PENDING' },
      include: {
        group: { select: { id: true, name: true, slug: true, coverPhoto: true } },
        inviter: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites);
  } catch (error: any) {
    console.error('Get my invites error:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// POST /api/groups/invites/:inviteId/accept
router.post('/invites/:inviteId/accept', authenticateToken, async (req, res) => {
  try {
    const { inviteId } = req.params;
    const userId = (req as any).userId;
    const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId }, include: { group: true } });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteeId !== userId) return res.status(403).json({ error: 'This invite is not for you' });
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Invite already processed' });
    await prisma.groupMember.create({ data: { groupId: invite.groupId, userId, role: 'MEMBER', status: 'ACTIVE' } });
    await prisma.groupInvite.update({ where: { id: inviteId }, data: { status: 'ACCEPTED' } });
    res.json({ message: 'Joined group successfully', group: invite.group });
  } catch (error: any) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// POST /api/groups/invites/:inviteId/decline
router.post('/invites/:inviteId/decline', authenticateToken, async (req, res) => {
  try {
    const { inviteId } = req.params;
    const userId = (req as any).userId;
    const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId } });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteeId !== userId) return res.status(403).json({ error: 'This invite is not for you' });
    await prisma.groupInvite.update({ where: { id: inviteId }, data: { status: 'DECLINED' } });
    res.json({ message: 'Invite declined' });
  } catch (error: any) {
    console.error('Decline invite error:', error);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});

// POST /api/groups - Create a group
router.post(
  '/',
  authenticateToken,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('privacy').isIn(['PUBLIC', 'PRIVATE', 'CLOSED']),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { name, description, privacy, coverPhoto, tags } = req.body;

      let slug = generateSlug(name);
      let slugExists = await prisma.group.findUnique({ where: { slug } });
      let counter = 1;

      while (slugExists) {
        slug = `${generateSlug(name)}-${counter}`;
        slugExists = await prisma.group.findUnique({ where: { slug } });
        counter++;
      }

      const group = await prisma.group.create({
        data: {
          name,
          slug,
          description,
          privacy: privacy || 'PUBLIC',
          coverPhoto,
          createdById: userId,
          tags: tags || [],
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
            },
          },
        },
      });

      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      res.status(201).json(group);
    } catch (error: any) {
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  }
);

// GET /api/groups/:slug - Get group by slug
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const currentUserId = (req as any).userId;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.privacy !== 'PUBLIC') {
      const isMember = group.members.some((m: any) => m.userId === currentUserId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(group);
  } catch (error: any) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// PUT /api/groups/:slug - Update group
router.put('/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;
    const { name, description, privacy, coverPhoto, tags } = req.body;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const member = group.members.find((m: any) => m.userId === userId);
    if (!member || member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updated = await prisma.group.update({
      where: { slug },
      data: {
        name,
        description,
        privacy,
        coverPhoto,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/groups/:slug - Delete group
router.delete('/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const member = group.members.find((m: any) => m.userId === userId);
    if (!member || member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await prisma.group.delete({ where: { slug } });

    res.json({ message: 'Group deleted' });
  } catch (error: any) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// POST /api/groups/:slug/join - Join a group
router.post('/:slug/join', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const existingMember = group.members.find((m: any) => m.userId === userId);
    if (existingMember) {
      return res.status(400).json({ error: 'Already a member' });
    }

    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: 'MEMBER',
        status: group.privacy === 'CLOSED' ? 'PENDING' : 'ACTIVE',
      },
    });

    // Check for Welcome to the Club badge (only if active member)
    if (group.privacy !== 'CLOSED') {
      await checkAndAwardBadges(userId, BadgeTrigger.GROUP_JOINED);
    }

    res.json({ message: group.privacy === 'CLOSED' ? 'Join request sent' : 'Joined group' });
  } catch (error: any) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// POST /api/groups/:slug/leave - Leave a group
router.post('/:slug/leave', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const member = group.members.find((m: any) => m.userId === userId);
    if (!member) {
      return res.status(400).json({ error: 'Not a member' });
    }

    if (member.role === 'ADMIN' && group.members.filter((m: any) => m.role === 'ADMIN').length === 1) {
      return res.status(400).json({ error: 'Cannot leave - you are the only admin' });
    }

    await prisma.groupMember.delete({
      where: { id: member.id },
    });

    res.json({ message: 'Left group' });
  } catch (error: any) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// POST /api/groups/:slug/invite - Invite a user
router.post('/:slug/invite', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const { username } = req.body;
    const inviterId = (req as any).userId;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const inviterMember = group.members.find((m: any) => m.userId === inviterId);
    if (!inviterMember) {
      return res.status(403).json({ error: 'You must be a member to invite others' });
    }

    const invitee = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, firstName: true, lastName: true },
    });

    if (!invitee) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingMember = group.members.find((m: any) => m.userId === invitee.id);
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    const existingInvite = await prisma.groupInvite.findUnique({
      where: {
        groupId_inviteeId: {
          groupId: group.id,
          inviteeId: invitee.id,
        },
      },
    });

    if (existingInvite && existingInvite.status === 'PENDING') {
      return res.status(400).json({ error: 'User already has a pending invite' });
    }

    const invite = await prisma.groupInvite.create({
      data: {
        groupId: group.id,
        inviterId,
        inviteeId: invitee.id,
      },
      include: {
        invitee: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });

    res.status(201).json(invite);
  } catch (error: any) {
    console.error('Invite to group error:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// GET /api/groups/:slug/posts - Get group posts
router.get('/:slug/posts', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const group = await prisma.group.findUnique({ where: { slug } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const posts = await prisma.post.findMany({
      where: { groupId: group.id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(posts);
  } catch (error: any) {
    console.error('Get group posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST /api/groups/:slug/posts - Create group post
router.post('/:slug/posts', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;
    const { content, imageUrl } = req.body;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const member = group.members.find((m: any) => m.userId === userId && m.status === 'ACTIVE');
    if (!member) {
      return res.status(403).json({ error: 'Must be a member to post' });
    }

    const post = await prisma.post.create({
      data: {
        content,
        imageUrl,
        userId: userId,
        groupId: group.id,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    res.status(201).json(post);
  } catch (error: any) {
    console.error('Create group post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

export default router;

// GET /api/groups/:slug/events - Get group events
router.get('/:slug/events', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const group = await prisma.group.findUnique({ where: { slug } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const events = await prisma.event.findMany({
      where: { groupId: group.id },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    res.json(events);
  } catch (error: any) {
    console.error('Get group events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/groups/:slug/events - Create group event
router.post('/:slug/events', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, location, campgroundId, tags } = req.body;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: { where: { status: 'ACTIVE' } } },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const member = group.members.find((m: any) => m.userId === userId);
    if (!member) {
      return res.status(403).json({ error: 'Must be a member to create events' });
    }

    // Create the event
    const event = await prisma.event.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        campgroundId: campgroundId || null,
        tags: tags || [],
        organizerId: userId,
        groupId: group.id,
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: { select: { id: true, name: true, state: true } },
      },
    });

    // Record the visit so it shows on the organizer's travel map and stats
    if (event.campground) {
      await recordCampgroundVisit(userId, event, event.campground);
    }

    // Auto-invite all group members as attendees
    const attendeeData = group.members.map((m: any) => ({
      eventId: event.id,
      userId: m.userId,
      status: m.userId === userId ? 'GOING' : 'INVITED',
    }));

    await prisma.eventAttendee.createMany({
      data: attendeeData,
    });

    // Notify all group members about the new event (except creator)
    const notificationData = group.members
      .filter((m: any) => m.userId !== userId)
      .map((m: any) => ({
        userId: m.userId,
        type: 'GROUP_EVENT',
        content: `${event.organizer.firstName} created a new event "${event.title}" in ${group.name}`,
        link: `/trips/${event.id}`,
      }));

    if (notificationData.length > 0) {
      await prisma.notification.createMany({
        data: notificationData,
      });
    }

    res.status(201).json(event);
  } catch (error: any) {
    console.error('Create group event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// GET /api/groups/:slug/events - Get group events
router.get('/:slug/events', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const group = await prisma.group.findUnique({ where: { slug } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const events = await prisma.event.findMany({
      where: { groupId: group.id },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    res.json(events);
  } catch (error: any) {
    console.error('Get group events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/groups/:slug/events - Create group event
router.post('/:slug/events', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, location, campgroundId, tags } = req.body;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: { where: { status: 'ACTIVE' } } },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const member = group.members.find((m: any) => m.userId === userId);
    if (!member) {
      return res.status(403).json({ error: 'Must be a member to create events' });
    }

    // Create the event
    const event = await prisma.event.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        campgroundId: campgroundId || null,
        tags: tags || [],
        organizerId: userId,
        groupId: group.id,
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: { select: { id: true, name: true, state: true } },
      },
    });

    // Record the visit so it shows on the organizer's travel map and stats
    if (event.campground) {
      await recordCampgroundVisit(userId, event, event.campground);
    }

    // Auto-invite all group members as attendees
    const attendeeData = group.members.map((m: any) => ({
      eventId: event.id,
      userId: m.userId,
      status: m.userId === userId ? 'GOING' : 'INVITED',
    }));

    await prisma.eventAttendee.createMany({
      data: attendeeData,
    });

    // Notify all group members about the new event (except creator)
    const notificationData = group.members
      .filter((m: any) => m.userId !== userId)
      .map((m: any) => ({
        userId: m.userId,
        type: 'GROUP_EVENT',
        content: `${event.organizer.firstName} created a new event "${event.title}" in ${group.name}`,
        link: `/trips/${event.id}`,
      }));

    if (notificationData.length > 0) {
      await prisma.notification.createMany({
        data: notificationData,
      });
    }

    res.status(201).json(event);
  } catch (error: any) {
    console.error('Create group event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// GET /api/groups/:slug/pending - Get pending join requests (admin only)
router.get('/:slug/pending', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const currentMember = group.members.find((m: any) => m.userId === userId);
    if (!currentMember || currentMember.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can view pending requests' });
    }

    const pendingMembers = await prisma.groupMember.findMany({
      where: { groupId: group.id, status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pendingMembers);
  } catch (error: any) {
    console.error('Get pending members error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// POST /api/groups/:slug/pending/:memberId/approve - Approve join request
router.post('/:slug/pending/:memberId/approve', authenticateToken, async (req, res) => {
  try {
    const { slug, memberId } = req.params;
    const userId = (req as any).userId;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const currentMember = group.members.find((m: any) => m.userId === userId);
    if (!currentMember || currentMember.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can approve requests' });
    }

    const pendingMember = await prisma.groupMember.findFirst({
      where: { id: memberId, groupId: group.id, status: 'PENDING' },
      include: { user: { select: { firstName: true } } },
    });

    if (!pendingMember) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    await prisma.groupMember.update({
      where: { id: memberId },
      data: { status: 'ACTIVE' },
    });

    // Notify the user they were approved
    await prisma.notification.create({
      data: {
        userId: pendingMember.userId,
        type: 'GROUP_APPROVED',
        content: `Your request to join "${group.name}" was approved!`,
        link: `/groups/${group.slug}`,
      },
    });

    res.json({ message: 'Member approved' });
  } catch (error: any) {
    console.error('Approve member error:', error);
    res.status(500).json({ error: 'Failed to approve member' });
  }
});

// POST /api/groups/:slug/pending/:memberId/deny - Deny join request
router.post('/:slug/pending/:memberId/deny', authenticateToken, async (req, res) => {
  try {
    const { slug, memberId } = req.params;
    const userId = (req as any).userId;

    const group = await prisma.group.findUnique({
      where: { slug },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const currentMember = group.members.find((m: any) => m.userId === userId);
    if (!currentMember || currentMember.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can deny requests' });
    }

    const pendingMember = await prisma.groupMember.findFirst({
      where: { id: memberId, groupId: group.id, status: 'PENDING' },
    });

    if (!pendingMember) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    await prisma.groupMember.delete({
      where: { id: memberId },
    });

    res.json({ message: 'Request denied' });
  } catch (error: any) {
    console.error('Deny member error:', error);
    res.status(500).json({ error: 'Failed to deny request' });
  }
});
