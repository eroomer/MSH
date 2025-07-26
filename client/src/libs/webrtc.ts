import { SOCKET_EVENTS } from '../../../shared/socketEvents';
import { socket } from './socket';

export function createPeerConnection(
  stream: MediaStream,
  onRemoteStream: (stream: MediaStream) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  console.log('🌐 client to cleint WebRTC 연결 생성됨');

  // ICE 후보 전송
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('📤 client to cleint ICE 후보 전송:', event.candidate);
      socket.emit(SOCKET_EVENTS.C2C_ICE_CANDIDATE, event.candidate);
    }
  };

  // 원격 스트림 수신
  pc.ontrack = (event) => {
    console.log('📺 client to cleint WebRTC 수신된 스트림:', event.streams[0]);
    onRemoteStream(event.streams[0]);
  };

  // 연결 상태 확인
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    console.log('📶 client to cleint WebRTC 연결 상태 변경:', state);
    if (state === 'connected') {
      console.log('✅ client to cleint WebRTC 연결 완료 (P2P 연결 성공)');
    }
  };

  // 로컬 스트림 등록
  stream.getTracks().forEach((track) => {
    console.log('➕ client to cleint WebRTC 트랙 추가됨:', track);
    pc.addTrack(track, stream);
  });

  return pc;
}

export function createServerConnection(
  stream: MediaStream
): RTCPeerConnection {

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  console.log('🌐 client to server WebRTC 연결 생성됨');

  // ICE 후보 전송
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateInit = event.candidate.toJSON();
      console.log('📤 client to server ICE 후보 전송:', candidateInit);
      socket.emit(SOCKET_EVENTS.C2S_ICE_CANDIDATE, candidateInit);
    }
  };

  // 연결 상태 확인
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    console.log('📶 client to server WebRTC 연결 상태 변경:', state);
    if (state === 'connected') {
      console.log('✅ client to server WebRTC 연결 완료 (P2P 연결 성공)');
    }
  };

  // 로컬 스트림 등록
  stream.getTracks().forEach((track) => {
    console.log('➕ client to server WebRTC 트랙 추가됨:', track);
    pc.addTrack(track, stream);
  });

  return pc;
}
