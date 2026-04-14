import { prisma } from '../prisma';
import { CAMPFIRE_CHARACTERS, CharacterKey } from '../lib/campfireCharacters';
import { tagExperts } from './campfireExpertTagger';

const ADMIN_USER_ID = 'cmlpeyk82005s3qause3sws7y';

// Map categories to board slugs
const CATEGORY_BOARD_MAP: Record<string, string> = {
  DESTINATION: 'destinations',
  DEBATE: 'destinations',
  WISDOM: 'trip-planning',
  VALUE: 'tips-and-tricks',
  DEALS: 'tips-and-tricks',
  CONTROVERSY: 'tips-and-tricks',
  ADVENTURE: 'off-grid-boondocking',
  OFFGRID: 'off-grid-boondocking',
  TRAILS: 'off-grid-boondocking',
  HIDDEN_GEMS: 'off-grid-boondocking',
  SEASONAL: 'trip-planning',
  STARGAZING: 'trip-planning',
  SLOW_TRAVEL: 'trip-planning',
  NATURE: 'trip-planning',
};

export async function publishCampfireThread(threadId: string): Promise<void> {
  const thread = await (prisma as any).campfireThread.findUnique({
    where: { id: threadId },
    include: {
      destinations: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!thread || (thread.status !== 'SCHEDULED' && thread.status !== 'DRAFT')) {
    throw new Error(`Thread ${threadId} not found or already published`);
  }

  const character = CAMPFIRE_CHARACTERS[thread.character as CharacterKey];
  if (!character) throw new Error(`Unknown character: ${thread.character}`);

  // Find the target board
  const targetSlug = CATEGORY_BOARD_MAP[thread.category] || 'trip-planning';
  let board = await (prisma as any).board.findUnique({ where: { slug: targetSlug } });
  if (!board) {
    // Fallback to first active board
    board = await (prisma as any).board.findFirst({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
  if (!board) throw new Error('No community board found');

  // Compose the full post content
  const lines: string[] = [];

  // Hook question
  lines.push(`**${thread.hookQuestion}**`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Hot take
  lines.push(`🔥 **${character.name}'s Hot Take:**`);
  lines.push(`*${thread.hotTake}*`);
  lines.push('');

  // Main body
  lines.push(thread.content);
  lines.push('');

  // Destinations section
  if (thread.destinations.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('### 📍 Featured Spots');
    lines.push('');

    for (const dest of thread.destinations) {
      lines.push(`**${dest.name}**${dest.state ? ` — ${dest.state}` : ''}`);
      if (dest.rigRestriction) {
        lines.push(`🚐 Rig Note: ${dest.rigRestriction}`);
      }
      if (dest.amenitySummary) {
        lines.push(`${dest.amenitySummary}`);
      }
      if (dest.highlight) {
        lines.push(`⭐ ${dest.highlight}`);
      }
      if (dest.campgroundId) {
        lines.push(`[Add to Trip →](/road-trips/new?add=${dest.campgroundId})`);
      }
      lines.push('');
    }
  }

  // Seed replies
  const seedReplies = thread.seedReplies || [];
  if (seedReplies.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push(`💬 **${character.name} wants to know:**`);
    lines.push('');
    for (const q of seedReplies) {
      lines.push(`> ${q}`);
      lines.push('');
    }
  }

  const fullContent = lines.join('\n');

  // Create the BoardPost
  const post = await (prisma as any).boardPost.create({
    data: {
      boardId: board.id,
      authorId: ADMIN_USER_ID,
      title: `${character.emoji} ${thread.title}`,
      body: fullContent,
      postType: 'DISCUSSION',
      isPinned: true,
      isCharacterPost: true,
      characterAuthor: thread.character,
      tags: ['weekly-campfire', thread.category.toLowerCase()],
    },
  });

  // Increment board post count
  await (prisma as any).board.update({
    where: { id: board.id },
    data: { postCount: { increment: 1 } },
  });

  // Update the CampfireThread
  await (prisma as any).campfireThread.update({
    where: { id: threadId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      postId: post.id,
      boardId: board.id,
    },
  });

  // Tag experts
  try {
    await tagExperts(threadId);
  } catch (e: any) {
    console.error('[CampfireThread] Expert tagging failed:', e);
  }

  console.log(`[CampfireThread] Published thread "${thread.title}" to board "${board.slug}" as post ${post.id}`);
}
