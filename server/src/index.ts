import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';

// express 앱과 http 서버 생성
const app = express();
const server = http.createServer(app);

// socket.io 서버 생성
const io = new SocketIOServer(server, {
  cors: {
    origin: '*', // 개발 중엔 모두 허용. 배포 시 도메인 제한 권장
    methods: ['GET', 'POST'],
  },
});

// (선택) 클라이언트 정적 파일 서빙 (빌드된 React 앱이 있다면)
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.use(cors()); // 필요 시 cors 직접 추가

// socket.io signaling 처리
io.on('connection', (socket) => {
  console.log('🔌 클라이언트 연결됨:', socket.id);

  socket.on('join', (roomId: string) => {
    socket.join(roomId);
    console.log(`👥 ${socket.id}가 방 ${roomId}에 참가함`);
    socket.to(roomId).emit('peer-joined', socket.id);
  });

  socket.on('offer', (data: { roomId: string; sdp: RTCSessionDescriptionInit }) => {
    socket.to(data.roomId).emit('offer', { sdp: data.sdp, from: socket.id });
  });

  socket.on('answer', (data: { roomId: string; sdp: RTCSessionDescriptionInit }) => {
    socket.to(data.roomId).emit('answer', { sdp: data.sdp, from: socket.id });
  });

  socket.on('ice-candidate', (data: { roomId: string; candidate: RTCIceCandidateInit }) => {
    socket.to(data.roomId).emit('ice-candidate', { candidate: data.candidate, from: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('❌ 연결 종료:', socket.id);
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
