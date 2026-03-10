import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/itinerary - Get all trips for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trips = await prisma.trip.findMany({
      where: { userId },
      include: {
        days: {
          include: { stops: { include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } }, orderBy: { order: 'asc' } } },
          orderBy: { dayNumber: 'asc' }
        }
      },
      orderBy: { startDate: 'asc' }
    });
    res.json(trips);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// GET /api/itinerary/:id - Get single trip
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.id, userId },
      include: {
        days: {
          include: { stops: { include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } }, orderBy: { order: 'asc' } } },
          orderBy: { dayNumber: 'asc' }
        }
      }
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

// POST /api/itinerary - Create trip
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, status, visibility } = req.body;
    const trip = await prisma.trip.create({
      data: { userId, title, description, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, status: status || 'PLANNING', visibility: visibility || 'PRIVATE' },
      include: { days: true }
    });
    res.json(trip);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// PUT /api/itinerary/:id - Update trip
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, status, visibility, coverImage } = req.body;
    const trip = await prisma.trip.updateMany({
      where: { id: req.params.id, userId },
      data: { title, description, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, status, visibility, coverImage }
    });
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// DELETE /api/itinerary/:id - Delete trip
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    await prisma.trip.deleteMany({ where: { id: req.params.id, userId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// POST /api/itinerary/:id/days - Add a day
router.post('/:id/days', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { date, dayNumber, type, notes } = req.body;
    const day = await prisma.tripDay.create({
      data: { tripId: req.params.id, date: date ? new Date(date) : null, dayNumber, type: type || 'TRAVEL', notes },
      include: { stops: true }
    });
    res.json(day);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add day' });
  }
});

// PUT /api/itinerary/:id/days/:dayId - Update a day
router.put('/:id/days/:dayId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { date, dayNumber, type, notes } = req.body;
    const day = await prisma.tripDay.update({
      where: { id: req.params.dayId },
      data: { date: date ? new Date(date) : null, dayNumber, type, notes },
      include: { stops: { orderBy: { order: 'asc' } } }
    });
    res.json(day);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update day' });
  }
});

// DELETE /api/itinerary/:id/days/:dayId - Delete a day
router.delete('/:id/days/:dayId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    await prisma.tripDay.delete({ where: { id: req.params.dayId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete day' });
  }
});

// POST /api/itinerary/:id/days/:dayId/stops - Add a stop
router.post('/:id/days/:dayId/stops', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { order, type, campgroundId, customName, address, latitude, longitude, notes, siteNumber, durationMins, cost, confirmed } = req.body;
    const stop = await prisma.tripStop.create({
      data: { tripDayId: req.params.dayId, order: order || 0, type, campgroundId, customName, address, latitude, longitude, notes, siteNumber, durationMins, cost, confirmed: confirmed || false },
      include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } }
    });
    res.json(stop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add stop' });
  }
});

// PUT /api/itinerary/:id/days/:dayId/stops/:stopId - Update a stop
router.put('/:id/days/:dayId/stops/:stopId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { order, type, campgroundId, customName, address, latitude, longitude, notes, siteNumber, durationMins, cost, confirmed } = req.body;
    const stop = await prisma.tripStop.update({
      where: { id: req.params.stopId },
      data: { order, type, campgroundId, customName, address, latitude, longitude, notes, siteNumber, durationMins, cost, confirmed },
      include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } }
    });
    res.json(stop);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update stop' });
  }
});

// DELETE /api/itinerary/:id/days/:dayId/stops/:stopId - Delete a stop
router.delete('/:id/days/:dayId/stops/:stopId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    await prisma.tripStop.delete({ where: { id: req.params.stopId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete stop' });
  }
});

export default router;
