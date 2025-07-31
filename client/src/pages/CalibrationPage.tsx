import { useEffect, useRef, useState} from 'react';
import type { CSSProperties } from 'react';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { socket } from '../libs/socket';           // 소켓 전역 변수
import { createGPUConnection } from '../libs/webrtc';
import { SOCKET_EVENTS } from '../../../shared/socketEvents';

type Point = { x: number; y: number };
// 0,0 좌상단, 1,1 우하단
const calibrationPoints: Point[] = [
    { x: 0.05, y: 0.05 }, { x: 0.50, y: 0.05 }, { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.50 }, { x: 0.50, y: 0.50 }, { x: 0.05, y: 0.50 },
    { x: 0.05, y: 0.95 }, { x: 0.50, y: 0.95 }, { x: 0.95, y: 0.95 },
    { x: 0.50, y: -0.05 },
];

export default function CalibrationPage() {
  const navigate = useNavigate();
  const { username } = useUser();
  const [index, setIndex] = useState(-1); // 캘리브레이션 단계, -1이면 시작 전
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [timeLeft, setTimeLeft] = useState(5); // 타이머 상태
  const iceQueueGPU : RTCIceCandidateInit[] = [];             // GPU와의 ICE 후보 저장

  const pcGPU = useRef<RTCPeerConnection | null>(null);     // GPU와의 WebRTC 연결 객체
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement>(null);     // 시선 추적 로직에 사용할 ROI 캔버스
  const calibrationAreaRef = useRef<HTMLDivElement>(null);
  
  // 🔌 웹소켓 연결
  useEffect(() => {
    socket.on('connect', () => {
      console.log(`[${socket.id}] ✅ WebSocket 연결됨`);
      socket.emit(SOCKET_EVENTS.CALI_JOIN, { username });
    });
    socket.on(SOCKET_EVENTS.CALI_WELCOME, async () => {
        console.log(`[${socket.id}] 📨 CALI_WELCOME 수신`);
        if (myVideoRef.current && roiCanvasRef.current) {
            // 비디오 요소가 준비될 때까지 기다립니다.
            await new Promise<void>(resolve => {
                if (myVideoRef.current!.readyState >= 2) { // HAVE_CURRENT_DATA 이상
                    resolve();
                } else {
                    myVideoRef.current!.onloadedmetadata = () => resolve();
                }
            });
            pcGPU.current = await createGPUConnection(
                myVideoRef.current!, roiCanvasRef.current!, 
            ); // GPU와의 peerConnection 만들면서 offer도 전송하는 함수
        } else {
            console.error('CALI_WELCOME 수신 시 myVideoRef.current 또는 roiCanvasRef.current가 null입니다.');
        }
    });
    socket.on(SOCKET_EVENTS.C2G_ANSWER, async ({ sdp, type }: RTCSessionDescriptionInit) => {
        console.log(`[${socket.id}] 📨 C2G_ANSWER 수신`);
      
        await pcGPU.current?.setRemoteDescription({ sdp, type });
      
        for (const candidateInit of iceQueueGPU) {
          await pcGPU.current?.addIceCandidate(candidateInit);
        }
        iceQueueGPU.length = 0;
    });
    socket.on(SOCKET_EVENTS.C2G_ICE_CANDIDATE, async ({ candidateInit }: { candidateInit: RTCIceCandidateInit }) => {
        console.log(`[${socket.id}] ❄️ cient to gpu ICE 후보 수신`);
        if (pcGPU.current?.remoteDescription) {
          await pcGPU.current.addIceCandidate(candidateInit);
          console.log(`[${socket.id}] ❄️ cient to gpu ICE 후보 추가`);
        } else {
          iceQueueGPU.push(candidateInit);
          console.log(`[${socket.id}] ❄️ cient to gpu ICE 후보 저장`);
        }
    });
    socket.on(SOCKET_EVENTS.GS_GAZE, async ({ gaze, blink }: {gaze: { x: number; y: number }, blink: boolean;}) => {
      console.log(gaze.x, gaze.y, blink)
    });
    socket.on('disconnect', async () => {
      console.log(`[${socket.id}]❌ WebSocket 연결 종료`);
      if (pcGPU.current) {
        pcGPU.current.getSenders().forEach((sender) => {
          sender.track?.stop(); // 트랙 정리
        });
        pcGPU.current.close(); // WebRTC 연결 종료
        pcGPU.current = null;  // 참조 제거
      }
    });
    const startMedia = async () => {
        console.log('Attempting to start media stream...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // 비디오/오디오 모두 포함된 full stream
            console.log('Media stream obtained:', stream);
            if (myVideoRef.current) {
                myVideoRef.current.srcObject = stream;  // 비디오 stream만 저장
                console.log('Video stream assigned to myVideoRef.current');
            } else {
                console.log('myVideoRef.current is null when assigning stream.');
            }
            socket.connect();
            console.log('Socket connected after media stream attempt.');
        } catch (err) {
            console.error('Media error:', err);
            console.log('Failed to get media stream. Check camera permissions.');
        }
    };
    startMedia();

    return () => {
      socket.disconnect();
      socket.removeAllListeners();
    };
  }, [username]);

  useEffect(() => {
    if (index === -1) return; // 캘리브레이션 시작 전에는 아무것도 하지 않음

    if (index >= calibrationPoints.length) {
      // 캘리브레이션 완료
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      navigate('/lobby');
      return;
    }

    // 현재 점 설정 및 타이머 시작
    setCurrentPoint(calibrationPoints[index]);
    setTimeLeft(5); // 타이머 초기화

    const countdownTimer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(countdownTimer);
          setIndex(index + 1); // 다음 점으로 이동
          return 0; // 타이머가 0이 되면 멈춤
        }
        return prevTime - 1;
      });
    }, 1000); // 1초마다 실행

    return () => {
      clearInterval(countdownTimer); // 컴포넌트 언마운트 시 타이머 정리
    };
  }, [index, navigate]);

  // index가 변경될 때마다 타이머를 다시 설정하기 위한 useEffect
  useEffect(() => {
    if (index !== -1 && index < calibrationPoints.length) {
      setTimeLeft(5); // 새 점이 나타나면 타이머를 5초로 리셋
    }
  }, [index]);

  // 캘리브레이션 시작 버튼
  const startCalibration = () => {
    socket.emit(SOCKET_EVENTS.CALI_START, { username });
    setIndex(0); // 캘리브레이션 시작
  };

  useEffect(() => {
    if (index === 0) { // 전체화면 진입 조건
      document.documentElement.requestFullscreen().catch(err => {
        console.error('전체화면 실패:', err);
      });
    }
  }, [index]);

  const videoStyle: CSSProperties = index === -1 ? 
    { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '50%', height: '50%', maxWidth: '960px' } : 
    { 
      position: 'absolute', 
      top: '50%', 
      left: '50%', 
      transform: 'translate(-50%, -50%)', 
      width: '30%', 
      height: 'auto', 
      zIndex: 1, 
      border: '1px solid gray' 
    };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#111' }}>
      <video ref={myVideoRef} autoPlay muted playsInline style={videoStyle} />
      <canvas ref={roiCanvasRef} width={256} height={256} style={{ display: 'none' }} />

      {index === -1 && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', textAlign: 'center' }}>
          <h1>시선 캘리브레이션</h1>
          <p>캘리브레이션으로 시선 추적을 보정합니다.</p>
          <p>{username}님, 시작하기를 누르고 점을 따라 시선을 움직여 주세요.</p>
          <button onClick={startCalibration} style={{ fontSize: '1.2rem', padding: '12px 20px', marginTop: '20px' }}>
            시작하기
          </button>
        </div>
      )}

      {index !== -1 && (
        <div
          ref={calibrationAreaRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden', // 윤곽선 밖으로 나가는 것을 방지
            backgroundColor: '#111', // Ensure background is dark
          }}
        >
          {/* 16:9 비율의 윤곽선 */}
          <div
            style={{
              position: 'relative',
              height: '100%', // 부모 요소에 맞춰 비율 유지
              aspectRatio: '16 / 9',
              border: '2px solid white',
              boxSizing: 'border-box',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {currentPoint && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${currentPoint.x * 100}%`,
                    top: `${currentPoint.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '20px',
                    height: '20px',
                    zIndex: 1,
                    backgroundColor: 'cyan',
                    borderRadius: '50%',
                  }}
                />
                {/* 타이머 표시 */}
                <div style={{
                  position: 'absolute',
                  left: `${currentPoint.x * 100}%`,
                  top: `${currentPoint.y * 100}%`,
                  transform: 'translate(-50%, -50%)', // 점 위로 50px 오프셋
                  zIndex: 2,
                  color: 'black',
                  fontSize: '0.5rem',
                }}>
                  {timeLeft}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
