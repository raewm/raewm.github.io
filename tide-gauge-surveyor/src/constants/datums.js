// Every datum the app handles. Add new ones here only.
export const DATUMS = {
  // Geodetic / Orthometric
  ELLIPSOID: {
    id: 'ELLIPSOID',
    label: 'Ellipsoid (GRS80/WGS84)',
    category: 'geodetic',
    description: 'Mathematical surface used by GPS. NOT a physical datum. Heights above this surface are called "ellipsoidal heights".',
    color: 'var(--datum-ellipsoid)',
  },
  NAVD88: {
    id: 'NAVD88',
    label: 'NAVD 88',
    fullName: 'North American Vertical Datum of 1988',
    category: 'orthometric',
    description: 'The current standard land-based vertical datum for the US. Used for topographic maps, LIDAR, and most modern NGS benchmarks. Heights are called "orthometric" or "NAVD88 heights".',
    color: 'var(--datum-navd88)',
  },
  NGVD29: {
    id: 'NGVD29',
    label: 'NGVD 29',
    fullName: 'National Geodetic Vertical Datum of 1929',
    category: 'orthometric',
    description: 'Older US vertical datum, predecessor to NAVD88. Still found on older benchmarks. Differs from NAVD88 by a spatially variable amount. Choose this only if your benchmark explicitly states NGVD29.',
    color: 'var(--datum-ngvd29)',
  },
  IGLD85: {
    id: 'IGLD85',
    label: 'IGLD 85',
    fullName: 'International Great Lakes Datum of 1985',
    category: 'orthometric',
    description: 'Used for Great Lakes water level data. Similar to NAVD88 but with small regional differences. Use this only for Great Lakes deployments.',
    color: '#8b5cf6',
  },
  // Tidal Datums
  MHHW: {
    id: 'MHHW',
    label: 'MHHW',
    fullName: 'Mean Higher High Water',
    category: 'tidal',
    description: 'Average of the highest high water heights observed during a 19-year tidal epoch. Used for some coastal regulatory purposes.',
    color: 'var(--datum-mhhw)',
  },
  MHW: {
    id: 'MHW',
    label: 'MHW',
    fullName: 'Mean High Water',
    category: 'tidal',
    description: 'Average of all high water heights observed during a 19-year tidal epoch.',
    color: 'var(--datum-mhw)',
  },
  MSL: {
    id: 'MSL',
    label: 'MSL',
    fullName: 'Mean Sea Level',
    category: 'tidal',
    description: 'Average of all hourly water levels over a 19-year tidal epoch. Often used as a general reference. NOT the same as NAVD88.',
    color: 'var(--datum-msl)',
  },
  MLW: {
    id: 'MLW',
    label: 'MLW',
    fullName: 'Mean Low Water',
    category: 'tidal',
    description: 'Average of all low water heights observed during a 19-year tidal epoch.',
    color: '#22d3ee',
  },
  MLLW: {
    id: 'MLLW',
    label: 'MLLW',
    fullName: 'Mean Lower Low Water',
    category: 'tidal',
    description: 'Average of the lowest low water heights observed during a 19-year tidal epoch. This is the standard chart datum for NOAA nautical charts — the "zero" for tide predictions. Most coastal projects reference this datum.',
    color: 'var(--datum-mllw)',
  },
};

export const GEOID_MODELS = [
  { id: '18', label: 'GEOID18 (CONUS, PR, USVI — recommended)', default: true },
  { id: '12B', label: 'GEOID12B (Alaska, Hawaii, Guam, Pacific Islands)' },
  { id: 'manual', label: 'Manual Entry (I have the value from another source)' },
];

export const TARGET_DATUMS = ['NAVD88', 'NGVD29', 'IGLD85', 'MSL', 'MLLW', 'MLW', 'MHW', 'MHHW'];
