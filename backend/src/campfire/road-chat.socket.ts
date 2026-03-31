import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';

const ROOM = 'road:global';

// Ephemeral in-memory store — no DB, like a CB radio
const activeDrivers = new Map<string, { userId: string; firstName: string; profilePicture: string | null; state: string }>();

export function registerRoadChatSockets(io: Server) {
  const roadChat = io.of('/road-chat');

  roadChat.on('connection', async (socket: Socket) => {
    const { userId, token } = socket.handshake.query as { userId: string; token: string };
    if (!userId) { socket.disconnect(); return; }

    // Get user info
    let user: { id: string; firstName: string; lastName: string; profilePicture: string | null; username: string } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true },
      });
    } catch { socket.disconnect(); return; }
    if (!user) { socket.disconnect(); return; }

    socket.join(ROOM);

    // Register as active driver
    activeDrivers.set(socket.id, {
      userId: user.id,
      firstName: user.firstName,
      profilePicture: user.profilePicture,
      state: 'driving',
    });

    // Broadcast updated driver count
    roadChat.to(ROOM).emit('drivers:update', { count: activeDrivers.size });

    // Send join system message
    roadChat.to(ROOM).emit('message:new', {
      id: `sys-${Date.now()}`,
      content: `🚐 ${user.firstName} joined the road`,
      isSystem: true,
      createdAt: new Date().toISOString(),
      user: { id: user.id, firstName: user.firstName, profilePicture: user.profilePicture },
    });

    // Handle incoming messages
    socket.on('message:send', (data: { content: string }) => {
      if (!data.content?.trim() || !user) return;
      const msg = {
        id: `msg-${Date.now()}-${user.id}`,
        content: data.content.trim().slice(0, 300),
        isSystem: false,
        createdAt: new Date().toISOString(),
        user: { id: user.id, firstName: user.firstName, profilePicture: user.profilePicture },
      };
      roadChat.to(ROOM).emit('message:new', msg);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      activeDrivers.delete(socket.id);
      roadChat.to(ROOM).emit('drivers:update', { count: activeDrivers.size });
      if (user) {
        roadChat.to(ROOM).emit('message:new', {
          id: `sys-${Date.now()}`,
          content: `🏕️ ${user.firstName} pulled over`,
          isSystem: true,
          createdAt: new Date().toISOString(),
          user: { id: user.id, firstName: user.firstName, profilePicture: user.profilePicture },
        });
      }
    });
  });
}
