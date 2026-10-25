import React, { useEffect, useRef } from 'react';

interface FallingLightAnimationProps {
  className?: string;
  density?: number;
  speedMultiplier?: number;
}

interface LightStreak {
  x: number;
  y: number;
  length: number;
  speed: number;
  width: number;
  opacity: number;
  hue: 'cyan' | 'purple' | 'blue' | 'white';
}

interface AmbientDust {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  driftX: number;
  opacity: number;
  angle: number;
}

export const FallingLightAnimation: React.FC<FallingLightAnimationProps> = ({
  className = '',
  density = 40,
  speedMultiplier = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize gentle falling light streaks
    const streaks: LightStreak[] = Array.from({ length: density }, () => {
      const hues: ('cyan' | 'purple' | 'blue' | 'white')[] = ['cyan', 'blue', 'cyan', 'purple', 'white'];
      return {
        x: Math.random() * width,
        y: Math.random() * height * 1.2 - height * 0.2,
        length: 20 + Math.random() * 45,
        speed: (0.9 + Math.random() * 1.8) * speedMultiplier,
        width: 1 + Math.random() * 1.2,
        opacity: 0.15 + Math.random() * 0.35,
        hue: hues[Math.floor(Math.random() * hues.length)],
      };
    });

    // Initialize subtle floating dust motes drifting downward
    const dustMotes: AmbientDust[] = Array.from({ length: 25 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.8 + Math.random() * 1.5,
      speedY: (0.3 + Math.random() * 0.7) * speedMultiplier,
      driftX: (Math.random() - 0.5) * 0.3,
      opacity: 0.1 + Math.random() * 0.25,
      angle: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle falling light streaks
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i];
        s.y += s.speed;

        // Reset when it goes past the bottom
        if (s.y - s.length > height) {
          s.y = -s.length - Math.random() * 40;
          s.x = Math.random() * width;
          s.speed = (0.9 + Math.random() * 1.8) * speedMultiplier;
        }

        let baseColor = '56, 189, 248'; // cyan
        if (s.hue === 'purple') baseColor = '168, 85, 247';
        else if (s.hue === 'blue') baseColor = '99, 102, 241';
        else if (s.hue === 'white') baseColor = '255, 255, 255';

        // Vertical gradient line
        const grad = ctx.createLinearGradient(s.x, s.y - s.length, s.x, s.y);
        grad.addColorStop(0, `rgba(${baseColor}, 0)`);
        grad.addColorStop(0.7, `rgba(${baseColor}, ${s.opacity * 0.5})`);
        grad.addColorStop(1, `rgba(${baseColor}, ${s.opacity})`);

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width;
        ctx.lineCap = 'round';
        ctx.moveTo(s.x, s.y - s.length);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Tiny glowing leading drop at the tip
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.width * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, s.opacity * 1.5)})`;
        ctx.shadowColor = `rgba(${baseColor}, 0.5)`;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0; // reset shadow
      }

      // Draw gentle drifting ambient dust motes
      for (let j = 0; j < dustMotes.length; j++) {
        const d = dustMotes[j];
        d.y += d.speedY;
        d.angle += 0.02;
        d.x += Math.sin(d.angle) * 0.35 + d.driftX;

        if (d.y > height) {
          d.y = -5;
          d.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186, 230, 253, ${d.opacity})`;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [density, speedMultiplier]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-0 ${className}`}
      aria-hidden="true"
    />
  );
};
