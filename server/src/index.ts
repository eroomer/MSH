import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS } from '../../shared/socketEvents';
import { handleSocketEvent } from './socketHandler';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // .env 파일을 로드함

// express 앱과 http 서버 생성
const app = express();
app.use(cors());
const server = http.createServer(app);

// socket.io 서버 생성
const io = new SocketIOServer(server, {
  cors: {
    origin: '*', // 개발 중엔 모두 허용. 배포 시 도메인 제한 권장
    methods: ['GET', 'POST'],
  },
});

// socket.io signaling 처리
io.on('connection', (socket) => {
    console.log('✅ 새 클라이언트 연결:', socket.id);
    socket.onAny((event, payload) => {
        handleSocketEvent(socket, event, payload);
    });
    socket.on('disconnect', () => {
        console.log(`❌ 연결 종료: ${socket.id}`);
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit(SOCKET_EVENTS.ROOM_PEER_LEFT);
            console.log(`👋 방 ${roomId}에 퇴장 알림`);
        }
    });
  });

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
