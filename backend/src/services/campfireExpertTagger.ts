import { prisma } from '../prisma';
import { CAMPFIRE_CHARACTERS, CharacterKey } from '../lib/campfireCharacters';
import { sendWebPush } from '../utils/webPush';

export async function tagExperts(threadId: string): Promise<void> {
  const thread = await (prisma as any).campfireThread.findUnique({
    where: { id: threadId },
    include: { destinations: true },
  });

  if (!thread) return;

  const character = CAMPFIRE_CHARACTERS[thread.character as CharacterKey];
  if (!character) return;

  // Build user filter based on targetAudience
  const where: any = {
    NOT: { email: { in: ['wroberts82@yahoo.com', 'deanna@rvunicorn.com'] } },
  };

  const audience = (thread.targetAudience || '').toLowerCase();

  if (audience.includes('solo')) {
    where.OR = [
      { campingStyles: { has: 'SOLO' } },
      { travelPartyType: 'SOLO' },
    ];
  } else if (audience.includes('class a')) {
    where.rvType = 'CLASS_A';
  } else if (audience.includes('class c')) {
    where.rvType = 'CLASS_C';
  } else if (audience.includes('class b')) {
    where.rvType = 'CLASS_B';
  } else if (audience.includes('fifth') || audience.includes('5th')) {
    where.rvType = 'FIFTH_WHEEL';
  } else if (audience.includes('boondock') || audience.includes('off grid') || audience.includes('off-grid')) {
    where.campingStyles = { hasSome: ['BOONDOCKING', 'OFF_GRID'] };
  } else if (audience.includes('famil')) {
    where.travelPartySize = { gte: 3 };
  }

  // Find top 3 matching active users
  const experts = await prisma.user.findMany({
    where,
    orderBy: { lastActiveAt: 'desc' },
    take: 3,
    select: { id: true, firstName: true },
  });

  // Build the notification URL
  const boardSlug = thread.boardId
    ? await (prisma as any).board.findUnique({ where: { id: thread.boardId }, select: { slug: true } })
    : null;
  const postUrl = boardSlug?.slug
    ? `/community/${boardSlug.slug}?post=${thread.postId}`
    : `/community?post=${thread.postId}`;

  for (const expert of experts) {
    // Create expert tag record
    await (prisma as any).campfireThreadExpertTag.create({
      data: {
        threadId,
        userId: expert.id,
        notified: true,
      },
    });

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId: expert.id,
        type: 'CAMPFIRE_THREAD_TAG',
        content: `${character.name} thinks you'd have a take on this week's Campfire thread: ${thread.title}`,
        link: postUrl,
        category: 'SYSTEM',
        actorName: character.name,
      },
    });

    // Send push notification
    await sendWebPush(expert.id, {
      title: `${character.name} called you out 👀`,
      body: `${character.name} thinks you'd have a take on this week's Campfire thread: ${thread.title}`,
      url: postUrl,
    });
  }

  // Also notify users whose rig type matches rigContext (up to 50)
  if (thread.rigContext) {
    const rigContext = thread.rigContext.toLowerCase();
    const rigFilter: any = { NOT: { id: { in: experts.map((e: any) => e.id) } } };

    if (rigContext.includes('class a')) rigFilter.rvType = 'CLASS_A';
    else if (rigContext.includes('class c')) rigFilter.rvType = 'CLASS_C';
    else if (rigContext.includes('class b')) rigFilter.rvType = 'CLASS_B';
    else if (rigContext.includes('fifth') || rigContext.includes('5th')) rigFilter.rvType = 'FIFTH_WHEEL';
    else if (rigContext.includes('trailer')) rigFilter.rvType = 'TRAVEL_TRAILER';
    else return; // No specific rig type to match

    const rigUsers = await prisma.user.findMany({
      where: rigFilter,
      orderBy: { lastActiveAt: 'desc' },
      take: 50,
      select: { id: true },
    });

    // Rate-limited push — 10 per batch with 6s delay between batches
    for (let i = 0; i < rigUsers.length; i += 10) {
      const batch = rigUsers.slice(i, i + 10);
      await Promise.allSettled(
        batch.map((u) =>
          sendWebPush(u.id, {
            title: `🔥 New Weekly Campfire Thread`,
            body: `${character.name} posted: ${thread.title}`,
            url: postUrl,
          })
        )
      );
      if (i + 10 < rigUsers.length) {
        await new Promise((r) => setTimeout(r, 6000));
      }
    }
  }

  console.log(`[CampfireThread] Tagged ${experts.length} experts for thread "${thread.title}"`);
}
