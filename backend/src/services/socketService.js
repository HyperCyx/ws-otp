let io;

// Store user socket connections: Map<userId, Set<socketId>>
const userSockets = new Map();

function initSocketServer(socketIo) {
  io = socketIo;

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Register socket for this user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
    });
  });
}

function getSocketServer() {
  return io;
}

/**
 * Emit an event to all sockets belonging to a specific user.
 */
async function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Broadcast to all connected clients (admin use).
 */
async function broadcast(event, data) {
  if (!io) return;
  io.emit(event, data);
}

module.exports = { initSocketServer, getSocketServer, emitToUser, broadcast };
