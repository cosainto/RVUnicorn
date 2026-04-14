import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();
const db = prisma as any;

// GET /api/bookings/campground/:campgroundId/sites - Get all available sites for a campground
router.get('/campground/:campgroundId/sites', async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const { checkIn, checkOut, siteType, maxPrice } = req.query;

    const whereClause: any = {
      campgroundId,
      isActive: true,
    };

    if (siteType) {
      whereClause.siteType = siteType;
    }

    if (maxPrice) {
      whereClause.pricePerNight = {
        lte: parseFloat(maxPrice as string)
      };
    }

    let sites = await db.campsiteSite.findMany({
      where: whereClause,
      orderBy: [
        { siteType: 'asc' },
        { siteNumber: 'asc' }
      ]
    });

    // If dates provided, filter out sites that are already booked
    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn as string);
      const checkOutDate = new Date(checkOut as string);

      const bookedSites = await db.booking.findMany({
        where: {
          campgroundId,
          status: {
            in: ['PENDING', 'CONFIRMED']
          },
          OR: [
            {
              AND: [
                { checkInDate: { lte: checkInDate } },
                { checkOutDate: { gt: checkInDate } }
              ]
            },
            {
              AND: [
                { checkInDate: { lt: checkOutDate } },
                { checkOutDate: { gte: checkOutDate } }
              ]
            },
            {
              AND: [
                { checkInDate: { gte: checkInDate } },
                { checkOutDate: { lte: checkOutDate } }
              ]
            }
          ]
        },
        select: { siteId: true }
      });

      const bookedSiteIds = new Set(bookedSites.map((b: any) => b.siteId));
      sites = sites.filter((site: any) => !bookedSiteIds.has(site.id));
    }

    res.json(sites);
  } catch (error: any) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Failed to get sites' });
  }
});

// GET /api/bookings/site/:siteId - Get site details
router.get('/site/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;

    const site = await db.campsiteSite.findUnique({
      where: { id: siteId },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            slug: true,
            location: true,
          }
        }
      }
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json(site);
  } catch (error: any) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Failed to get site' });
  }
});

// POST /api/bookings/site/:siteId/check-availability - Check if site is available
router.post('/site/:siteId/check-availability', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { checkInDate, checkOutDate } = req.body;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Check for existing bookings
    const conflictingBookings = await db.booking.findMany({
      where: {
        siteId,
        status: {
          in: ['PENDING', 'CONFIRMED']
        },
        OR: [
          {
            AND: [
              { checkInDate: { lte: checkIn } },
              { checkOutDate: { gt: checkIn } }
            ]
          },
          {
            AND: [
              { checkInDate: { lt: checkOut } },
              { checkOutDate: { gte: checkOut } }
            ]
          },
          {
            AND: [
              { checkInDate: { gte: checkIn } },
              { checkOutDate: { lte: checkOut } }
            ]
          }
        ]
      }
    });

    const available = conflictingBookings.length === 0;

    res.json({ 
      available,
      conflicts: conflictingBookings.length
    });
  } catch (error: any) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// GET /api/bookings/user/events - Get user's events for linking
router.get('/user/events', authenticateToken, async (req, res) => {
  try {
    const events = await db.event.findMany({
      where: {
        OR: [
          { createdById: (req as any).user!.id },
          {
            attendees: {
              some: { userId: (req as any).user!.id }
            }
          }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: 'desc' }
    });

    res.json(events);
  } catch (error: any) {
    console.error('Get user events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// POST /api/bookings - Create a booking
router.post(
  '/',
  authenticateToken,
  [
    body('siteId').notEmpty(),
    body('checkInDate').isISO8601(),
    body('checkOutDate').isISO8601(),
    body('guests').isInt({ min: 1 }),
    body('eventId').optional(),
    body('createEvent').optional().isBoolean(),
    body('eventTitle').optional(),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        siteId,
        checkInDate,
        checkOutDate,
        guests,
        specialRequests,
        eventId,
        createEvent,
        eventTitle
      } = req.body;

      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);

      // Validate dates
      if (checkIn >= checkOut) {
        return res.status(400).json({ error: 'Check-out date must be after check-in date' });
      }

      if (checkIn < new Date()) {
        return res.status(400).json({ error: 'Check-in date must be in the future' });
      }

      // Get site
      const site = await db.campsiteSite.findUnique({
        where: { id: siteId },
        include: {
          campground: {
            select: {
              id: true,
              name: true,
              location: true,
            }
          }
        }
      });

      if (!site) {
        return res.status(404).json({ error: 'Site not found' });
      }

      if (!site.isActive) {
        return res.status(400).json({ error: 'Site is not available for booking' });
      }

      if (guests > site.maxOccupancy) {
        return res.status(400).json({ 
          error: `Number of guests exceeds maximum occupancy of ${site.maxOccupancy}` 
        });
      }

      // Check availability
      const conflictingBookings = await db.booking.findMany({
        where: {
          siteId,
          status: {
            in: ['PENDING', 'CONFIRMED']
          },
          OR: [
            {
              AND: [
                { checkInDate: { lte: checkIn } },
                { checkOutDate: { gt: checkIn } }
              ]
            },
            {
              AND: [
                { checkInDate: { lt: checkOut } },
                { checkOutDate: { gte: checkOut } }
              ]
            },
            {
              AND: [
                { checkInDate: { gte: checkIn } },
                { checkOutDate: { lte: checkOut } }
              ]
            }
          ]
        }
      });

      if (conflictingBookings.length > 0) {
        return res.status(400).json({ error: 'Site is not available for these dates' });
      }

      // Calculate nights and total price
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalPrice = nights * site.pricePerNight;

      // Handle event linking/creation
      let finalEventId = eventId;

      if (createEvent && eventTitle) {
        // Create a new event for this booking
        const newEvent = await db.event.create({
          data: {
            title: eventTitle,
            description: `Camping trip at ${site.campground.name}`,
            location: site.campground.location,
            startDate: checkIn,
            endDate: checkOut,
            createdById: (req as any).user!.id,
          }
        });

        finalEventId = newEvent.id;

        // Add user as attendee
        await db.eventAttendee.create({
          data: {
            eventId: newEvent.id,
            userId: (req as any).user!.id,
            status: 'attending',
          }
        });
      } else if (eventId) {
        // Verify user has access to this event
        const event = await db.event.findFirst({
          where: {
            id: eventId,
            OR: [
              { createdById: (req as any).user!.id },
              {
                attendees: {
                  some: { userId: (req as any).user!.id }
                }
              }
            ]
          }
        });

        if (!event) {
          return res.status(403).json({ error: 'Not authorized to link this event' });
        }
      }

      // Create booking
      const booking = await db.booking.create({
        data: {
          campgroundId: site.campgroundId,
          siteId,
          userId: (req as any).user!.id,
          eventId: finalEventId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          nights,
          guests,
          totalPrice,
          specialRequests,
          status: 'PENDING',
        },
        include: {
          site: true,
          campground: {
            select: {
              id: true,
              name: true,
              slug: true,
            }
          },
          event: {
            select: {
              id: true,
              title: true,
            }
          }
        }
      });

      // Create payment record
      await db.payment.create({
        data: {
          bookingId: booking.id,
          userId: (req as any).user!.id,
          amount: totalPrice,
          status: 'PENDING',
        }
      });

      // Notify campground admins
      const admins = await db.campsiteAdmin.findMany({
        where: { campgroundId: site.campgroundId },
        select: { userId: true }
      });

      await Promise.all(
        admins.map((admin: any) =>
          db.notification.create({
            data: {
              userId: admin.userId,
              type: 'NEW_BOOKING',
              content: `New booking for ${site.name} from ${(req as any).user!.firstName} ${(req as any).user!.lastName}`,
            }
          })
        )
      );

      res.json(booking);
    } catch (error: any) {
      console.error('Create booking error:', error);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
);

// GET /api/bookings/user - Get user's bookings
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;

    const whereClause: any = {
      userId: (req as any).user!.id
    };

    if (status) {
      whereClause.status = status;
    }

    const bookings = await db.booking.findMany({
      where: whereClause,
      include: {
        site: true,
        campground: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        payment: true,
        event: {
          select: {
            id: true,
            title: true,
            description: true,
          }
        }
      },
      orderBy: { checkInDate: 'desc' }
    });

    res.json(bookings);
  } catch (error: any) {
    console.error('Get user bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// GET /api/bookings/:bookingId - Get booking details
router.get('/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        site: true,
        campground: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            email: true,
          }
        },
        payment: true,
        event: {
          select: {
            id: true,
            title: true,
            description: true,
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check authorization
    const isOwner = booking.userId === (req as any).user!.id;
    const isAdmin = await db.campsiteAdmin.findUnique({
      where: {
        campgroundId_userId: {
          campgroundId: booking.campgroundId,
          userId: (req as any).user!.id
        }
      }
    });

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(booking);
  } catch (error: any) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// PUT /api/bookings/:bookingId/cancel - Cancel booking
router.put('/:bookingId/cancel', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        campground: {
          select: { name: true }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== (req as any).user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (booking.status === 'CANCELED') {
      return res.status(400).json({ error: 'Booking is already canceled' });
    }

    if (booking.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel completed booking' });
    }

    // Update booking status
    const updated = await db.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELED' }
    });

    // Update payment status if it exists
    if (booking.payment) {
      await db.payment.update({
        where: { id: booking.payment.id },
        data: { status: 'REFUNDED' }
      });
    }

    // Notify user
    await db.notification.create({
      data: {
        userId: (req as any).user!.id,
        type: 'BOOKING_CANCELED',
        content: `Your booking at ${booking.campground.name} has been canceled.`,
      }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// PUT /api/bookings/:bookingId/confirm - Confirm booking (admin only)
router.put('/:bookingId/confirm', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await db.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check admin
    const admin = await db.campsiteAdmin.findUnique({
      where: {
        campgroundId_userId: {
          campgroundId: booking.campgroundId,
          userId: (req as any).user!.id
        }
      }
    });

    if (!admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' }
    });

    // Notify user
    await db.notification.create({
      data: {
        userId: booking.userId,
        type: 'BOOKING_CONFIRMED',
        content: `Your booking has been confirmed!`,
      }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// GET /api/bookings/campground/:campgroundId/all - Get all bookings for campground (admin only)
router.get('/campground/:campgroundId/all', authenticateToken, async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const { status } = req.query;

    // Check admin
    const admin = await db.campsiteAdmin.findUnique({
      where: {
        campgroundId_userId: {
          campgroundId,
          userId: (req as any).user!.id
        }
      }
    });

    if (!admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const whereClause: any = { campgroundId };
    if (status) {
      whereClause.status = status;
    }

    const bookings = await db.booking.findMany({
      where: whereClause,
      include: {
        site: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        payment: true,
        event: {
          select: {
            id: true,
            title: true,
          }
        }
      },
      orderBy: { checkInDate: 'desc' }
    });

    res.json(bookings);
  } catch (error: any) {
    console.error('Get campground bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

export default router;
