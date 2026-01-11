import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// GET /api/borrow/requests - Get borrow requests (sent or received)
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query; // 'sent' or 'received'

    let whereClause: any = {};

    if (type === 'sent') {
      whereClause.requesterId = req.user!.id;
    } else if (type === 'received') {
      whereClause.ownerId = req.user!.id;
    } else {
      // Get both sent and received
      whereClause = {
        OR: [
          { requesterId: req.user!.id },
          { ownerId: req.user!.id }
        ]
      };
    }

    const requests = await prisma.borrowRequest.findMany({
      where: whereClause,
      include: {
        gearItem: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Get borrow requests error:', error);
    res.status(500).json({ error: 'Failed to get borrow requests' });
  }
});

// POST /api/borrow/request - Create borrow request
router.post(
  '/request',
  authenticateToken,
  [
    body('gearItemId').notEmpty(),
    body('campgroundId').notEmpty(),
    body('startAt').isISO8601(),
    body('endAt').isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { gearItemId, campgroundId, startAt, endAt, message } = req.body;

      // Get gear item
      const gearItem = await prisma.gearItem.findUnique({
        where: { id: gearItemId }
      });

      if (!gearItem) {
        return res.status(404).json({ error: 'Gear item not found' });
      }

      if (!gearItem.borrowable) {
        return res.status(400).json({ error: 'This item is not available for borrowing' });
      }

      if (gearItem.userId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot borrow your own item' });
      }

      // Check if both users are checked into the campground
      const now = new Date();
      const requesterCheckIn = await prisma.campgroundCheckIn.findFirst({
        where: {
          userId: req.user!.id,
          campgroundId,
          checkInDate: { lte: now },
          checkOutDate: { gte: now },
        }
      });

      const ownerCheckIn = await prisma.campgroundCheckIn.findFirst({
        where: {
          userId: gearItem.userId,
          campgroundId,
          checkInDate: { lte: now },
          checkOutDate: { gte: now },
        }
      });

      if (!requesterCheckIn || !ownerCheckIn) {
        return res.status(403).json({ error: 'Both users must be checked into the same campground' });
      }

      // Create borrow request
      const borrowRequest = await prisma.borrowRequest.create({
        data: {
          gearItemId,
          campgroundId,
          ownerId: gearItem.userId,
          requesterId: req.user!.id,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          message,
        },
        include: {
          gearItem: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
            }
          },
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
            }
          },
          campground: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      // Create notification for owner
      await prisma.notification.create({
        data: {
          userId: gearItem.userId,
          type: 'BORROW_REQUEST',
          content: `${req.user!.firstName} wants to borrow your ${gearItem.name}`,
        }
      });

      res.json(borrowRequest);
    } catch (error) {
      console.error('Create borrow request error:', error);
      res.status(500).json({ error: 'Failed to create borrow request' });
    }
  }
);

// POST /api/borrow/:id/approve - Approve borrow request
router.post('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseMessage, proposedStartAt, proposedEndAt } = req.body;

    const borrowRequest = await prisma.borrowRequest.findUnique({
      where: { id },
      include: {
        gearItem: true,
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!borrowRequest) {
      return res.status(404).json({ error: 'Borrow request not found' });
    }

    if (borrowRequest.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized - only owner can approve' });
    }

    if (borrowRequest.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // If proposing new times, set status to PROPOSED
    const status = (proposedStartAt || proposedEndAt) ? 'PROPOSED' : 'APPROVED';

    const updatedRequest = await prisma.borrowRequest.update({
      where: { id },
      data: {
        status,
        responseMessage,
        proposedStartAt: proposedStartAt ? new Date(proposedStartAt) : null,
        proposedEndAt: proposedEndAt ? new Date(proposedEndAt) : null,
      },
      include: {
        gearItem: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        requester: {
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

    // Create notification for requester
    const notificationContent = status === 'APPROVED'
      ? `${req.user!.firstName} approved your request to borrow ${borrowRequest.gearItem.name}`
      : `${req.user!.firstName} proposed new times for borrowing ${borrowRequest.gearItem.name}`;

    await prisma.notification.create({
      data: {
        userId: borrowRequest.requesterId,
        type: status === 'APPROVED' ? 'BORROW_APPROVED' : 'BORROW_PROPOSED',
        content: notificationContent,
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Approve borrow request error:', error);
    res.status(500).json({ error: 'Failed to approve borrow request' });
  }
});

// POST /api/borrow/:id/decline - Decline borrow request
router.post('/:id/decline', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseMessage } = req.body;

    const borrowRequest = await prisma.borrowRequest.findUnique({
      where: { id },
      include: {
        gearItem: true
      }
    });

    if (!borrowRequest) {
      return res.status(404).json({ error: 'Borrow request not found' });
    }

    if (borrowRequest.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized - only owner can decline' });
    }

    const updatedRequest = await prisma.borrowRequest.update({
      where: { id },
      data: {
        status: 'DECLINED',
        responseMessage,
      },
      include: {
        gearItem: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        requester: {
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

    // Create notification for requester
    await prisma.notification.create({
      data: {
        userId: borrowRequest.requesterId,
        type: 'BORROW_DECLINED',
        content: `Your request to borrow ${borrowRequest.gearItem.name} was declined`,
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Decline borrow request error:', error);
    res.status(500).json({ error: 'Failed to decline borrow request' });
  }
});

// POST /api/borrow/:id/accept-proposal - Accept owner's proposed times
router.post('/:id/accept-proposal', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const borrowRequest = await prisma.borrowRequest.findUnique({
      where: { id },
      include: {
        gearItem: true
      }
    });

    if (!borrowRequest) {
      return res.status(404).json({ error: 'Borrow request not found' });
    }

    if (borrowRequest.requesterId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized - only requester can accept' });
    }

    if (borrowRequest.status !== 'PROPOSED') {
      return res.status(400).json({ error: 'No proposal to accept' });
    }

    const updatedRequest = await prisma.borrowRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        startAt: borrowRequest.proposedStartAt || borrowRequest.startAt,
        endAt: borrowRequest.proposedEndAt || borrowRequest.endAt,
      },
      include: {
        gearItem: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        requester: {
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

    // Notify owner
    await prisma.notification.create({
      data: {
        userId: borrowRequest.ownerId,
        type: 'BORROW_ACCEPTED',
        content: `${req.user!.firstName} accepted your proposed times for ${borrowRequest.gearItem.name}`,
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Accept proposal error:', error);
    res.status(500).json({ error: 'Failed to accept proposal' });
  }
});

// POST /api/borrow/:id/cancel - Cancel borrow request
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const borrowRequest = await prisma.borrowRequest.findUnique({
      where: { id },
      include: {
        gearItem: true
      }
    });

    if (!borrowRequest) {
      return res.status(404).json({ error: 'Borrow request not found' });
    }

    if (borrowRequest.requesterId !== req.user!.id && borrowRequest.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedRequest = await prisma.borrowRequest.update({
      where: { id },
      data: {
        status: 'CANCELED',
      }
    });

    // Notify the other party
    const notifyUserId = borrowRequest.requesterId === req.user!.id
      ? borrowRequest.ownerId
      : borrowRequest.requesterId;

    await prisma.notification.create({
      data: {
        userId: notifyUserId,
        type: 'BORROW_CANCELED',
        content: `Borrow request for ${borrowRequest.gearItem.name} was canceled`,
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Cancel borrow request error:', error);
    res.status(500).json({ error: 'Failed to cancel borrow request' });
  }
});

// POST /api/borrow/:id/complete - Mark borrow as completed/returned
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const borrowRequest = await prisma.borrowRequest.findUnique({
      where: { id },
      include: {
        gearItem: true
      }
    });

    if (!borrowRequest) {
      return res.status(404).json({ error: 'Borrow request not found' });
    }

    if (borrowRequest.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized - only owner can mark as complete' });
    }

    if (borrowRequest.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Can only complete approved requests' });
    }

    const updatedRequest = await prisma.borrowRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Complete borrow error:', error);
    res.status(500).json({ error: 'Failed to complete borrow' });
  }
});

export default router;
