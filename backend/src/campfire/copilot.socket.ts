import { Server, Socket } from 'socket.io';

export function registerCoPilotSockets(io: Server) {
  const copilot = io.of('/copilot');

  copilot.on('connection', (socket: Socket) => {
    const { sessionId, userId } = socket.handshake.query as { sessionId: string; userId: string };
    if (!sessionId) { socket.disconnect(); return; }

    // Join room keyed by session
    socket.join(sessionId);
    console.log(`[CoPilot Socket] User ${userId} joined session ${sessionId}`);

    socket.on('disconnect', () => {
      console.log(`[CoPilot Socket] User ${userId} left session ${sessionId}`);
    });
  });

  // Export helper to emit alerts from the ping handler
  return {
    emitAlert: (sessionId: string, alert: any) => {
      copilot.to(sessionId).emit('alert:new', alert);
    },
    emitSegmentChange: (sessionId: string, data: { previousIndex: number; currentIndex: number; segment: any }) => {
      copilot.to(sessionId).emit('segment:change', data);
    },
    emitSaveMeResults: (sessionId: string, results: any) => {
      copilot.to(sessionId).emit('save-me:results', results);
    },
  };
}
