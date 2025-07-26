import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../libs/socket';           // 소켓 전역 변수
import { SOCKET_EVENTS } from '../../../shared/socketEvents';
import { createPeerConnection, createServerConnection } from '../libs/webrtc';  // WebRTC 연결 객체 생성
import { drawVideoToCanvas } from '../libs/canvas/drawVideoToCanvas'; // Video -> Canvas 복사 함수
//import { io } from 'socket.io-client';
//const socket = io('http://localhost:3000'); // 서버 주소

function GamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const pcPeer = useRef<RTCPeerConnection | null>(null);     // 상대 클라이언트와의 WebRTC 연결 객체
  const pcServer = useRef<RTCPeerConnection | null>(null);     // 서버와의 WebRTC 연결 객체
  const myStreamRef = useRef<MediaStream | null>(null);             // 내 캠/마이크 스트림 저장
  const iceQueuePeer : RTCIceCandidateInit[] = [];               // 상대 클라이언트와의 ICE 후보 저장
  const iceQueueServer : RTCIceCandidateInit[] = [];               // 서버와의 ICE 후보 저장

  const myVideoRef = useRef<HTMLVideoElement>(null);        // 내 비디오 스트림 
  const myCanvasRef = useRef<HTMLCanvasElement>(null);      // 내 비디오 스트림을 복사본 + 효과 적용한 실제 표시 화면

  const remoteVideoRef = useRef<HTMLVideoElement>(null);    // 상대방 비디오 스트림
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);  // 상대방 비디오 스트림을 복사본 + 효과 적용한 실제 표시 화면

  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // 비디오/오디오 모두 포함된 full stream
        console.log('🎥 내 스트림 획득됨:', stream);
        myStreamRef.current = stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;  // 비디오 stream만 저장
        }

        console.log('🔌 소켓 연결됨, 방 입장 요청:', roomId);
        socket.connect();
        socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId });

        // pcServer.current = createServerConnection(
        //   myStreamRef.current!
        // );

        pcPeer.current = createPeerConnection(
            myStreamRef.current!,
            (remoteStream) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
            }
        );
      } catch (err) {
        console.error('Media error:', err);
      }
    };
    startMedia();

    // 소켓 이벤트 처리리
    socket.onAny((event, payload) => {
      handleSocketEvent(event, payload);
    });

    if (myVideoRef.current && myCanvasRef.current) {
      console.log('내 비디오 스트림 복사');
      drawVideoToCanvas(myVideoRef.current, myCanvasRef.current);
    }
  
    if (remoteVideoRef.current && remoteCanvasRef.current) {
      console.log('상대 비디오 스트림 복사');
      drawVideoToCanvas(remoteVideoRef.current, remoteCanvasRef.current);
    }

    return () => {
      console.log('🧹 언마운트 및 정리');
      socket.disconnect();
      pcPeer.current?.close();
      pcPeer.current = null;
    };
  }, [roomId]);

  return (
    <div>
      <h2>📞 WebRTC Call - 방 ID: {roomId}</h2>
      <div style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
        {/* 내 화면 (video + canvas) */}
        <div style={{ flex: 1, backgroundColor: '#111', position: 'relative' }}>
          <h2>내 화면 <video ref={myVideoRef} autoPlay muted playsInline style={{ width: '1px', height: '1px', opacity: 0, pointerEvents: 'none'}} /> </h2>
          <canvas ref={myCanvasRef} width={640} height={480} style={{ width: '100%', height: 'auto' }} />
        </div>

        {/* 상대 화면 (video + canvas) */}
        <div style={{ flex: 1, backgroundColor: '#222', position: 'relative' }}>
          <h2>상대 화면 <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '1px', height: '1px', opacity: 0, pointerEvents: 'none'}} /> </h2>
          <canvas ref={remoteCanvasRef} width={640} height={480} style={{ width: '100%', height: 'auto' }} />
        </div>
      </div>
    </div>
  );

  function handleSocketEvent(event: string, payload: any) {
    if (event.startsWith('room:')) {
      handleRoomEvent(event, payload);
    } else if (event.startsWith('c2c:')) {
      handleC2CEvent(event, payload);
    } else if (event.startsWith('c2s:')) {
      //handleC2SEvent(event, payload);
    } else {
      console.warn(`[⚠️ Unhandled Event] ${event}`);
    }
  }
  
  function handleRoomEvent(event: string, payload: any) {
    switch (event) {
      case SOCKET_EVENTS.ROOM_JOIN:
        break;
      case SOCKET_EVENTS.ROOM_FULL:
        console.warn('🚫 방이 가득 찼습니다. 홈으로 이동합니다.');
        alert('방이 가득 찼습니다.');
        navigate('/');
        break;
      case SOCKET_EVENTS.ROOM_PEER_LEFT:
        console.log('👋 상대방 연결 종료됨');
        pcPeer.current?.close();
        pcPeer.current = createPeerConnection(
            myStreamRef.current!,
            (remoteStream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            }
        );
        console.log('🌐 WebRTC 연결 생성됨');
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        break;
      default:
        console.warn(`[⚠️ Unhandled Room Event] ${event}`);
        break;
    }
  }

  async function handleC2CEvent(event: string, payload: any) {
    switch(event) {
      case SOCKET_EVENTS.C2C_CALLER: {
        const { peerId } = payload as { peerId: string };
        console.log(`📡 당신은 caller, 당신의 peer는 ${peerId}`);
        if (pcPeer.current) {
          const offer = await pcPeer.current.createOffer();
          await pcPeer.current.setLocalDescription(offer);
          console.log('📤 offer 전송:', offer);
          socket.emit(SOCKET_EVENTS.C2C_OFFER, { offer });
        }
      break; }
    case SOCKET_EVENTS.C2C_CALLEE: {
      const { peerId } = payload as { peerId: string };
      console.log(`🎧 당신은 callee, 당신의 peer는 ${peerId}`);
      // 아무 것도 하지 않고 offer 기다림
      break; }
    case SOCKET_EVENTS.C2C_OFFER: {
      const { offer } = payload as { offer: RTCSessionDescriptionInit };
      console.log('📨 offer 수신:', offer);
      if (pcPeer.current) {
        await pcPeer.current.setRemoteDescription(offer);
        const answer = await pcPeer.current.createAnswer();
        await pcPeer.current.setLocalDescription(answer);
        console.log('📤 answer 전송:', answer);
        socket.emit(SOCKET_EVENTS.C2C_ANSWER, { answer });

        for (const candidate of iceQueuePeer) {
            await pcPeer.current.addIceCandidate(candidate);
        }
        iceQueuePeer.length = 0;
      }
      break; }
    case SOCKET_EVENTS.C2C_ANSWER: {
      const { answer } = payload as { answer: RTCSessionDescriptionInit };
      console.log('📨 answer 수신:', answer);
      await pcPeer.current?.setRemoteDescription(answer);

      for (const candidate of iceQueuePeer) {
        await pcPeer.current?.addIceCandidate(candidate);
      }
      iceQueuePeer.length = 0;
      break; }
    case SOCKET_EVENTS.C2C_ICE_CANDIDATE: {
      const candidate = payload as RTCIceCandidateInit;
      console.log('ICE payload:', payload);
      console.log('❄️ ICE 후보 수신:', candidate);
      if (pcPeer.current?.remoteDescription) {
        await pcPeer.current.addIceCandidate(candidate);
        console.log('❄️ ICE 후보 추가:', candidate);
      } else {
        iceQueuePeer.push(candidate);
        console.log('❄️ ICE 후보 큐에 저장:', candidate);
      }
      break; }
    default:
      console.warn(`[⚠️ Unhandled C2C Event] ${event}`);
      break;
    }
  }

  // 기능 미정
  // function handleC2SEvent(event: string, payload: any) {
  //   switch(event) {
  //     case SOCKET_EVENTS.C2S_OFFER:
  //       break;
  //     case SOCKET_EVENTS.C2S_ANSWER:
  //       break;
  //     case SOCKET_EVENTS.C2S_ICE_CANDIDATE:
  //       break;
  //     default:
  //       console.warn(`[⚠️ Unhandled C2S Event] ${event}`);
  //       break;
  //   }
  // }
}

export default GamePage;


