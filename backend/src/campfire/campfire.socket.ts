import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';

export function registerCampfireSockets(io: Server) {
  const campfire = io.of('/campfire');

  campfire.on('connection', async (socket: Socket) => {
    const { campgroundId, userId } = socket.handshake.query as { campgroundId: string; userId: string };
    if (!campgroundId || !userId) { socket.disconnect(); return; }

    socket.join(campgroundId);

    const checkedIn = await getCheckedInUsers(campgroundId);
    campfire.to(campgroundId).emit('presence:update', checkedIn);
    await maybeActivateRoom(campgroundId, campfire);

    socket.on('message:send', async (data: { content: string }) => {
      if (!data.content?.trim()) return;
      const room = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
      if (!room?.isActive) return;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, profileImage: true, firstName: true, lastName: true },
      });
      if (!user) return;
      const msg = await prisma.campfireMessage.create({
        data: { roomId: room.id, userId, content: data.content.trim() },
        include: { user: { select: { id: true, username: true, profileImage: true, firstName: true, lastName: true } } },
      });
      campfire.to(campgroundId).emit('message:new', {
        id: msg.id, content: msg.content, createdAt: msg.createdAt,
        isSystem: false, isHitch: false, user: msg.user,
      });
    });

    socket.on('disconnect', async () => {
      const checkedIn = await getCheckedInUsers(campgroundId);
      campfire.to(campgroundId).emit('presence:update', checkedIn);
    });
  });
}

async function getCheckedInUsers(campgroundId: string) {
  const checkIns = await prisma.checkIn.findMany({
    where: { campgroundId, isActive: true },
    include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profileImage: true } } },
    take: 50,
  });
  return checkIns.map((c: any) => c.user);
}

async function maybeActivateRoom(campgroundId: string, namespace: any) {
  const count = await prisma.checkIn.count({ where: { campgroundId, isActive: true } });
  const existing = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
  if (count >= 3 && !existing?.isActive) {
    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true } });
    const room = await prisma.campfireRoom.upsert({
      where: { campgroundId },
      update: { isActive: true, activatedAt: new Date(), closedAt: null },
      create: { campgroundId, isActive: true, activatedAt: new Date() },
    });
    await prisma.campfireMessage.createMany({
      data: [
        { roomId: room.id, isSystem: true, content: `🔥 Campfire Chat is live at ${campground?.name || 'this campground'}! Trivia kicks off at 5:30 PM.` },
        { roomId: room.id, isHitch: true, content: `Hey campers! 🦄 Pull up a chair — the fire's going and trivia starts at 5:30. Until then, chat away!` },
      ],
    });
    namespace.to(campgroundId).emit('room:activated', { message: '🔥 Campfire is live! Trivia at 5:30 PM.' });
  }
}
