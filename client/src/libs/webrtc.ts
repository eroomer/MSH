import { SOCKET_EVENTS } from '../../../shared/socketEvents';
import { socket } from './socket';

const STUN    = [{ urls: 'stun:stun.l.google.com:19302' }];

export function createPeerConnection(
  stream: MediaStream,
  onRemoteStream: (stream: MediaStream) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: STUN });

  //console.log('🌐 client to cleint WebRTC 연결 생성됨');

  // ICE 후보 전송
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateInit = event.candidate.toJSON();
      //console.log('📤 client to client ICE 후보 전송');
      socket.emit(SOCKET_EVENTS.C2C_ICE_CANDIDATE, { candidateInit });
    }
  };

  // 원격 스트림 수신
  pc.ontrack = (event) => {
    //console.log('📺 client to cleint WebRTC 수신된 스트림');
    onRemoteStream(event.streams[0]);
  };

  // 연결 상태 확인
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    //console.log('📶 client to cleint WebRTC 연결 상태 변경:', state);
    if (state === 'connected') {
      console.log('✅ client to cleint WebRTC 연결 완료 (P2P 연결 성공)');
    }
  };

  // 로컬 스트림 등록
  stream.getTracks().forEach((track) => {
    //console.log('➕ client to cleint WebRTC 트랙 추가됨');
    pc.addTrack(track, stream);
  });

  return pc;
}

export async function createServerConnection(
  videoEl: HTMLVideoElement, 
  canvasEl: HTMLCanvasElement
): Promise<RTCPeerConnection> {

  const pc = new RTCPeerConnection({ iceServers: STUN }); // peerconnection

  const dc = pc.createDataChannel('meta');                // detachannel

  console.log('🌐 client to server WebRTC 연결 생성됨');

  // ICE 후보 전송
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateInit = event.candidate.toJSON();
      //console.log('📤 client to server ICE 후보 전송');
      socket.emit(SOCKET_EVENTS.C2S_ICE_CANDIDATE, { candidateInit });
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

  await startCapture(pc, dc, videoEl, canvasEl);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit(SOCKET_EVENTS.C2S_OFFER, { offer });
  console.log('📤 client to server offer 전송');

  return pc;
}

async function startCapture(pc: RTCPeerConnection, dc: RTCDataChannel, videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement): Promise<void> {
  await videoEl.play();
  const ctx = canvasEl.getContext('2d');
  if (!ctx) {
    throw new Error('2D context not available');
  }

  const ROI = 256;
  let fid   = 0;

  const draw = () => {
    if (videoEl.readyState < 2) {
      requestAnimationFrame(draw);
      return;
    }

    const side = Math.min(videoEl.videoWidth, videoEl.videoHeight);
    ctx.drawImage(
      videoEl,
      (videoEl.videoWidth  - side) / 2,
      (videoEl.videoHeight - side) / 2,
      side, side,
      0, 0, ROI, ROI
    );

    if (dc.readyState === 'open') {
      dc.send(JSON.stringify({ fid: fid++, ts: Date.now() / 1000 }));
    }
    requestAnimationFrame(draw);
  };
  draw();

  const cStream = canvasEl.captureStream(30);
  cStream.getTracks().forEach((track) => {
    console.log(new Date().toLocaleTimeString(), '➕ client to server WebRTC 트랙 추가됨', cStream);
    pc.addTrack(track, cStream);
  });
}


