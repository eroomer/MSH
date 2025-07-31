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
      ctx.save();
      
      if (effects.flip) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      const rotateDeg = effects.rotate ?? 0;
      const angle = (rotateDeg * Math.PI) / 180;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(angle);

      ctx.drawImage(video, -canvas.width/2, -canvas.height/2, canvas.width, canvas.height);

      ctx.restore();
    }
    requestAnimationFrame(loop);
  };

  loop();
}
  