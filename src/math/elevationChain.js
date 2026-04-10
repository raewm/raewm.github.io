/**
 * Compute orthometric (NAVD88-equivalent) height from RTK output.
 * @param {number} h_ellipsoid - Ellipsoidal height in meters
 * @param {number} N - Geoid undulation in meters
 * @returns {number} Orthometric height in meters
 */
export function computeOrthometric(h_ellipsoid, N) {
  if (h_ellipsoid === null || N === null) return null;
  return h_ellipsoid - N;
}

/**
 * Apply a benchmark + rod reading to get elevation at a point.
 * @param {number} bm_elevation - Benchmark elevation in its native datum (m)
 * @param {number} rod - Rod/staff reading
 * @param {'down'|'up'} direction - 'down' means the target is BELOW the BM (most common)
 * @returns {number} Elevation at target point in same datum as benchmark
 */
export function applyRodReading(bm_elevation, rod, direction = 'down') {
  if (bm_elevation === null || rod === null) return null;
  return direction === 'down' ? bm_elevation - rod : bm_elevation + rod;
}

/**
 * Apply a physical offset from a surveyed point to the sensor.
 * @param {number} elevation - Elevation at surveyed point
 * @param {number} offset - Physical offset in meters (positive value)
 * @param {'down'|'up'} direction - 'down' means sensor is BELOW the survey point
 * @returns {number} Elevation at sensor
 */
export function applyOffset(elevation, offset, direction = 'down') {
  if (elevation === null || offset === null) return null;
  return direction === 'down' ? elevation - offset : elevation + offset;
}

/**
 * Compute residuals and statistics for a set of legs.
 * @param {Array<{id, label, sensorElevation}>} legs - Array of resolved legs
 * @returns {{ mean, stdDev, residuals: Array<{id, label, sensorElevation, residual}>, maxResidual, passed, tolerance }}
 */
export function computeClosure(legs, tolerance = 0.020) {
  if (!legs || legs.length < 2) return null;
  
  const values = legs
    .filter(l => l.sensorElevation !== null)
    .map(l => l.sensorElevation);
    
  if (values.length < 2) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const residuals = legs.map(l => ({
    ...l,
    residual: l.sensorElevation !== null ? l.sensorElevation - mean : null,
  }));
  
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const maxResidual = Math.max(...values.map(v => Math.abs(v - mean)));
  const passed = maxResidual <= tolerance;

  return { mean, stdDev, residuals, maxResidual, passed, tolerance };
}

/**
 * Convert meters to feet.
 */
export function mToFt(m) { return m * 3.280839895; }

/**
 * Convert feet to meters.
 */
export function ftToM(ft) { return ft / 3.280839895; }

/**
 * Format elevation for display.
 */
export function formatElev(value, unit = 'm', decimals = 3) {
  if (value === null || value === undefined) return '--';
  const v = unit === 'ft' ? mToFt(value) : value;
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)} ${unit}`;
}
