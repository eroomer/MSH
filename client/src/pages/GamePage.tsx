import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../libs/socket';           // 소켓 전역 변수
import { SOCKET_EVENTS } from '../../../shared/socketEvents';
import { createPeerConnection, createServerConnection } from '../libs/webrtc';  // WebRTC 연결 객체 생성
import { drawVideoToCanvas } from '../libs/canvas/drawVideoToCanvas'; // Video -> Canvas 복사 함수

function GamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [gaze,  setGaze]  = useState([0, 0]);    // 시선위치
  const [blink, setBlink] = useState(false);      // 감음?

  const pcPeer = useRef<RTCPeerConnection | null>(null);     // 상대 클라이언트와의 WebRTC 연결 객체
  const pcServer = useRef<RTCPeerConnection | null>(null);     // 서버와의 WebRTC 연결 객체
  const myStreamRef = useRef<MediaStream | null>(null);          // 내 캠/마이크 스트림 저장
  const iceQueuePeer : RTCIceCandidateInit[] = [];               // 상대 클라이언트와의 ICE 후보 저장
  const iceQueueServer : RTCIceCandidateInit[] = [];             // 서버와의 ICE 후보 저장

  const myVideoRef = useRef<HTMLVideoElement>(null);        // 내 비디오 스트림 
  const myCanvasRef = useRef<HTMLCanvasElement>(null);      // 내 비디오 스트림을 복사본 + 효과 적용한 실제 표시 화면

  const remoteVideoRef = useRef<HTMLVideoElement>(null);    // 상대방 비디오 스트림
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);  // 상대방 비디오 스트림을 복사본 + 효과 적용한 실제 표시 화면

  const roiCanvasRef = useRef<HTMLCanvasElement>(null);     // 시선 추적 로직에 사용할 ROI 캔버스

  useEffect(() => {
    // 소켓 이벤트 처리
    const handler = async (event: string, payload: any) => {
      await handleSocketEvent(event, payload);
    };
    socket.onAny(handler);

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // 비디오/오디오 모두 포함된 full stream
        console.log('🎥 내 스트림 획득됨:');
        myStreamRef.current = stream;

        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;  // 비디오 stream만 저장
        }

        console.log('🔌 소켓 연결됨, 방 입장 요청:', roomId);
        socket.connect();
        socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId });

        pcPeer.current = createPeerConnection(
            myStreamRef.current!,
            (remoteStream) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
            }
        );

        pcServer.current = await createServerConnection(
          myVideoRef.current!, roiCanvasRef.current!, 
        );
      } catch (err) {
        console.error('Media error:', err);
      }
    };
    startMedia();

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
      socket.offAny(handler);
      socket.disconnect();
      pcPeer.current?.close();
      pcPeer.current = null;
    };
  }, [roomId]);

  return (
    <div>
      <h2>📞 WebRTC Call - 방 ID: {roomId}  
        <canvas ref={roiCanvasRef} width={256} height={256}
        style={{ position:'absolute',width:0,height:0,opacity:0 }} />
      </h2>
      <div style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
        {/* 내 화면 (video + canvas) */}
        <div style={{ flex: 1, backgroundColor: '#111', position: 'relative' }}>
          <h2>내 화면 <video ref={myVideoRef} autoPlay muted playsInline style={{ width: '1px', height: '1px', opacity: 0, pointerEvents: 'none'}} /> </h2>
          <canvas ref={myCanvasRef} width={640} height={480} style={{ width: '100%', height: 'auto' }} />
        </div>
        <div style={{ marginTop: 10 }}>
          <>
            gaze {gaze[0].toFixed(2)}, {gaze[1].toFixed(2)} / blink {blink ? '🙈' : '👀'}
          </>
        </div>

        {/* 상대 화면 (video + canvas) */}
        <div style={{ flex: 1, backgroundColor: '#222', position: 'relative' }}>
          <h2>상대 화면 <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '1px', height: '1px', opacity: 0, pointerEvents: 'none'}} /> </h2>
          <canvas ref={remoteCanvasRef} width={640} height={480} style={{ width: '100%', height: 'auto' }} />
        </div>
      </div>
    </div>
  );

  async function handleSocketEvent(event: string, payload: any) {
    if (event.startsWith('room:')) {
      handleRoomEvent(event, payload);
    } else if (event.startsWith('c2c:')) {
      await handleC2CEvent(event, payload);
    } else if (event.startsWith('c2s:')) {
      await handleC2SEvent(event, payload);
    } else if (event.startsWith('gs:')) {
      await handleGSEvent(event, payload);
    } else {
      console.warn(`[⚠️ Unhandled Event] ${event}`);
    }
  }
  
  function handleRoomEvent(event: string, _payload: any) {
    switch (event) {
      case SOCKET_EVENTS.ROOM_JOIN:
        break;
      case SOCKET_EVENTS.ROOM_PING:
        console.log('ping 수신, pong 송신');
        socket.emit(SOCKET_EVENTS.ROOM_PONG, Date.now() / 1000);
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
        //console.log('🌐 client to cleintWebRTC 연결 생성됨');
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
      break; 
    }
    case SOCKET_EVENTS.C2C_CALLEE: {
      const { peerId } = payload as { peerId: string };
      console.log(`🎧 당신은 callee, 당신의 peer는 ${peerId}`);
      // 아무 것도 하지 않고 offer 기다림
      break; 
    }
    case SOCKET_EVENTS.C2C_OFFER: {
      const { offer } = payload as { offer: RTCSessionDescriptionInit };
      console.log('📨 offer 수신');
      if (pcPeer.current) {
        await pcPeer.current.setRemoteDescription(offer);
        const answer = await pcPeer.current.createAnswer();
        await pcPeer.current.setLocalDescription(answer);
        console.log('📤 answer 전송');
        socket.emit(SOCKET_EVENTS.C2C_ANSWER, { answer });

        for (const candidateInit of iceQueuePeer) {
            await pcPeer.current.addIceCandidate(candidateInit);
        }
        iceQueuePeer.length = 0;
      }
      break; 
    }
    case SOCKET_EVENTS.C2C_ANSWER: {
      const { answer } = payload as { answer: RTCSessionDescriptionInit };
      console.log('📨 answer 수신');
      await pcPeer.current?.setRemoteDescription(answer);

      for (const candidateInit of iceQueuePeer) {
        await pcPeer.current?.addIceCandidate(candidateInit);
      }
      iceQueuePeer.length = 0;
      break; 
    }
    case SOCKET_EVENTS.C2C_ICE_CANDIDATE: {
      const { candidateInit } = payload as { candidateInit: RTCIceCandidateInit };
      console.log('❄️ ICE 후보 수신');
      if (pcPeer.current?.remoteDescription) {
        await pcPeer.current.addIceCandidate(candidateInit);
        console.log('❄️ ICE 후보 추가');
      } else {
        iceQueuePeer.push(candidateInit);
        console.log('❄️ ICE 후보 큐에 저장');
      }
      break; 
    }
    default:
      console.warn(`[⚠️ Unhandled C2C Event] ${event}`);
      break;
    }
  }

  // 기능 미정
  async function handleC2SEvent(event: string, payload: any) {
    switch(event) {
      case SOCKET_EVENTS.C2S_OFFER:
        // 해당사항 없음
        break;
      case SOCKET_EVENTS.C2S_ANSWER: {
        const { answer } = payload as { answer: RTCSessionDescriptionInit };
        console.log('📨 c2s answer 수신');
        await pcServer.current?.setRemoteDescription(answer);

        for (const candidateInit of iceQueueServer) {
          await pcServer.current?.addIceCandidate(candidateInit);
        }
        iceQueueServer.length = 0;
        break;
      }
      case SOCKET_EVENTS.C2S_ICE_CANDIDATE: {
        const { candidateInit } = payload as { candidateInit: RTCIceCandidateInit };
        console.log('❄️ c2s ICE 후보 수신');
        if (pcServer.current?.remoteDescription) {
          await pcServer.current.addIceCandidate(candidateInit);
          console.log('❄️ c2s ICE 후보 추가');
        } else {
          iceQueueServer.push(candidateInit);
          console.log('❄️ c2s ICE 후보 큐에 저장');
        }
        break; 
      }
      default:
        console.warn(`[⚠️ Unhandled C2S Event] ${event}`);
        break;
    }
  }

  function handleGSEvent(event: string, payload: any) {
    switch (event) {
      case SOCKET_EVENTS.GS_GAZE: {
        const { gaze, blink } = payload as {
          gaze: { x: number; y: number };
          blink: boolean;
        };
        console.log(gaze.x, gaze.y, blink)
        setGaze([gaze.x, gaze.y]);
        setBlink(blink);
      }
    }
  }
}

export default GamePage;
