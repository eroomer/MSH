# gpu_server.py  ───────────────────────────────────────────────────────
#   GPU mock server with live gaze / blink override via stdin
#   의존:  pip install aiohttp aiortc websockets aioconsole
# ---------------------------------------------------------------------
import asyncio, json, time, aioconsole, websockets
from aiohttp import web
from aiortc import (
    RTCPeerConnection, RTCSessionDescription, RTCConfiguration,
    VideoStreamTrack, RTCIceServer, RTCIceCandidate
)

# ────── settings ─────────────────────────────────────────────────────
STUN_URL      = "stun:stun.l.google.com:19302"
HTTP_PORT     = 5000                     # /connect, /ice-candidate
HUB_WS_URL    = "ws://localhost:3001"    # Hub WS (포트 3001 분리)

# ────── globals ──────────────────────────────────────────────────────
stun_cfg  = RTCConfiguration(iceServers=[RTCIceServer(urls=STUN_URL)])
pcs: dict[str, RTCPeerConnection] = {}         # socketId → pc
iceQueue: dict[str, list[dict]] = {}           # 클라이언트와의 ICE 후보 저장
hub        = None                              # websockets connection
override   = {"x": 0.5, "y": 0.0, "blink": False}

# ────── helpers ──────────────────────────────────────────────────────
async def send_result(sid: str, fid: int):
    """매 프레임 gaze/blink 결과를 Hub로 push"""
    global hub
    if not hub:
        return                                # 아직 Hub에 안 붙었으면 skip
    payload = {
        "socketId":  sid,
        "frameId":   fid,
        "timestamp": int(time.time() * 1000),
        "gaze":      {"x": override["x"], "y": override["y"]},
        "blink":     override["blink"],
    }
    try:
        await hub.send(json.dumps(payload))
    except Exception as err:
        # 연결이 닫혔거나 일시 오류 → 로그만 찍고 다음 프레임에서 재시도
        print("send_result err:", err)

class Receiver(VideoStreamTrack):
    """클라이언트 비디오를 그대로 패스하면서 결과 전송"""
    def __init__(self, src: VideoStreamTrack, sid: str):
        super().__init__()
        self.src, self.sid, self.fid = src, sid, 0
    async def recv(self):
        frame = await self.src.recv()
        self.fid += 1
        asyncio.create_task(send_result(self.sid, self.fid))
        return frame

# ────── HTTP handlers ────────────────────────────────────────────────
async def http_connect(request):
    body = await request.json()
    sid, sdp, typ = body["socketId"], body["sdp"], body["type"]

    pc = RTCPeerConnection(configuration=stun_cfg)
    pcs[sid] = pc

    @pc.on("track")
    def on_track(track):
        if track.kind == "video":
            print(f"🎥 video track from {sid}")
            pc.addTrack(Receiver(track, sid))

    await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp, type=typ))
    for candidate in iceQueue.pop(sid, []):
        await pc.addIceCandidate(candidate)

    await pc.setLocalDescription(await pc.createAnswer())
    return web.json_response({
        "sdp":  pc.localDescription.sdp,
        "type": pc.localDescription.type
    })

async def http_ice(request):
    body = await request.json()
    sid, ice = body["socketId"], body["candidate"]
    # candidate 파싱
    candidate_str = ice["candidate"]
    fields = candidate_str.split()

    candidate = RTCIceCandidate(
        foundation=fields[0].split(":")[1],
        component=int(fields[1]),
        protocol=fields[2].lower(),
        priority=int(fields[3]),
        ip=fields[4],
        port=int(fields[5]),
        type=fields[7],
        sdpMid=ice.get("sdpMid"),
        sdpMLineIndex=ice.get("sdpMLineIndex")
    )

    pc = pcs.get(sid)
    if pc and pc.remoteDescription is not None:
        await pc.addIceCandidate(candidate)
    else:
        if sid not in iceQueue:
            iceQueue[sid] = []
        iceQueue[sid].append(candidate)
    return web.Response(text="ok")

async def http_disconnect(request):
    body = await request.json()
    sid = body["socketId"]
    
    # pcs에서 제거
    pc = pcs.pop(sid, None)
    # 관련 리소스 제거
    if pc:
        for sender in pc.getSenders():
            track = sender.track
            if track:
                track.stop()
        if pc.connectionState != "closed":
            await pc.close()
    # ICE 후보 큐 제거
    iceQueue.pop(sid, None)
    print(f"🎥 socket disconnected, 리소스 제거 {sid}")

    return web.Response(text="disconnected")

# ────── background tasks ─────────────────────────────────────────────
async def hub_ws_loop():
    global hub
    while True:
        try:
            print("🔄 connecting WS → Hub …")
            hub = await websockets.connect(HUB_WS_URL)
            print("✅ WS connected")
            await hub.wait_closed()
            print("⚠️ WS closed, reconnecting …")
        except Exception as e:
            print("❌ WS error:", e)
        await asyncio.sleep(3)

async def stdin_loop():
    """터미널에서  <x y>  |  b/blink  |  빈줄 로 override 변경"""
    global override
    while True:
        line = (await aioconsole.ainput("gaze> ")).strip()
        if not line:
            print("current:", override); continue
        if line.lower() in ("b", "blink"):
            override["blink"] = not override["blink"]
            print("blink →", override["blink"]); continue
        try:
            x, y = map(float, line.split())
            override["x"], override["y"] = x, y
            print("gaze →", x, y)
        except ValueError:
            print("format:  <x(float)> <y(float)>  |  b")

# ────── main ─────────────────────────────────────────────────────────
async def main():
    app = web.Application()
    app.router.add_post("/connect",       http_connect)
    app.router.add_post("/disconnect",    http_disconnect)
    app.router.add_post("/ice-candidate", http_ice)

    runner = web.AppRunner(app); await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", HTTP_PORT).start()
    print(f"🚀 GPU HTTP on :{HTTP_PORT}")

    asyncio.create_task(hub_ws_loop())
    asyncio.create_task(stdin_loop())

    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
