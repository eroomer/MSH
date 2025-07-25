import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

function HomePage() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    if (roomId.trim()) {
      navigate(`/call/${roomId}`);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>📞 MSH - WebRTC 데모</h1>
      <input
        placeholder="방 ID 입력"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={handleJoin}>방 참가</button>
    </div>
  );
}

export default HomePage;
