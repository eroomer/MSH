import { socket } from './socket';

export function createPeerConnection(
  stream: MediaStream,
  onRemoteStream: (stream: MediaStream) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  console.log('🌐 WebRTC 연결 생성됨');

  // ICE 후보 전송
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('📤 ICE 후보 전송:', event.candidate);
      socket.emit('ice-candidate', event.candidate);
    }
  };

  // 원격 스트림 수신
  pc.ontrack = (event) => {
    console.log('📺 수신된 스트림:', event.streams[0]);
    onRemoteStream(event.streams[0]);
  };

  // 연결 상태 확인
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    console.log('📶 WebRTC 연결 상태 변경:', state);
    if (state === 'connected') {
      console.log('✅ WebRTC 연결 완료 (P2P 연결 성공)');
    }
  };

  // 로컬 스트림 등록
  stream.getTracks().forEach((track) => {
    console.log('➕ 트랙 추가됨:', track);
    pc.addTrack(track, stream);
  });

  return pc;
}
