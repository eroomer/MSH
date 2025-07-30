import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

function LobbyPage() {
  const [roomId, setRoomId] = useState('00');
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
      <button onClick={handleJoin}>게임하기</button>
      <button >게임 안하기</button>
      <button onClick={handleCali}>캘리브레이션</button>
    </div>
  );
}

export default LobbyPage;
