<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import { browser } from '$app/environment';

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    life: number;
    maxLife: number;
    gradient?: CanvasGradient;
  }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  const particles: Particle[] = [];
  let animationFrame: number;
  let mounted = false;
  let enabled = false;

  const mouse = { 'x': -9999, 'y': -9999 };

  const PARTICLE_COUNT = 56;
  const CONNECTION_DISTANCE = 120;
  const CONNECTION_DISTANCE_SQ = CONNECTION_DISTANCE ** 2;
  const MOUSE_INFLUENCE = 150;
  const MOUSE_INFLUENCE_SQ = MOUSE_INFLUENCE ** 2;

  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const createParticle = (): Particle => {
    const maxLife = rand(100, 300);
    return {
      'x': rand(0, canvas.width),
      'y': rand(0, canvas.height),
      'vx': rand(-0.25, 0.25),
      'vy': rand(-0.25, 0.25),
      'size': rand(1, 3),
      'opacity': rand(0.2, 1),
      'life': maxLife,
      maxLife,
    };
  };

  const resetParticle = (p: Particle) => Object.assign(p, createParticle());

  const updateParticle = (p: Particle) => {
    p.x += p.vx;
    p.y += p.vy;

    if (Math.abs(mouse.x - p.x) < MOUSE_INFLUENCE && Math.abs(mouse.y - p.y) < MOUSE_INFLUENCE) {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < MOUSE_INFLUENCE_SQ) {
        const distance = Math.sqrt(distSq);
        const force = ((MOUSE_INFLUENCE - distance) / MOUSE_INFLUENCE) * 0.01;
        const angle = Math.atan2(dy, dx);

        p.vx += Math.cos(angle) * force;
        p.vy += Math.sin(angle) * force;
      }
    }

    p.vx *= 0.99;
    p.vy *= 0.99;

    if (p.x < 0 || p.x > canvas.width) {
      p.vx *= -0.8;
      p.x = clamp(p.x, 0, canvas.width);
    }

    if (p.y < 0 || p.y > canvas.height) {
      p.vy *= -0.8;
      p.y = clamp(p.y, 0, canvas.height);
    }

    p.life--;
    p.opacity = (p.life / p.maxLife) * 0.8 + 0.2;

    if (p.life <= 0) resetParticle(p);
  };

  const drawParticle = (p: Particle) => {
    ctx.save();
    ctx.globalAlpha = p.opacity;

    if (p.gradient === undefined) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      g.addColorStop(0, 'rgba(34, 211, 238, 1)');
      g.addColorStop(0.5, 'rgba(59, 130, 246, 0.8)');
      g.addColorStop(1, 'rgba(147, 51, 234, 0.2)');
      p.gradient = g;
    }

    ctx.fillStyle = p.gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawConnections = () => {
    ctx.save();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.lineWidth = 1;

    const cellSize = CONNECTION_DISTANCE;
    const grid: Record<string, Particle[]> = {};

    for (const p of particles) {
      const gx = Math.floor(p.x / cellSize);
      const gy = Math.floor(p.y / cellSize);
      const key = `${gx},${gy}`;
      (grid[key] ??= []).push(p);
    }

    const neighborOffsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    const tryConnect = (p: Particle, q: Particle) => {
      if (p === q || p.x < q.x || (p.x === q.x && p.y < q.y)) return;

      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < CONNECTION_DISTANCE_SQ) {
        const distance = Math.sqrt(distSq);
        const opacity = ((CONNECTION_DISTANCE - distance) / CONNECTION_DISTANCE) * 0.3;

        if (opacity > 0.05) {
          ctx.globalAlpha = opacity * Math.min(p.opacity, q.opacity);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    };

    for (const key in grid) {
      const [gx, gy] = key.split(',').map(Number);
      const cellParticles = grid[key];

      for (const p of cellParticles) {
        for (const [ox, oy] of neighborOffsets) {
          const neighborKey = `${gx + ox},${gy + oy}`;
          const neighbors = grid[neighborKey];
          if (!neighbors) continue;

          for (const q of neighbors) tryConnect(p, q);
        }
      }
    }

    ctx.restore();
  };

  const animate = () => {
    if (mounted === false) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) updateParticle(p);
    drawConnections();
    for (const p of particles) drawParticle(p);

    animationFrame = requestAnimationFrame(animate);
  };

  const resizeCanvas = () => {
    if (!canvas || browser === false) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (particles.length < PARTICLE_COUNT) while (particles.length < PARTICLE_COUNT) particles.push(createParticle());
    else if (particles.length > PARTICLE_COUNT) particles.length = PARTICLE_COUNT;
  };

  const updateMouse = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = x - rect.left;
    mouse.y = y - rect.top;
  };

  const handleMouseMove = (e: MouseEvent) => updateMouse(e.clientX, e.clientY);

  onMount(() => {
    if (browser === false) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    enabled = prefersReducedMotion === false && hasFinePointer;
    if (enabled === false) return;

    mounted = true;
    ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);

    animate();
  });

  onDestroy(() => {
    if (browser === false) return;
    mounted = false;
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('mousemove', handleMouseMove);
  });
</script>

{#if browser}
  <canvas bind:this={canvas} class:hidden={!enabled} class="fixed inset-0 z-0 h-full w-full pointer-events-none"></canvas>
{/if}
