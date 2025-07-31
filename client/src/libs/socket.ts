import { io } from 'socket.io-client';

// 소켓 전역 변수
export const socket = io('http://localhost:3000', {
  autoConnect: false, // 원할 때만 연결
});

// localhost:3000
// 172.20.12.102:80