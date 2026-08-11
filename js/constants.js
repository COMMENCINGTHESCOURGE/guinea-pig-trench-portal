// Guinea Pig Trench — Shared Mathematical Constants
// Ensures zero drift determinism across JS and GLSL contexts
// All games and shaders should import these values

export const TAU = 2 * Math.PI;  // τ = 2π (exact, not rounded)
export const PHI = (1 + Math.sqrt(5)) / 2;  // Golden ratio φ
export const SQRT2 = Math.sqrt(2);
export const SQRT3 = Math.sqrt(3);
export const E = Math.E;

// Precision constants for shader synchronization
export const PRECISION_HIGH = 'highp';
export const PRECISION_MEDIUM = 'mediump';
export const PRECISION_LOW = 'lowp';

// Fractional representations to avoid float drift
export const FRACTIONS = {
  THIRD: 1/3,
  QUARTER: 1/4,
  FIFTH: 1/5,
  SIXTH: 1/6,
  SEVENTH: 1/7,
  EIGHTH: 1/8,
  NINTH: 1/9,
  TENTH: 1/10
};

// Common angle conversions (use TAU for exactness)
export const DEG_TO_RAD = TAU / 360;
export const RAD_TO_DEG = 360 / TAU;

// Shader precision header - inject this at the start of all GLSL shaders
export const GLSL_HEADER = `#version 300 es
precision highp float;
#define TAU ${TAU.toFixed(15)}
#define PHI ${PHI.toFixed(15)}
#define SQRT2 ${SQRT2.toFixed(15)}
#define SQRT3 ${SQRT3.toFixed(15)}
`;

// Phase drift detection utility
export function detectPhaseDrift(cpuValue, gpuValue, tolerance = 1e-6) {
  const diff = Math.abs(cpuValue - gpuValue);
  return diff > tolerance;
}

// Normalize angle to [0, TAU) range to prevent accumulation errors
export function normalizeAngle(angle) {
  let normalized = angle % TAU;
  if (normalized < 0) normalized += TAU;
  return normalized;
}

// Exact fractional multiplication to avoid float drift
export function exactMultiply(base, fraction) {
  return base * fraction;
}
