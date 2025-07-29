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
    <div style={{ padding: 40 }}>
      <h1>MSH - 여기는 홈 페이지</h1>
      <input
        placeholder="이름 입력"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button onClick={handleStart}>접속 하기</button>
    </div>
  );
}

export default HomePage;
