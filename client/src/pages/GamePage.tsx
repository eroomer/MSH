import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../libs/socket';                // 소켓 전역 변수
import { createPeerConnection } from '../libs/webrtc';  // WebRTC 연결 객체 생성
import { drawVideoToCanvas } from '../libs/canvas/drawVideoToCanvas'; // Video -> Canvas 복사 함수
//import { io } from 'socket.io-client';
//const socket = io('http://localhost:3000'); // 서버 주소

function GamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null); // WebRTC 연결 객체
  const myStreamRef = useRef<MediaStream | null>(null);             // 내 캠/마이크 스트림 저장
  const iceQueue: RTCIceCandidateInit[] = [];                       // ICE 후보 저장

  const myVideoRef = useRef<HTMLVideoElement>(null);        // 내 비디오 스트림 
  const myCanvasRef = useRef<HTMLCanvasElement>(null);      // 내 비디오 스트림을 복사본 + 효과 적용한 실제 표시 화면

  const remoteVideoRef = useRef<HTMLVideoElement>(null);    // 상대방 비디오 스트림
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);  // 상대방 비디오 스트림을 복사본 + 효과 적용한 실제 표시 화면

  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('🎥 내 스트림 획득됨:', stream);
        myStreamRef.current = stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
        }

        console.log('🔌 소켓 연결됨, 방 입장 요청:', roomId);
        socket.connect();
        socket.emit('join', roomId);

        peerConnectionRef.current = createPeerConnection(
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
    
    socket.on('you-are-caller', async (peerId: string) => {
        console.log(`📡 당신은 caller, 당신의 peer는 ${peerId}`);
        if (peerConnectionRef.current) {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          console.log('📤 offer 전송:', offer);
          socket.emit('offer', offer);
        }
    });
  
    socket.on('you-are-callee', (peerId: string) => {
        console.log(`🎧 당신은 callee, 당신의 peer는 ${peerId}`);
        // 아무 것도 하지 않고 offer 기다림
    });

    socket.on('room-full', () => {
        console.warn('🚫 방이 가득 찼습니다. 홈으로 이동합니다.');
        alert('방이 가득 찼습니다.');
        navigate('/');
    });

    socket.on('offer', async (offer: RTCSessionDescriptionInit) => {
      console.log('📨 offer 수신:', offer);
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        console.log('📤 answer 전송:', answer);
        socket.emit('answer', answer);

        for (const candidate of iceQueue) {
            await peerConnectionRef.current.addIceCandidate(candidate);
        }
        iceQueue.length = 0;
      }
    });

    socket.on('answer', async (answer: RTCSessionDescriptionInit) => {
      console.log('📨 answer 수신:', answer);
      await peerConnectionRef.current?.setRemoteDescription(answer);

      for (const candidate of iceQueue) {
        await peerConnectionRef.current?.addIceCandidate(candidate);
      }
      iceQueue.length = 0;
    });

    socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      console.log('❄️ ICE 후보 수신:', candidate);
      if (peerConnectionRef.current?.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(candidate);
        console.log('❄️ ICE 후보 추가:', candidate);
      } else {
        iceQueue.push(candidate);
        console.log('❄️ ICE 후보 큐에 저장:', candidate);
      }
    });

    socket.on('peer-left', () => {
        console.log('👋 상대방 연결 종료됨');
        peerConnectionRef.current?.close();
        peerConnectionRef.current = createPeerConnection(
            myStreamRef.current!,
            (remoteStream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            }
        );
        console.log('🌐 WebRTC 연결 생성됨');
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
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
}

export default GamePage;
