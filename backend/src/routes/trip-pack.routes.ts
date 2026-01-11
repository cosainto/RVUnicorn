import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = express.Router();

// GET /api/event-pack/:eventId - Get pack list for event
router.get('/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.campsiteEvent.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const items = await prisma.eventPackItem.findMany({
      where: { eventId },
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json(items);
  } catch (error) {
    console.error('Get pack items error:', error);
    res.status(500).json({ error: 'Failed to fetch pack items' });
  }
});

// POST /api/event-pack - Add item to pack list
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { eventId, name, category, quantity, assignedTo, notes } = req.body;

    if (!eventId || !name || !category) {
      return res.status(400).json({ error: 'Event, name, and category are required' });
    }

    const event = await prisma.campsiteEvent.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const item = await prisma.eventPackItem.create({
      data: {
        eventId,
        name,
        category,
        quantity: quantity || 1,
        assignedTo: assignedTo || null,
        notes: notes || null,
        isChecked: false,
      },
      include: {
        assignedUser: {
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

    res.json(item);
  } catch (error) {
    console.error('Add pack item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// PUT /api/event-pack/:id - Update pack item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, quantity, assignedTo, isChecked, notes } = req.body;

    const item = await prisma.eventPackItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updatedItem = await prisma.eventPackItem.update({
      where: { id },
      data: {
        name: name || undefined,
        category: category || undefined,
        quantity: quantity !== undefined ? quantity : undefined,
        assignedTo: assignedTo !== undefined ? assignedTo : undefined,
        isChecked: isChecked !== undefined ? isChecked : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
      include: {
        assignedUser: {
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

    res.json(updatedItem);
  } catch (error) {
    console.error('Update pack item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/event-pack/:id - Delete pack item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.eventPackItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await prisma.eventPackItem.delete({
      where: { id }
    });

    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Delete pack item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
