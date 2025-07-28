import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { setupGpuWebSocket } from './gpuSocket';
import { SOCKET_EVENTS } from '../../shared/socketEvents';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

// @ts-ignore
import { RTCPeerConnection, RTCIceCandidate} from '@koush/wrtc';

// 세션 관리
export const sessions = new Map();

const PORT     = process.env.PORT || 3000;
const GPU_HTTP = 'http://localhost:5000';
const STUN     = [{ urls:'stun:stun.l.google.com:19302' }];
dotenv.config(); // .env 파일을 로드함

// express 앱과 http 서버 생성
const app = express();
app.use(cors());
const server = http.createServer(app);

// socket.io 서버 생성
const io = new SocketIOServer(server, {
  cors: {
    origin: '*', // 개발 중엔 모두 허용. 배포 시 도메인 제한 권장
    methods: ['GET', 'POST'],
  },
});
// 서버 시작
server.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});

// GPU WebSocket 연결 초기화
setupGpuWebSocket(io); // gpuSocket.ts 파일로 분리

// 오프셋 측정 함수
const measureOffset = (sock: Socket): Promise<number> => {
    return new Promise((resolve) => {
        const T0 = Date.now() / 1000;
        sock.emit(SOCKET_EVENTS.ROOM_PING, T0);
        sock.once(SOCKET_EVENTS.ROOM_PONG, (T1: number) => {
        const T2 = Date.now() / 1000;
        const offset = ((T1 - T0) + (T1 - T2)) / 2;
        resolve(offset);
        });
    });
};

// socket.io signaling 처리
io.on('connection', async (socket) => {
    console.log('✅ 새 클라이언트 연결:', socket.id);

    // 👉 먼저 빈 세션 등록
    sessions.set(socket.id, {});
    const state = sessions.get(socket.id);

    socket.onAny(async (event, payload) => {
        await handleSocketEvent(socket, event, payload);
    });

    // time offset 측정 및 저장
    const offset = await measureOffset(socket);
    state.offset = offset;
    console.log('ping-pong complete:', offset);

    socket.on('disconnect', () => {
        console.log(`❌ 연결 종료: ${socket.id}`);
        const state = sessions.get(socket.id);
        // state?.pcClient?.close(); // 라이브러리 버그로 인해 서버가 멈추므로 주석 처리
        // state?.pcGpu?.close();    // 라이브러리 버그로 인해 서버가 멈추므로 주석 처리
        state.pcClient = null;
        state.pcGpu = null;
        sessions.delete(socket.id); // 가비지 컬렉터가 정리해주길 기도합시다
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit(SOCKET_EVENTS.ROOM_PEER_LEFT);
            console.log(`👋 방 ${roomId}에 퇴장 알림`);
        }
    });
});

async function handleSocketEvent(socket: Socket, event: string, payload: any) {
    if (event.startsWith('room:')) {
        handleRoomEvent(socket, event, payload);
    } else if (event.startsWith('c2c:')) {
        handleC2CEvent(socket, event, payload);
    } else if (event.startsWith('c2s:')) {
        await handleC2SEvent(socket, event, payload);
    } else {
        console.warn(`[⚠️ Unhandled Event] ${event}`);
    }
};

function handleRoomEvent(socket: Socket, event: string, payload: any) {
    switch (event) {
        case SOCKET_EVENTS.ROOM_JOIN: {
            const { roomId } = payload as { roomId: string };
            const room = socket.nsp.adapter.rooms.get(roomId);
            const numClients = room ? room.size : 0;
    
            console.log(`📥 ${socket.id} → 방 ${roomId} 참가 시도 (현재 인원 ${numClients})`);
    
            if (numClients >= 2) {
                console.log(`🚫 방 ${roomId} 가득참`);
                socket.emit(SOCKET_EVENTS.ROOM_FULL);
                return;
            }
    
            socket.join(roomId);
            socket.data.roomId = roomId;
            console.log(`🔗 ${socket.id} → 방 ${roomId} 입장`);
    
            const updatedRoom = socket.nsp.adapter.rooms.get(roomId);
            const socketsInRoom = [...(updatedRoom || [])];
        
            if (socketsInRoom.length === 2) {
                const [socketId1, socketId2] = socketsInRoom;
            
                // 한쪽은 caller, 한쪽은 callee 지정
                socket.nsp.to(socketId1).emit(SOCKET_EVENTS.C2C_CALLER, { socketId2 });
                socket.nsp.to(socketId2).emit(SOCKET_EVENTS.C2C_CALLEE, { socketId1 });
                console.log(`🎭 역할 분배 완료: ${socketId1} → caller, ${socketId2} → callee`);
            }
            break;
        }
        case SOCKET_EVENTS.ROOM_FULL:
            // 서버는 할 거 없음.
            break;
        case SOCKET_EVENTS.ROOM_PEER_LEFT:
            // 서버는 할 거 없음.
            break;
    }
}

function handleC2CEvent(socket: Socket, event: string, payload: any) {
    // broadcasting
    const roomId = socket.data.roomId;
    switch (event) {
        case SOCKET_EVENTS.C2C_OFFER: {
            const { offer } = payload as { offer: RTCSessionDescriptionInit };
            if (roomId) {
                socket.to(roomId).emit(SOCKET_EVENTS.C2C_OFFER, { offer });
                console.log('📡 c2c_offer 브로드캐스트');
            }
            break;
        }
        case SOCKET_EVENTS.C2C_ANSWER: {
            const { answer } = payload as { answer: RTCSessionDescriptionInit };
            if (roomId) {
                socket.to(roomId).emit(SOCKET_EVENTS.C2C_ANSWER, { answer });
                console.log('📡 c2c_answer 브로드캐스트');
            }
            break;
        }
        case SOCKET_EVENTS.C2C_ICE_CANDIDATE: {
            const { candidateInit } = payload as { candidateInit: RTCIceCandidateInit };
            console.log('❄️ c2c_ice-candidate 브로드캐스트');
            if (roomId) {
                socket.to(roomId).emit(SOCKET_EVENTS.C2C_ICE_CANDIDATE, { candidateInit });
            }
            break;
        }
    }
}

async function handleC2SEvent(socket: Socket, event: string, payload: any) {
    switch (event) {
        case SOCKET_EVENTS.C2S_OFFER: {
            console.log('📤 client to server offer 수신');
            const { offer } = payload as { offer: RTCSessionDescriptionInit };

            const state = sessions.get(socket.id);
            if (!state) {
                console.warn(`⚠️ 세션 정보 없음: ${socket.id}`);
                return;
            }

            if (state.pcClient) {
                console.warn(`⚠️ 이미 pcClient가 존재함: ${socket.id}`);
                state.pcClient.close(); // 기존 연결이 있다면 닫음
            }

            state.pcClient = new RTCPeerConnection({ iceServers: STUN });
            state.pcClientId = Date.now(); // 고유 ID로 타임스탬프 사용
            const connectionId = state.pcClientId;
            console.log(`pcClient 생성 [ID: ${connectionId}]`);

            state.pcClient.ontrack = async (event: RTCTrackEvent) => {
                try {
                    console.log(`pcClient 트랙 수신 [ID: ${connectionId}]`);
                    const { track, streams } = event;
                    if (!state.pcGpu) {
                        await createGpuPeer(state, socket.id, track, streams[0]);
                        console.log(`gpuPeer 생성됨 [ID: ${connectionId}]`);
                    }
                } catch (error) {
                    console.error(`[💥 ontrack Error] gpuPeer 생성 중 오류 발생 [ID: ${connectionId}]:`, error);
                }
            };

            state.pcClient.onconnectionstatechange = () => {
                const conn = state.pcClient.connectionState;
                console.log(`📶 C2S WebRTC 연결 상태 변경 [ID: ${connectionId}]: ${conn}`);
                if (conn === 'connected') {
                console.log(`✅ C2S WebRTC 연결 완료 [ID: ${connectionId}] (P2P 연결 성공)`);
                }
            }

            state.pcClient.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
                if (event.candidate) {
                  const candidate = event.candidate;
                  const candidateInit = {
                    candidate: candidate.candidate,
                    sdpMid: candidate.sdpMid,
                    sdpMLineIndex: candidate.sdpMLineIndex,
                    usernameFragment: candidate.usernameFragment,
                  };
                  console.log('📤 client to server ICE 후보 전송');
                  socket.emit(SOCKET_EVENTS.C2S_ICE_CANDIDATE, { candidateInit });
                }
            };
        
            await state.pcClient.setRemoteDescription(offer);
            await state.pcClient.setLocalDescription(await state.pcClient.createAnswer());
            const answer = state.pcClient.localDescription;
            socket.emit(SOCKET_EVENTS.C2S_ANSWER, { answer });
            console.log('📤 client to server answer 송신');
            break;
        }
        case SOCKET_EVENTS.C2S_ANSWER: {
            // 받을 일 없음, 할 거 없음
            break;
        }
        case SOCKET_EVENTS.C2S_ICE_CANDIDATE: {
            console.log('📤 client to server ICE 후보 수신');
            const { candidateInit } = payload as { candidateInit: RTCIceCandidateInit };
            const state = sessions.get(socket.id);
            if (state && state.pcClient) {
                try {
                    await state.pcClient.addIceCandidate(new RTCIceCandidate(candidateInit));
                } catch (err) {
                    console.warn('ICE 후보 추가 실패:', err);
                }
            }
            break;
        }
    }
}

interface GpuState {
    pcGpu: RTCPeerConnection | null;
    offset: number;
}

async function createGpuPeer(
    state: GpuState,
    clientId: string,
    track: MediaStreamTrack,
    stream: MediaStream
  ): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: STUN });
    state.pcGpu = pc;
    
    pc.addTrack(track, stream);
  
    pc.onicecandidate = ({ candidate }: RTCPeerConnectionIceEvent) =>
        candidate && fetch(`${GPU_HTTP}/ice-candidate`, {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ clientId, candidate })
        });
  
    await pc.setLocalDescription(await pc.createOffer());
  
    const res = await fetch(`${GPU_HTTP}/connect`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({
        clientId,
        offset: state.offset,
        sdp:    pc.localDescription?.sdp,
        type:   pc.localDescription?.type
      })
    });
    const { sdp, type } = await res.json();
    await pc.setRemoteDescription({ sdp, type });
  
    console.log('🔗 Hub-GPU peer ready');
    io.to(clientId).emit('ready');
  }
