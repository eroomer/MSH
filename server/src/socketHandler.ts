import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../shared/socketEvents';

export function handleSocketEvent(socket: Socket, event: string, payload: any) {
    if (event.startsWith('room:')) {
        handleRoomEvent(socket, event, payload);
    } else if (event.startsWith('c2c:')) {
        handleC2CEvent(socket, event, payload);
    } else if (event.startsWith('c2s:')) {
        //handleC2SEvent(event, payload);
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
            const candidate = payload as RTCIceCandidateInit;
            console.log('❄️ c2c_ice-candidate 브로드캐스트', candidate);
            if (roomId) {
                socket.to(roomId).emit(SOCKET_EVENTS.C2C_ICE_CANDIDATE, candidate);
            }
            break;
        }
    }
}