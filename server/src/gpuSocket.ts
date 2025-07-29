// gpuSocket.ts
import { WebSocketServer, WebSocket } from 'ws';
import { Server as IOServer } from 'socket.io';

interface GpuMessage {
  socketId: string;
  gaze: any;
  blink: boolean;
  frameId: number;
}

let gpuSock: WebSocket | null = null;

export function setupGpuWebSocket(io: IOServer) {
  const wss = new WebSocketServer({ port: 3001 });

  wss.on('connection', (ws: WebSocket) => {
    console.log('✅ GPU WS connected');
    gpuSock = ws;

    ws.on('message', (data: string | Buffer) => {
      try {
        const parsed: GpuMessage = JSON.parse(data.toString());
        const { socketId, gaze, blink, frameId } = parsed;

        io.to(socketId).emit('gs:gaze', { gaze, blink, frameId });
      } catch (err) {
        console.error('❌ Failed to parse GPU message:', err);
      }
    });

    ws.on('close', () => {
      console.warn('⚠️ GPU WS closed');
      gpuSock = null;
    });
  });
}
