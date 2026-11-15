<script lang="ts">
  import { onMount } from 'svelte';

  import type { Particle } from '$lib/types/particle';

  let element: HTMLCanvasElement | undefined;
  let isEnabled = $state(false);

  const PARTICLE_COUNT = 56;
  const CONNECTION_DISTANCE = 120;
  const CONNECTION_DISTANCE_SQUARED = CONNECTION_DISTANCE ** 2;
  const MOUSE_INFLUENCE = 150;
  const MOUSE_INFLUENCE_SQUARED = MOUSE_INFLUENCE ** 2;
  const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
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

  const random = (min: number, max: number): number => Math.random() * (max - min) + min;
  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
  const cellKey = (cellX: number, cellY: number): string => `${cellX},${cellY}`;

  const start = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): (() => void) => {
    const particles: Particle[] = [];
    const mouse = { 'x': -9999, 'y': -9999 };
    let frame = 0;
    let isRunning = true;

    const spawn = (): Particle => {
      const maxLife = random(100, 300);
      return {
        'x': random(0, canvas.width),
        'y': random(0, canvas.height),
        'velocityX': random(-0.25, 0.25),
        'velocityY': random(-0.25, 0.25),
        'size': random(1, 3),
        'opacity': random(0.2, 1),
        'life': maxLife,
        maxLife,
      };
    };

    const attract = (particle: Particle): void => {
      const dx = mouse.x - particle.x;
      const dy = mouse.y - particle.y;
      if (Math.abs(dx) >= MOUSE_INFLUENCE || Math.abs(dy) >= MOUSE_INFLUENCE) return;

      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= MOUSE_INFLUENCE_SQUARED) return;

      const force = ((MOUSE_INFLUENCE - Math.sqrt(distanceSquared)) / MOUSE_INFLUENCE) * 0.01;
      const angle = Math.atan2(dy, dx);
      particle.velocityX += Math.cos(angle) * force;
      particle.velocityY += Math.sin(angle) * force;
    };

    const update = (particle: Particle): void => {
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      attract(particle);
      particle.velocityX *= 0.99;
      particle.velocityY *= 0.99;

      if (particle.x < 0 || particle.x > canvas.width) {
        particle.velocityX *= -0.8;
        particle.x = clamp(particle.x, 0, canvas.width);
      }

      if (particle.y < 0 || particle.y > canvas.height) {
        particle.velocityY *= -0.8;
        particle.y = clamp(particle.y, 0, canvas.height);
      }

      particle.life--;
      particle.opacity = (particle.life / particle.maxLife) * 0.8 + 0.2;
      if (particle.life <= 0) Object.assign(particle, spawn());
    };

    const createGradient = (particle: Particle): CanvasGradient => {
      const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 3);
      gradient.addColorStop(0, 'rgba(34, 211, 238, 1)');
      gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.8)');
      gradient.addColorStop(1, 'rgba(147, 51, 234, 0.2)');
      return gradient;
    };

    const draw = (particle: Particle): void => {
      particle.gradient ??= createGradient(particle);
      context.save();
      context.globalAlpha = particle.opacity;
      context.fillStyle = particle.gradient;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const connect = (particle: Particle, other: Particle): void => {
      if (particle === other || particle.x < other.x || (particle.x === other.x && particle.y < other.y)) return;

      const dx = particle.x - other.x;
      const dy = particle.y - other.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= CONNECTION_DISTANCE_SQUARED) return;

      const opacity = ((CONNECTION_DISTANCE - Math.sqrt(distanceSquared)) / CONNECTION_DISTANCE) * 0.3;
      if (opacity <= 0.05) return;

      context.globalAlpha = opacity * Math.min(particle.opacity, other.opacity);
      context.beginPath();
      context.moveTo(particle.x, particle.y);
      context.lineTo(other.x, other.y);
      context.stroke();
    };

    const drawConnections = (): void => {
      const cells = new Map<string, Particle[]>();

      for (const particle of particles) {
        const key = cellKey(Math.floor(particle.x / CONNECTION_DISTANCE), Math.floor(particle.y / CONNECTION_DISTANCE));
        const cell = cells.get(key);
        if (cell === undefined) cells.set(key, [particle]);
        else cell.push(particle);
      }

      context.save();
      context.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      context.lineWidth = 1;

      for (const particle of particles) {
        const cellX = Math.floor(particle.x / CONNECTION_DISTANCE);
        const cellY = Math.floor(particle.y / CONNECTION_DISTANCE);

        for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
          const neighbors = cells.get(cellKey(cellX + offsetX, cellY + offsetY));
          if (neighbors === undefined) continue;
          for (const neighbor of neighbors) connect(particle, neighbor);
        }
      }

      context.restore();
    };

    const render = (): void => {
      if (isRunning === false) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const particle of particles) update(particle);
      drawConnections();
      for (const particle of particles) draw(particle);
      frame = requestAnimationFrame(render);
    };

    const resize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      while (particles.length < PARTICLE_COUNT) particles.push(spawn());
    };

    const onMouseMove = (event: MouseEvent): void => {
      const bounds = canvas.getBoundingClientRect();
      mouse.x = event.clientX - bounds.left;
      mouse.y = event.clientY - bounds.top;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    render();

    return () => {
      isRunning = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  };

  onMount(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    isEnabled = prefersReducedMotion === false && hasFinePointer;
    if (isEnabled === false || element === undefined) return;

    const context = element.getContext('2d');
    if (context === null) return;
    return start(element, context);
  });
</script>

<canvas
  bind:this={element}
  class={['pointer-events-none fixed inset-0 z-0 h-full w-full', isEnabled === false && 'hidden']}
></canvas>
