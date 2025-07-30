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

  const buttonStyle: React.CSSProperties = {
    padding: '12px 20px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#6366f1',
    color: 'white',
    transition: 'all 0.2s',
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', color: '#fff' }}>🎮 여기는 로비 페이지</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={handleJoin}
          style={buttonStyle}
        >
          🚀 게임하기
        </button>

        <button
          onClick={() => alert('진짜 안 할 거야? 😢')}
          style={buttonStyle}
        >
          ❌ 게임 안하기
        </button>

        <button
          onClick={handleCali}
          style={buttonStyle}
        >
          🎯 캘리브레이션
        </button>
      </div>
    </div>
  );
}

export default LobbyPage;
