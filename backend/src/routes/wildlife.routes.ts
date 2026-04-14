import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

const WILDLIFE_EMOJIS: Record<string, string> = {
  deer: '🦌', bear: '🐻', turkey: '🦃', eagle: '🦅', hawk: '🦅',
  owl: '🦉', fox: '🦊', raccoon: '🦝', rabbit: '🐰', squirrel: '🐿️',
  snake: '🐍', turtle: '🐢', frog: '🐸', alligator: '🐊', dolphin: '🐬',
  manatee: '🦭', pelican: '🐦', heron: '🦢', woodpecker: '🐦', coyote: '🐺',
  bobcat: '🐱', elk: '🦌', moose: '🫎', bison: '🐃', wolf: '🐺',
  other: '🐾',
};

function getEmoji(animal: string): string {
  const lower = animal.toLowerCase();
  for (const [key, emoji] of Object.entries(WILDLIFE_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return '🐾';
}

// GET /api/wildlife/:campgroundId — get recent sightings
router.get('/:campgroundId', async (req: Request, res: Response) => {
  try {
    const sightings = await (prisma as any).wildlifeSighting.findMany({
      where: { campgroundId: req.params.campgroundId },
      orderBy: { seenAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
    });
    res.json({ sightings });
  } catch (e: any) { res.status(500).json({ error: 'Failed to fetch sightings' }); }
});

// POST /api/wildlife/:campgroundId — log a sighting
router.post('/:campgroundId', authenticateToken, async (req: any, res: Response) => {
  try {
    const { animal, description, imageUrl, latitude, longitude } = req.body;
    if (!animal?.trim()) return res.status(400).json({ error: 'Animal name required' });

    const emoji = getEmoji(animal);
    const sighting = await (prisma as any).wildlifeSighting.create({
      data: {
        userId: req.userId,
        campgroundId: req.params.campgroundId,
        animal: animal.trim(),
        description: description?.trim() || null,
        imageUrl: imageUrl || null,
        emoji,
        latitude: latitude || null,
        longitude: longitude || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
    });

    // Post to campfire chat
    try {
      const room = await (prisma as any).campfireRoom.findFirst({
        where: { campgroundId: req.params.campgroundId, isActive: true },
      });
      if (room) {
        const msg = description
          ? `${emoji} Wildlife spotted! ${sighting.user.firstName} just saw a ${animal} — "${description}"`
          : `${emoji} Wildlife spotted! ${sighting.user.firstName} just saw a ${animal} nearby!`;
        await (prisma as any).campfireMessage.create({
          data: { roomId: room.id, userId: req.userId, isSystem: true, content: msg },
        });
      }
    } catch (e: any) { /* non-fatal */ }

    res.json({ sighting });
  } catch (e: any) { res.status(500).json({ error: 'Failed to log sighting' }); }
});

export default router;
