import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

function LobbyPage() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    if (roomId.trim()) {
      navigate(`/game/${roomId}`);
    }
  };

  const handleCali = () => {
    navigate(`/cali`);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>여기는 로비 페이지</h1>
      <button onClick={handleJoin}>방 만들기</button>
      <button onClick={handleCali}>캘리브레이션</button>
      <input
        placeholder="방 ID 입력"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={handleJoin}>방 참가</button>
    </div>
  );
}

export default LobbyPage;
