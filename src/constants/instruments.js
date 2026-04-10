export const INSTRUMENTS = {
  HOBO: {
    id: 'HOBO',
    label: 'Onset HOBO (U20/U20L)',
    helpText: 'The pressure port is located at the very bottom of the instrument. Measure from your surveyed point (e.g., well cap) DOWN to the base of the HOBO.',
    defaultOffset: 0.150, // Just a placeholder example
  },
  SOLINST: {
    id: 'SOLINST',
    label: 'Solinst Levelogger',
    helpText: 'The sensor port is near the bottom end. Measure from the top of the body (where your tape hook is) down to the bottom pressure orifices.',
    defaultOffset: 0.200,
  },
  SPARKFUN_RTK: {
    id: 'SPARKFUN_RTK',
    label: 'SparkFun RTK Facet',
    helpText: 'Ensure you account for the pole height. The antenna phase center is at the base of the dome.',
  },
  OTHER: {
    id: 'OTHER',
    label: 'Generic / Other',
    helpText: 'Describe your measurement point and sensor orifice relationship in the notes.',
  },
};
