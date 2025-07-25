import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
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
  
    socket.on('join', (roomId: string) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        const numClients = room ? room.size : 0;

        console.log(`📥 ${socket.id} → 방 ${roomId} 참가 시도 (현재 인원 ${numClients})`);

        if (numClients >= 2) {
            console.log(`🚫 방 ${roomId} 가득참`);
            socket.emit('room-full');
            return;
        }

        socket.join(roomId);
        socket.data.roomId = roomId;
        console.log(`🔗 ${socket.id} → 방 ${roomId} 입장`);

        const updatedRoom = io.sockets.adapter.rooms.get(roomId);
        const socketsInRoom = [...(updatedRoom || [])];
  
        if (socketsInRoom.length === 2) {
            const [socketId1, socketId2] = socketsInRoom;
        
            // 한쪽은 caller, 한쪽은 callee 지정
            io.to(socketId1).emit('you-are-caller', socketId2);
            io.to(socketId2).emit('you-are-callee', socketId1);
            console.log(`🎭 역할 분배 완료: ${socketId1} → caller, ${socketId2} → callee`);
        }
    });

    // ✨ WebRTC signaling 이벤트 추가
    socket.on('offer', (offer) => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('offer', offer);
            console.log('📡 offer 브로드캐스트');
        }
    });
    socket.on('answer', (answer) => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('answer', answer);
            console.log('📡 answer 브로드캐스트');
        }
    });
    socket.on('ice-candidate', (candidate) => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('ice-candidate', candidate);
            console.log('❄️ ICE 후보 브로드캐스트');
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ 연결 종료: ${socket.id}`);
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('peer-left');
            console.log(`👋 방 ${roomId}에 퇴장 알림`);
        }
    });
  });

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
