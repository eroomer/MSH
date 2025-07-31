export const SOCKET_EVENTS = {
    ROOM_JOIN: 'room:join',
    ROOM_WELCOME: 'room:welcome',
    ROOM_FULL: 'room:full',
    ROOM_PEER_LEFT: 'room:peerleft',
    ROOM_PING: 'room:ping',
    ROOM_PONG: 'room:pong',

    CALI_JOIN: 'cali:join',
    CALI_WELCOME: 'cali:welcome',
    CALI_START: 'cali:start',

    C2C_CALLER: 'c2c:caller',
    C2C_CALLEE: 'c2c:callee',
    C2C_OFFER: 'c2c:offer',
    C2C_ANSWER: 'c2c:answer',
    C2C_ICE_CANDIDATE: 'c2c:ice-candidate',

    // C2S_OFFER: 'c2s:offer',
    // C2S_ANSWER: 'c2s:answer',
    // C2S_ICE_CANDIDATE: 'c2s:ice-candidate',  // 폐기!

    C2G_OFFER: 'c2g:offer',
    C2G_ANSWER: 'c2g:answer',
    C2G_ICE_CANDIDATE: 'c2g:ice-candidate',

    GS_GAZE: 'gs:gaze',

    STATE_CALI: 'st:cali',
    STATE_DEFAULT: 'st:default',
    STATE_READY: 'st:ready',
    STATE_GAME: 'st:game',
    STATE_WIN: 'st:win',
    STATE_LOSE: 'st:lose',

    SKILL_USED: 'skill:used',
    SKILL_RECEIVED: 'skill:received'
    // ... 필요에 따라 추가
  } as const;