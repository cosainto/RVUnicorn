import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// GET /api/emergency-contacts — list user's emergency contacts
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const contacts = await prisma.emergencyContact.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(contacts);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch emergency contacts' });
  }
});

// POST /api/emergency-contacts — add a new contact (max 5)
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { name, phoneNumber, relation, notifyOnCheckIn, notifyOnCheckOut } = req.body;
    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    const count = await prisma.emergencyContact.count({ where: { userId: req.userId } });
    if (count >= 5) {
      return res.status(400).json({ error: 'Maximum of 5 emergency contacts allowed' });
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        userId: req.userId,
        name,
        phoneNumber: phoneNumber.replace(/[^\d+]/g, ''), // strip non-numeric except +
        relation: relation || null,
        notifyOnCheckIn: notifyOnCheckIn !== false,
        notifyOnCheckOut: notifyOnCheckOut !== false,
      },
    });
    res.status(201).json(contact);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create emergency contact' });
  }
});

// PUT /api/emergency-contacts/:id — update a contact
router.put('/:id', authenticateToken, async (req: any, res) => {
  try {
    const existing = await prisma.emergencyContact.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Contact not found' });

    const { name, phoneNumber, relation, notifyOnCheckIn, notifyOnCheckOut } = req.body;
    const contact = await prisma.emergencyContact.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phoneNumber !== undefined && { phoneNumber: phoneNumber.replace(/[^\d+]/g, '') }),
        ...(relation !== undefined && { relation: relation || null }),
        ...(notifyOnCheckIn !== undefined && { notifyOnCheckIn }),
        ...(notifyOnCheckOut !== undefined && { notifyOnCheckOut }),
      },
    });
    res.json(contact);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update emergency contact' });
  }
});

// DELETE /api/emergency-contacts/:id — remove a contact
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const existing = await prisma.emergencyContact.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Contact not found' });

    await prisma.emergencyContact.delete({ where: { id: req.params.id } });
    res.json({ message: 'Contact deleted' });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete emergency contact' });
  }
});

export default router;
