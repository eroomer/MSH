import { useParams } from 'react-router-dom';

function CallPage() {
  const { roomId } = useParams();

  return (
    <div style={{ padding: 40 }}>
      <h2>🧑‍💻 화상 통화 방: {roomId}</h2>
      <p>여기에 영상 화면과 컨트롤 UI를 추가할 수 있어요.</p>
    </div>
  );
}

export default CallPage;
