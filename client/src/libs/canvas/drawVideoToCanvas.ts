export function drawVideoToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  
    const loop = () => {
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      requestAnimationFrame(loop);
    };
  
    loop();
}

type VideoEffectState = {
  flip?: boolean;
  rotate?: number; // degree, 0 ~ 360까지
  lens?: boolean;
  // ...더 추가 가능
};

export function drawRemoteVideoToCanvas(
  video: HTMLVideoElement, 
  canvas: HTMLCanvasElement, 
  getEffectState: () => VideoEffectState
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const loop = () => {
    if (video.readyState >= 2) {
      const effects = getEffectState();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      // 기본 회전 + 반전
      const rotateDeg = effects.rotate ?? 0;
      const angle = (rotateDeg * Math.PI) / 180;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(angle);
      if (effects.flip) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      // 전체 영상 먼저 그림
      ctx.drawImage(video, -canvas.width/2, -canvas.height/2, canvas.width, canvas.height);

      ctx.restore();

      // 💡 볼록렌즈 효과 (중앙 확대 클리핑)
      if (effects.lens) {
        const zoomSize = 200;   // 확대될 원의 지름
        const scale = 1.6;      // 확대 비율
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, zoomSize / 2, 0, 2 * Math.PI);
        ctx.clip(); // 중앙 원형 클리핑
        ctx.translate(
          centerX - (zoomSize * scale) / 2,
          centerY - (zoomSize * scale) / 2
        );
        ctx.scale(scale, scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
    requestAnimationFrame(loop);
  };

  loop();
}
  