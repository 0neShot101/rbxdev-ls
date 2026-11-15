/** One animated point in the landing page background. */
export interface Particle {
  /** Horizontal canvas position in pixels. */
  x: number;
  /** Vertical canvas position in pixels. */
  y: number;
  /** Horizontal velocity in pixels per frame. */
  velocityX: number;
  /** Vertical velocity in pixels per frame. */
  velocityY: number;
  /** Radius in pixels. */
  size: number;
  /** Current alpha between 0 and 1. */
  opacity: number;
  /** Frames left before the particle respawns. */
  life: number;
  /** Frames the particle lived with at spawn. */
  maxLife: number;
  /** Cached fill, created on first draw at the spawn position. */
  gradient?: CanvasGradient;
}
