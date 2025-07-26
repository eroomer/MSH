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
  