import { useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000'); // 백엔드 주소

function App() {
  useEffect(() => {
    socket.on('connect', () => {
      console.log('🧠 Socket 연결됨:', socket.id);

      const roomId: string = 'room1';
      socket.emit('join', roomId);
    });

    socket.on('peer-joined', (peerId: string) => {
      console.log('👥 상대방이 방에 참가함:', peerId);
    });

    // 선택: 에러 및 연결 끊김 로그
    socket.on('disconnect', () => {
      console.log('❌ 연결 종료됨');
    });
    socket.on('connect_error', (err) => {
      console.error('❗ 연결 오류:', err);
    });
  }, []);

  return (
    <div>
      <h1>MSH - WebRTC 화상통화</h1>
      <p>콘솔을 확인해보세요!</p>
    </div>
  );
}

export default App;
