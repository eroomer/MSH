export const SOCKET_EVENTS = {
    ROOM_JOIN: 'room:join',
    ROOM_FULL: 'room:full',
    ROOM_PEER_LEFT: 'room:peerleft',
    ROOM_PING: 'room:ping',
    ROOM_PONG: 'room:pong',

    C2C_CALLER: 'c2c:caller',
    C2C_CALLEE: 'c2c:callee',
    C2C_OFFER: 'c2c:offer',
    C2C_ANSWER: 'c2c:answer',
    C2C_ICE_CANDIDATE: 'c2c:ice-candidate',

    C2S_OFFER: 'c2s:offer',
    C2S_ANSWER: 'c2s:answer',
    C2S_ICE_CANDIDATE: 'c2s:ice-candidate',

    GS_GAZE: 'gs:gaze',
    // ... 필요에 따라 추가
  } as const;