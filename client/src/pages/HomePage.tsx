import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

function HomePage() {
  const { username, setUsername } = useUser();
  const navigate = useNavigate();

  const handleStart = () => {
    if (!username.trim()) {
      alert('이름을 입력해주세요!');
      return;
    }
    navigate(`/lobby`);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '29px',
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>MSH - 여기는 홈 페이지</h1>
    
      <input
        placeholder="이름을 입력하세요"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          fontSize: '1rem',
          width: '240px'
        }}
      />
    
      <button
        onClick={handleStart}
        style={{
          padding: '10px 16px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: '#4f46e5',
          color: 'white',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        🚀 접속하기
      </button>
    </div>
  );
}

export default HomePage;
