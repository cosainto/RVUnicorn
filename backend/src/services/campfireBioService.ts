import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

import { prisma as db } from '../lib/prisma';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Compute a SHA-256 hash of the user's current activity profile.
 * When this hash changes, the cached bio is stale.
 */
export async function computeActivityHash(userId: string): Promise<string> {
  const [eventCount, stateCount, checkinCount, friendCount, badgeCount, user] =
    await Promise.all([
      db.event.count({ where: { organizerId: userId } }),
      db.stateVisit.count({ where: { userId } }),
      db.checkIn.count({ where: { userId } }),
      db.friendship.count({ where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] } }),
      db.userBadge.count({ where: { userId } }),
      db.user.findUnique({
        where: { id: userId },
        select: { rvYear: true, rvMake: true, rvModel: true },
      }),
    ]);

  const str = `trips:${eventCount}|states:${stateCount}|checkins:${checkinCount}|friends:${friendCount}|rv:${user?.rvYear || ''}${user?.rvMake || ''}${user?.rvModel || ''}|badges:${badgeCount}`;
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Generate a fresh Campfire Chronicles bio via Claude Haiku, persist it,
 * and return the text.
 */
export async function generateCampfireBio(userId: string): Promise<string> {
  // Fetch user profile data
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      rvYear: true,
      rvMake: true,
      rvModel: true,
      rvType: true,
      homeState: true,
      createdAt: true,
    },
  });

  if (!user) throw new Error('User not found');

  // Fetch counts and activity data in parallel
  const [eventCount, stateVisits, checkinCount, friendCount, badges, recentTrips] =
    await Promise.all([
      db.event.count({ where: { organizerId: userId } }),
      db.stateVisit.findMany({
        where: { userId },
        select: { state: true },
        distinct: ['state'],
      }),
      db.checkIn.count({ where: { userId } }),
      db.friendship.count({
        where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
      }),
      db.userBadge.findMany({
        where: { userId },
        include: { badge: { select: { name: true } } },
        take: 5,
        orderBy: { earnedAt: 'desc' },
      }),
      db.event.findMany({
        where: { organizerId: userId },
        orderBy: { startDate: 'desc' },
        take: 3,
        include: { campground: { select: { name: true } } },
      }),
    ]);

  const stateNames = stateVisits.map((s: any) => s.state);
  const badgeNames = badges.map((b: any) => b.badge?.name).filter(Boolean);
  const tripDestinations = recentTrips
    .map((t: any) => t.campground?.name || t.title)
    .filter(Boolean);

  const memberSince = new Date(user.createdAt).getFullYear();
  const rvInfo = [user.rvYear, user.rvMake, user.rvModel, user.rvType]
    .filter(Boolean)
    .join(' ');

  const userPrompt = `Write a Campfire Chronicles bio for this RVUnicorn member:

Name: ${user.firstName} ${user.lastName || ''}
Home state: ${user.homeState || 'unknown'}
RV: ${rvInfo || 'not specified'}
Member since: ${memberSince}
Trips planned: ${eventCount}
States visited: ${stateNames.length > 0 ? stateNames.join(', ') : 'none yet'}
Check-ins: ${checkinCount}
Friends on the road: ${friendCount}
Badges earned: ${badgeNames.length > 0 ? badgeNames.join(', ') : 'none yet'}
Recent destinations: ${tripDestinations.length > 0 ? tripDestinations.join(', ') : 'none yet'}

Write the bio now (2-3 sentences, third person, use only their first name):`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system:
      'You are writing a Campfire Chronicles bio for an RVUnicorn member profile. Warm, personality-driven, like the opening of a great travel memoir. Third person. 2-3 sentences max. Evocative and specific.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const bio =
    response.content[0].type === 'text' ? response.content[0].text.trim() : '';

  // Compute fresh hash and persist
  const hash = await computeActivityHash(userId);
  await db.user.update({
    where: { id: userId },
    data: {
      campfireChroniclesBio: bio,
      campfireBioGeneratedAt: new Date(),
      campfireBioActivityHash: hash,
    },
  });

  return bio;
}

/**
 * Compare the current activity hash against the stored one.
 * If they differ, kick off a background regeneration (non-blocking).
 */
export async function checkAndRefreshBio(userId: string): Promise<void> {
  try {
    const [currentHash, user] = await Promise.all([
      computeActivityHash(userId),
      db.user.findUnique({
        where: { id: userId },
        select: { campfireBioActivityHash: true },
      }),
    ]);

    if (user?.campfireBioActivityHash !== currentHash) {
      setImmediate(() => {
        generateCampfireBio(userId).catch((err: any) => {
          console.error('Background bio refresh failed:', err?.message);
        });
      });
    }
  } catch (err: any) {
    console.error('checkAndRefreshBio error:', err?.message);
  }
}
