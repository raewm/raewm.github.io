/**
 * Weber DCOE 40 Configuration App - Standalone Bundle
 * All modules combined into one file for local use without web server
 */

// ===== WEBER CALCULATOR =====
class WeberCalculator {
    static calculateMainJet(venturiSize, displacement, compression, camProfile = 'stock', numCarbs = 3) {
        let mainJet = venturiSize * 4;
        const camAdjustment = { 'stock': 0, 'mild': 2, 'race': 5 };
        mainJet += (camAdjustment[camProfile] || 0);
        if (compression > 9.5) {
            mainJet += 2;
        } else if (compression > 10.5) {
            mainJet += 5;
        }
        return Math.round(mainJet / 5) * 5;
    }

    static calculateAirCorrector(mainJet, usage = 'street') {
        const baseOffset = { 'street': 60, 'sport': 55, 'race': 50 };
        const airCorrector = mainJet + (baseOffset[usage] || 55);
        return Math.round(airCorrector / 10) * 10;
    }

    static calculateVenturiSize(displacement, numCarbs, maxRPM) {
        const displacementPerCarb = displacement / numCarbs;
        let venturi;
        if (displacementPerCarb < 400) venturi = 28;
        else if (displacementPerCarb < 550) venturi = 30;
        else if (displacementPerCarb < 700) venturi = 32;
        else if (displacementPerCarb < 850) venturi = 34;
        else if (displacementPerCarb < 1000) venturi = 36;
        else venturi = 38;

        if (maxRPM > 7000) venturi += 2;
        else if (maxRPM < 5000) venturi -= 2;

        return Math.max(28, Math.min(40, venturi));
    }

    static calculateIdleJet(venturiSize) {
        if (venturiSize <= 32) return 50;
        else if (venturiSize <= 36) return 55;
        else return 60;
    }

    static recommendEmulsionTube(usage, maxRPM) {
        const recommendations = {
            'street': { primary: 'F16', alternate: 'F11', description: 'Good street manners, smooth progression' },
            'sport': { primary: 'F9', alternate: 'F11', description: 'Balanced street/performance' },
            'race': { primary: 'F2', alternate: 'F9', description: 'High RPM performance, lean top end' }
        };
        return recommendations[usage] || recommendations['sport'];
    }

    static calculatePumpJet(venturiSize, response = 'normal') {
        const responseOffset = { 'mild': -5, 'normal': 0, 'aggressive': 5 };
        let pumpJet = 40 + (venturiSize - 32);
        pumpJet += (responseOffset[response] || 0);
        return Math.max(35, Math.min(60, Math.round(pumpJet / 5) * 5));
    }

    static generateConfiguration(engineSpecs) {
        const {
            displacement, numCarbs = 3, compression, camProfile = 'stock',
            maxRPM = 6000, usage = 'street', throttleResponse = 'normal'
        } = engineSpecs;

        const venturiSize = engineSpecs.venturiSize || this.calculateVenturiSize(displacement, numCarbs, maxRPM);
        const mainJet = this.calculateMainJet(venturiSize, displacement / numCarbs, compression, camProfile, numCarbs);
        const airCorrector = this.calculateAirCorrector(mainJet, usage);
        const idleJet = this.calculateIdleJet(venturiSize);
        const pumpJet = this.calculatePumpJet(venturiSize, throttleResponse);
        const emulsionTube = this.recommendEmulsionTube(usage, maxRPM);

        return {
            venturi: venturiSize,
            mainJet,
            airCorrector,
            idleJet,
            pumpJet,
            emulsionTube: emulsionTube.primary,
            emulsionTubeAlt: emulsionTube.alternate,
            emulsionTubeDescription: emulsionTube.description,
            notes: this.generateNotes(engineSpecs, { venturiSize, mainJet, airCorrector, idleJet, pumpJet })
        };
    }

    static generateNotes(engineSpecs, config) {
        const notes = [];
        notes.push(`Main jet formula: ${config.venturiSize}mm venturi × 4 = ${config.venturiSize * 4} (adjusted to ${config.mainJet})`);
        notes.push(`Air corrector: Main jet ${config.mainJet} + ~55 = ${config.airCorrector}`);
        if (engineSpecs.compression > 10) {
            notes.push('⚠ High compression may require richer jetting for safety');
        }
        if (engineSpecs.maxRPM > 6500) {
            notes.push('⚠ High RPM operation - ensure adequate air corrector sizing');
        }
        notes.push('💡 These are starting points - dyno tuning recommended for optimal performance');
        return notes;
    }
}

// ===== WEBER COMPONENTS DATABASE =====
const WEBER_COMPONENTS = {
    mainJets: [90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210],
    airCorrectors: [120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260],
    venturis: [
        { size: 28, description: 'Small displacement, low RPM' },
        { size: 30, description: 'Small-medium displacement' },
        { size: 32, description: 'Medium displacement, street' },
        { size: 34, description: 'Medium-large displacement, street/sport' },
        { size: 36, description: 'Large displacement, sport' },
        { size: 38, description: 'Large displacement, race' },
        { size: 40, description: 'Maximum flow, race only' }
    ],
    idleJets: [45, 50, 55, 60, 65, 70],
    pumpJets: [35, 40, 45, 50, 55, 60],
    emulsionTubes: {
        'F2': { name: 'F2', description: 'Lean top end, high RPM racing', characteristics: 'Many small holes high up, leans mixture rapidly with RPM', bestFor: 'Racing applications, high RPM power' },
        'F9': { name: 'F9', description: 'Balanced street/performance', characteristics: 'Progressive lean-out, good for sport driving', bestFor: 'Sport street, track days, mild racing' },
        'F11': { name: 'F11', description: 'Smooth street characteristics', characteristics: 'Gradual progression, good driveability', bestFor: 'Street performance, daily drivers' },
        'F15': { name: 'F15', description: 'Rich mid-range', characteristics: 'Maintains richer mixture longer in RPM range', bestFor: 'Torquey street engines, low-mid RPM power' },
        'F16': { name: 'F16', description: 'Street/touring', characteristics: 'Smooth progression, excellent street manners', bestFor: 'Street touring, cruising, economy' }
    }
};

// ===== EXAMPLE CONFIGURATIONS =====
const EXAMPLE_CONFIGS = [
    {
        id: 'tr250-stock-cam',
        name: 'Triumph TR250 - Stock Cam Street',
        engine: { make: 'Triumph', model: 'TR250/TR6', displacement: 2498, cylinders: 6, configuration: 'Inline-6', compression: 8.5, camProfile: 'stock', maxRPM: 5500 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE', numberOfCarbs: 3, venturi: 30, mainJet: 125, airCorrector: 180, idleJet: 50, pumpJet: 40, emulsionTube: 'F16', auxVenturi: 4.5 },
        usage: 'street',
        notes: 'Classic street setup. 30mm venturis provide excellent low-end response and driveability. Factory recommendation for standard engines.',
        source: 'Triumph TR250/TR6 Weber conversion guides (Moss Motors, Racetorations)',
        verified: true
    },
    {
        id: 'tr250-mild-cam',
        name: 'Triumph TR250 - Mild Performance',
        engine: { make: 'Triumph', model: 'TR250/TR6', displacement: 2498, cylinders: 6, configuration: 'Inline-6', compression: 9.2, camProfile: 'mild', maxRPM: 6000 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE', numberOfCarbs: 3, venturi: 32, mainJet: 135, airCorrector: 190, idleJet: 55, pumpJet: 45, emulsionTube: 'F11', auxVenturi: 4.5 },
        usage: 'sport',
        notes: 'Balanced performance setup. 32mm venturis offer better breathing for mild cams without sacrificing too much torque.',
        source: 'Common configuration from Triumph Experience forum and Weber tuning manuals',
        verified: true
    },
    {
        id: 'tr6-race',
        name: 'Triumph TR6 - Race Configuration',
        engine: { make: 'Triumph', model: 'TR6', displacement: 2548, cylinders: 6, configuration: 'Inline-6', compression: 11.0, camProfile: 'race', maxRPM: 7000 },
        carbSetup: { carburetorModel: 'Weber 45 DCOE', numberOfCarbs: 3, venturi: 36, mainJet: 155, airCorrector: 180, idleJet: 60, pumpJet: 50, emulsionTube: 'F2', auxVenturi: 5.0 },
        usage: 'race',
        notes: 'Full race setup. High compression, long duration cam. requires Weber 45 DCOE bodies for optimal airflow.',
        source: 'Vintage racing classification data (SCCA/SVRA)',
        verified: true
    },
    {
        id: 'ford-kent-1600',
        name: 'Ford Kent 1600cc - Twin DCOE',
        engine: { make: 'Ford', model: 'Kent 1600', displacement: 1600, cylinders: 4, configuration: 'Inline-4', compression: 9.5, camProfile: 'mild', maxRPM: 6500 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE', numberOfCarbs: 2, venturi: 32, mainJet: 130, airCorrector: 180, idleJet: 50, pumpJet: 45, emulsionTube: 'F11', auxVenturi: 4.5 },
        usage: 'sport',
        notes: 'Classic Ford Kent setup. Popular in Formula Ford and club racing. Good street/track compromise.',
        source: 'Established configuration from Ford Kent tuning guides (classicrallyclub.com.au)',
        verified: true
    },
    {
        id: 'alfa-twin-cam-2000',
        name: 'Alfa Romeo 2000 Twin Cam',
        engine: { make: 'Alfa Romeo', model: '2000 Twin Cam', displacement: 1962, cylinders: 4, configuration: 'Inline-4 DOHC', compression: 9.0, camProfile: 'stock', maxRPM: 6000 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE', numberOfCarbs: 2, venturi: 36, mainJet: 145, airCorrector: 200, idleJet: 55, pumpJet: 50, emulsionTube: 'F16', auxVenturi: 4.5 },
        usage: 'street',
        notes: 'Factory Alfa Romeo specification. Excellent street manners with good mid-range torque.',
        source: 'Factory Weber DCOE specification for Alfa Romeo twin-cam engines',
        verified: true
    },
    {
        id: 'vw-type1-1600',
        name: 'VW Type 1 - 1600cc Dual Port',
        engine: { make: 'Volkswagen', model: 'Type 1', displacement: 1600, cylinders: 4, configuration: 'Flat-4 Air-cooled', compression: 7.5, camProfile: 'stock', maxRPM: 5000 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE', numberOfCarbs: 2, venturi: 28, mainJet: 120, airCorrector: 170, idleJet: 50, pumpJet: 40, emulsionTube: 'F16', auxVenturi: 4.0 },
        usage: 'street',
        notes: 'Small venturis for low RPM air-cooled engine. Excellent throttle response and fuel economy.',
        source: 'Based on Weber tuning recommendations for VW air-cooled engines',
        verified: true
    },
    {
        id: 'bmw-m10-2002',
        name: 'BMW M10 (2002) - Twin DCOE',
        engine: { make: 'BMW', model: 'M10 (2002)', displacement: 1990, cylinders: 4, configuration: 'Inline-4 SOHC', compression: 9.3, camProfile: 'mild', maxRPM: 6500 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE', numberOfCarbs: 2, venturi: 36, mainJet: 140, airCorrector: 190, idleJet: 55, pumpJet: 45, emulsionTube: 'F9', auxVenturi: 4.5 },
        usage: 'sport',
        notes: 'Popular BMW 2002 race/rally setup. Good power throughout the rev range.',
        source: 'Common BMW 2002 Weber setup from vintage BMW racing community',
        verified: true
    },
    {
        id: 'mg-b-series-1800',
        name: 'MG B-Series 1800cc',
        engine: { make: 'MG', model: 'MGB B-Series', displacement: 1798, cylinders: 4, configuration: 'Inline-4 OHV', compression: 8.8, camProfile: 'stock', maxRPM: 5500 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE', numberOfCarbs: 2, venturi: 32, mainJet: 130, airCorrector: 185, idleJet: 50, pumpJet: 45, emulsionTube: 'F11', auxVenturi: 4.5 },
        usage: 'street',
        notes: 'Popular MGB upgrade from SU carburetors. Improved throttle response and easier tuning.',
        source: 'MG tuning guides and British sports car forum recommendations',
        verified: true
    },
    {
        id: 'porsche-911-27',
        name: 'Porsche 911 2.7L - Triple IDA/DCOE',
        engine: { make: 'Porsche', model: '911 2.7L', displacement: 2687, cylinders: 6, configuration: 'Flat-6 Air-cooled', compression: 8.5, camProfile: 'stock', maxRPM: 6500 },
        carbSetup: { carburetorModel: 'Weber 40 IDA/DCOE', numberOfCarbs: 3, venturi: 34, mainJet: 145, airCorrector: 180, idleJet: 60, pumpJet: 50, emulsionTube: 'F3', auxVenturi: 4.5 },
        usage: 'sport',
        notes: 'Popular Porsche 911 Weber conversion. F3 emulsion tubes common for Porsche applications. Excellent throttle response.',
        source: 'Porsche 911 Weber specifications from pelicanparts.com forum discussions',
        verified: true
    },
    {
        id: 'datsun-240z-l24',
        name: 'Datsun 240Z L24 - Triple DCOE',
        engine: { make: 'Datsun', model: '240Z L24', displacement: 2393, cylinders: 6, configuration: 'Inline-6 SOHC', compression: 9.0, camProfile: 'stock', maxRPM: 6000 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE-18', numberOfCarbs: 3, venturi: 30, mainJet: 130, airCorrector: 175, idleJet: 50, pumpJet: 45, emulsionTube: 'F2', auxVenturi: 4.5 },
        usage: 'sport',
        notes: 'Weber factory recommendation for L24. 30mm venturis provide excellent response off-idle. F2 or F11 emulsion tubes work well.',
        source: 'Weber 40DCOE-18 factory specifications for Datsun L24 from zclub.net',
        verified: true
    },
    {
        id: 'mini-cooper-s-1275',
        name: 'Mini Cooper S 1275cc - Weber 45',
        engine: { make: 'Austin/Morris', model: 'Mini Cooper S', displacement: 1275, cylinders: 4, configuration: 'Inline-4 Transverse', compression: 9.75, camProfile: 'mild', maxRPM: 6500 },
        carbSetup: { carburetorModel: 'Weber 45 DCOE', numberOfCarbs: 1, venturi: 36, mainJet: 160, airCorrector: 170, idleJet: 60, pumpJet: 65, emulsionTube: 'F16', auxVenturi: 4.5 },
        usage: 'sport',
        notes: 'Top-end performance setup for Mini Cooper S. 45 DCOE preferred over 40 for 1275cc A-series. May require firewall modification.',
        source: 'A-series tuning specifications from classiccarbs.co.uk and carbparts.eu',
        verified: true
    },
    {
        id: 'fiat-124-twin-cam',
        name: 'Fiat 124 Spider Twin Cam 2.0L',
        engine: { make: 'Fiat', model: '124 Spider 2.0', displacement: 1995, cylinders: 4, configuration: 'Inline-4 DOHC', compression: 8.5, camProfile: 'stock', maxRPM: 6000 },
        carbSetup: { carburetorModel: 'Weber 40 DCOE', numberOfCarbs: 2, venturi: 36, mainJet: 145, airCorrector: 190, idleJet: 50, pumpJet: 45, emulsionTube: 'F16', auxVenturi: 4.5 },
        usage: 'street',
        notes: 'Excellent setup for Fiat twin-cam engines. 36mm venturi formula (×4 = 144, rounded to 145 main jet). F16 tube for smooth street characteristics.',
        source: 'Fiat twin-cam Weber setup from classicrallyclub.com.au tuning guide',
        verified: true
    }
];

function getConfigById(id) {
    return EXAMPLE_CONFIGS.find(config => config.id === id);
}

function getConfigsByUsage(usage) {
    return EXAMPLE_CONFIGS.filter(config => config.usage === usage);
}

function getVerifiedConfigs() {
    return EXAMPLE_CONFIGS.filter(config => config.verified);
}

// ===== TROUBLESHOOTING GUIDE ===== 
const TROUBLESHOOTING_GUIDE = {
    categories: {
        idle: {
            name: 'Idle & Low Speed Issues',
            problems: [
                {
                    symptom: 'Rough idle, engine hunting',
                    possibleCauses: [
                        'Idle jets too small or too large',
                        'Air leaks in intake manifold',
                        'Mixture screws incorrectly adjusted',
                        'Choke not fully opening'
                    ],
                    solutions: [
                        'Check for air leaks with carburetor cleaner spray',
                        'Adjust mixture screws: 1.5-2 turns out from lightly seated',
                        'Try idle jets one size larger or smaller',
                        'Verify choke linkage fully opens when warm'
                    ],
                    adjustComponents: ['idleJet', 'mixtureScrew']
                },
                {
                    symptom: 'Won\'t idle, dies when releasing throttle',
                    possibleCauses: [
                        'Idle jets too small',
                        'Mixture too lean',
                        'Throttle plates not synchronized',
                        'Idle speed set too low'
                    ],
                    solutions: [
                        'Increase idle jet size by one size (e.g., 50 → 55)',
                        'Richen mixture screws (turn out 1/4 turn)',
                        'Synchronize throttles with gauge or listening tube',
                        'Increase idle speed to 900-1000 RPM as starting point'
                    ],
                    adjustComponents: ['idleJet', 'mixtureScrew', 'throttleSync']
                }
            ]
        },
        transition: {
            name: 'Transition & Off-Idle Response',
            problems: [
                {
                    symptom: 'Flat spot or hesitation when opening throttle from idle',
                    possibleCauses: [
                        'Accelerator pump jet too small',
                        'Accelerator pump timing incorrect',
                        'Transition from idle to main circuit too abrupt',
                        'Main jets too lean'
                    ],
                    solutions: [
                        'Increase pump jet size by 5 (e.g., 40 → 45)',
                        'Check pump linkage and adjust for earlier engagement',
                        'Slightly richen idle mixture screws',
                        'Consider one size larger main jets'
                    ],
                    adjustComponents: ['pumpJet', 'mainJet']
                },
                {
                    symptom: 'Stumble or hesitation at 2000-3000 RPM',
                    possibleCauses: [
                        'Transition holes blocked or too small',
                        'Main jets too small for this RPM range',
                        'Emulsion tube not suited to application'
                    ],
                    solutions: [
                        'Clean all jets and passages thoroughly',
                        'Try main jets 5 sizes larger',
                        'Consider F11 or F16 emulsion tube for smoother transition'
                    ],
                    adjustComponents: ['mainJet', 'emulsionTube']
                }
            ]
        },
        midrange: {
            name: 'Mid-Range Performance (3000-5000 RPM)',
            problems: [
                {
                    symptom: 'Flat, unresponsive in mid-range',
                    possibleCauses: [
                        'Main jets too small',
                        'Air correctors too large (too lean)',
                        'Wrong emulsion tube for application'
                    ],
                    solutions: [
                        'Increase main jets by 5-10 sizes',
                        'Decrease air corrector by 10-20 (richer)',
                        'Try F11 or F15 emulsion tube for richer mid-range'
                    ],
                    adjustComponents: ['mainJet', 'airCorrector', 'emulsionTube']
                },
                {
                    symptom: 'Rich, loading up, black smoke in mid-range',
                    possibleCauses: [
                        'Main jets too large',
                        'Air correctors too small',
                        'Emulsion tube holes blocked'
                    ],
                    solutions: [
                        'Reduce main jets by 5-10 sizes',
                        'Increase air corrector by 10-20 (leaner)',
                        'Clean emulsion tubes thoroughly',
                        'Verify float level is correct'
                    ],
                    adjustComponents: ['mainJet', 'airCorrector']
                }
            ]
        },
        topEnd: {
            name: 'High RPM / Wide Open Throttle',
            problems: [
                {
                    symptom: 'Lean at high RPM, engine feels like hitting wall',
                    possibleCauses: [
                        'Main jets too small',
                        'Air correctors too large',
                        'Fuel pressure insufficient',
                        'Float level too low'
                    ],
                    solutions: [
                        'Increase main jets by 5-10 sizes',
                        'Decrease air corrector by 20-30',
                        'Verify fuel pressure 3-4 PSI',
                        'Check and adjust float levels'
                    ],
                    adjustComponents: ['mainJet', 'airCorrector'],
                    warning: '⚠ Running lean at WOT can cause engine damage!'
                },
                {
                    symptom: 'Rich at high RPM, won\'t rev out, smoke',
                    possibleCauses: [
                        'Main jets too large',
                        'Air correctors too small',
                        'Chokes (venturis) too small'
                    ],
                    solutions: [
                        'Reduce main jets by 5-10 sizes',
                        'Increase air corrector by 20-30',
                        'Consider larger choke size if severely restricted'
                    ],
                    adjustComponents: ['mainJet', 'airCorrector', 'venturi']
                },
                {
                    symptom: 'Good power but won\'t pull past certain RPM',
                    possibleCauses: [
                        'Chokes (venturis) too small - airflow limit',
                        'Air correctors too large - going too lean',
                        'Exhaust restriction'
                    ],
                    solutions: [
                        'Consider next size larger chokes (e.g., 34mm → 36mm)',
                        'Reduce air corrector by 20-30',
                        'Check exhaust for restrictions',
                        'Note: Larger chokes require complete re-jetting!'
                    ],
                    adjustComponents: ['venturi', 'airCorrector']
                }
            ]
        },
        specific: {
            name: 'Specific Symptoms',
            problems: [
                {
                    symptom: 'Backfiring through carburetors',
                    possibleCauses: [
                        'Severely lean mixture (most common)',
                        'Ignition timing too advanced',
                        'Valve timing incorrect',
                        'Intake air leak'
                    ],
                    solutions: [
                        'Richen mixture immediately - increase main jets',
                        'Check and retard ignition timing',
                        'Verify cam timing is correct',
                        'Check for intake manifold air leaks'
                    ],
                    adjustComponents: ['mainJet', 'idleJet'],
                    warning: '⚠ Backfiring indicates dangerously lean mixture - fix immediately!'
                },
                {
                    symptom: 'Backfiring through exhaust, popping on deceleration',
                    possibleCauses: [
                        'Normal with overlap cams (not always a problem)',
                        'Exhaust leak',
                        'Slightly rich mixture on deceleration'
                    ],
                    solutions: [
                        'Usually normal with performance cams',
                        'Check exhaust for leaks',
                        'Slight idle jet reduction may help',
                        'Not typically harmful if only on deceleration'
                    ],
                    adjustComponents: ['idleJet']
                },
                {
                    symptom: 'Hard starting when cold',
                    possibleCauses: [
                        'Choke not closing fully',
                        'Choke jets incorrect',
                        'Starter jets too small',
                        'Overall mixture too lean'
                    ],
                    solutions: [
                        'Check choke linkage closes fully',
                        'Verify choke jets are standard size',
                        'Richen main and idle circuits slightly',
                        'Consider manual choke override for cold starts'
                    ],
                    adjustComponents: ['idleJet', 'mainJet']
                },
                {
                    symptom: 'Poor fuel economy',
                    possibleCauses: [
                        'Overall mixture too rich',
                        'Chokes too large for street use',
                        'Floats set too high',
                        'Air correctors too small'
                    ],
                    solutions: [
                        'Reduce main jets by 5-10',
                        'Increase air correctors by 20-30',
                        'Consider smaller chokes for street (e.g., 36mm → 34mm)',
                        'Verify float levels per specifications',
                        'Note: Performance carbs prioritize power not economy!'
                    ],
                    adjustComponents: ['mainJet', 'airCorrector', 'venturi']
                }
            ]
        }
    },
    tuningProcedure: {
        title: 'Systematic Weber DCOE Tuning Procedure',
        steps: [
            {
                step: 1,
                name: 'Pre-Tuning Checks',
                tasks: [
                    'Verify engine mechanical condition (compression, timing)',
                    'Set ignition timing to specification',
                    'Ensure fuel pressure 3-4 PSI',
                    'Check for air leaks (spray carb cleaner around manifold)',
                    'Synchronize throttle butterflies',
                    'Set float levels to specification (7-8mm below parting line)'
                ]
            },
            {
                step: 2,
                name: 'Idle Circuit Setup',
                tasks: [
                    'Start with recommended idle jet size (50-55 typical)',
                    'Set idle mixture screws 1.5-2 turns out',
                    'Warm engine to operating temperature',
                    'Adjust idle speed to 900-1000 RPM',
                    'Fine-tune mixture screws for highest idle speed',
                    'Reset idle speed if necessary',
                    'Verify smooth idle and clean throttle response'
                ]
            },
            {
                step: 3,
                name: 'Main Jet Baseline',
                tasks: [
                    'Start with calculated main jet (choke × 4)',
                    'Road test at 3/4 to full throttle in 3rd gear',
                    'Check spark plugs after test (tan/light brown = good)',
                    'If lean: increase main jet by 5-10',
                    'If rich: decrease main jet by 5-10',
                    'Repeat until optimal'
                ]
            },
            {
                step: 4,
                name: 'Air Corrector Tuning',
                tasks: [
                    'Start with main jet + 50-60',
                    'Test at high RPM (5000+ RPM sustained)',
                    'If lean at top end: reduce air corrector by 20-30',
                    'If rich at top end: increase air corrector by 20-30',
                    'Goal: smooth power all the way to redline'
                ]
            },
            {
                step: 5,
                name: 'Accelerator Pump',
                tasks: [
                    'Test throttle snap from idle',
                    'If hesitation/flat spot: increase pump jet by 5',
                    'If too rich (loading up): decrease pump jet by 5',
                    'Adjust pump linkage timing if needed'
                ]
            },
            {
                step: 6,
                name: 'Final Verification',
                tasks: [
                    'Full road test - all RPM ranges',
                    'Check spark plugs after extended run',
                    'Verify smooth power delivery throughout range',
                    'Document final jetting for future reference',
                    'Consider dyno tuning for final optimization'
                ]
            }
        ]
    },
    quickReference: {
        title: 'Quick Jet Change Reference',
        rules: [
            'Larger main jet number = RICHER mixture',
            'Larger air corrector number = LEANER mixture (more air)',
            'Larger idle jet number = RICHER idle',
            'Main jet affects entire range, most at mid-high RPM',
            'Air corrector mainly affects high RPM',
            'Idle jet affects idle to ~2500 RPM',
            'Change main jets in 5-10 increments',
            'Change air correctors in 10-30 increments',
            'Always tune conservatively - start richer, lean out slowly',
            'Lean conditions can cause engine damage!'
        ]
    }
};

function searchBySymptom(keyword) {
    const results = [];
    const searchTerm = keyword.toLowerCase();

    Object.entries(TROUBLESHOOTING_GUIDE.categories).forEach(([catKey, category]) => {
        category.problems.forEach(problem => {
            if (problem.symptom.toLowerCase().includes(searchTerm) ||
                problem.possibleCauses.some(cause => cause.toLowerCase().includes(searchTerm))) {
                results.push({
                    category: category.name,
                    ...problem
                });
            }
        });
    });

    return results;
}

function getProblemsByRPMRange(range) {
    const rangeMap = {
        'idle': 'idle',
        'low': 'transition',
        'mid': 'midrange',
        'high': 'topEnd'
    };

    const category = TROUBLESHOOTING_GUIDE.categories[rangeMap[range]];
    return category ? category.problems : [];
}

// ===== MAIN APPLICATION LOGIC =====
let currentConfig = null;

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.setAttribute('aria-selected', 'true');
    }

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const targetContent = document.getElementById(`${tabName}-tab`);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

function initCalculatorForm() {
    const form = document.getElementById('engine-form');
    const presetSelect = document.getElementById('preset-select');

    presetSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            loadPreset(e.target.value);
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        calculateConfiguration();
    });
}

function loadPreset(presetId) {
    const config = EXAMPLE_CONFIGS.find(c => c.id === presetId);
    if (!config) return;

    document.getElementById('displacement').value = config.engine.displacement;
    document.getElementById('num-carbs').value = config.carbSetup.numberOfCarbs;
    document.getElementById('compression').value = config.engine.compression;
    document.getElementById('max-rpm').value = config.engine.maxRPM;
    document.getElementById('cam-profile').value = config.engine.camProfile;
    document.getElementById('usage').value = config.usage;
    document.getElementById('venturi-override').value = config.carbSetup.venturi;

    calculateConfiguration();
}

function calculateConfiguration() {
    const displacement = parseInt(document.getElementById('displacement').value);
    const numCarbs = parseInt(document.getElementById('num-carbs').value);
    const compression = parseFloat(document.getElementById('compression').value);
    const maxRPM = parseInt(document.getElementById('max-rpm').value);
    const camProfile = document.getElementById('cam-profile').value;
    const usage = document.getElementById('usage').value;
    const throttleResponse = document.getElementById('throttle-response').value;
    const venturiOverride = document.getElementById('venturi-override').value;

    if (!displacement || !compression || !maxRPM) {
        alert('Please fill in all required fields (displacement, compression, max RPM)');
        return;
    }

    const engineSpecs = {
        displacement,
        numCarbs,
        compression,
        maxRPM,
        camProfile,
        usage,
        throttleResponse
    };

    if (venturiOverride) {
        engineSpecs.venturiSize = parseInt(venturiOverride);
    }

    currentConfig = WeberCalculator.generateConfiguration(engineSpecs);
    displayResults(currentConfig, engineSpecs);
}

function displayResults(config, engineSpecs) {
    const container = document.getElementById('results-container');

    const html = `
    <div class="results-grid">
      <div class="result-item">
        <div class="result-label">Venturi / Choke</div>
        <div class="result-value">${config.venturi}<span class="result-unit">mm</span></div>
      </div>
      <div class="result-item">
        <div class="result-label">Main Jet</div>
        <div class="result-value">${config.mainJet}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Air Corrector</div>
        <div class="result-value">${config.airCorrector}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Idle Jet</div>
        <div class="result-value">${config.idleJet}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Pump Jet</div>
        <div class="result-value">${config.pumpJet}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Emulsion Tube</div>
        <div class="result-value">${config.emulsionTube}</div>
      </div>
    </div>

    <div class="alert alert-warning">
      <strong>⚠ Important:</strong> These are starting point recommendations based on proven formulas. 
      Fine-tuning on a dyno and road testing are essential for optimal performance.
    </div>

    <h4>Emulsion Tube Info</h4>
    <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">
      <strong>${config.emulsionTube}:</strong> ${config.emulsionTubeDescription}<br>
      Alternative: ${config.emulsionTubeAlt}
    </p>

    <h4>Calculation Notes</h4>
    <ul class="notes-list">
      ${config.notes.map(note => `<li>${note}</li>`).join('')}
    </ul>

    <h4>Configuration Summary</h4>
    <p style="color: var(--color-text-secondary);">
      <strong>Engine:</strong> ${engineSpecs.displacement}cc, ${engineSpecs.compression}:1 CR, 
      ${engineSpecs.maxRPM} RPM max, ${engineSpecs.camProfile} cam<br>
      <strong>Setup:</strong> ${engineSpecs.numCarbs} × Weber 40 DCOE (${Math.round(engineSpecs.displacement / engineSpecs.numCarbs)}cc per carb)<br>
      <strong>Usage:</strong> ${engineSpecs.usage.charAt(0).toUpperCase() + engineSpecs.usage.slice(1)}
    </p>
  `;

    container.innerHTML = html;
}

function initExamplesTab() {
    const filterUsage = document.getElementById('filter-usage');
    const filterVerified = document.getElementById('filter-verified');

    if (filterUsage) filterUsage.addEventListener('change', filterExamples);
    if (filterVerified) filterVerified.addEventListener('change', filterExamples);

    displayExamples(EXAMPLE_CONFIGS);
}

function filterExamples() {
    const usageFilter = document.getElementById('filter-usage').value;
    const verifiedFilter = document.getElementById('filter-verified').value;

    let filtered = EXAMPLE_CONFIGS;

    if (usageFilter) {
        filtered = filtered.filter(c => c.usage === usageFilter);
    }

    if (verifiedFilter === 'true') {
        filtered = filtered.filter(c => c.verified);
    }

    displayExamples(filtered);
}

function displayExamples(configs) {
    const container = document.getElementById('examples-container');
    if (!container) return;

    if (configs.length === 0) {
        container.innerHTML = '<p class="text-center" style="color: var(--color-text-tertiary); padding: var(--space-xl) 0;">No configurations match your filters.</p>';
        return;
    }

    const html = configs.map(config => `
    <div class="config-card" onclick="loadConfigToCalculator('${config.id}')">
      <div class="config-header">
        <div>
          <div class="config-title">${config.name}</div>
          <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-xs);">
            <span class="badge badge-${config.usage}">${config.usage}</span>
            ${config.verified ? '<span class="badge badge-verified">✓ Verified</span>' : ''}
          </div>
        </div>
      </div>
      
      <div class="config-specs">
        <span>${config.engine.displacement}cc</span>
        <span>•</span>
        <span>${config.engine.cylinders} cyl</span>
        <span>•</span>
        <span>${config.engine.compression}:1 CR</span>
        <span>•</span>
        <span>${config.carbSetup.numberOfCarbs}× DCOE</span>
      </div>
      
      <div class="config-jets">
        <span><strong>Venturi:</strong> ${config.carbSetup.venturi}mm</span>
        <span><strong>Main:</strong> ${config.carbSetup.mainJet}</span>
        <span><strong>Air:</strong> ${config.carbSetup.airCorrector}</span>
        <span><strong>Idle:</strong> ${config.carbSetup.idleJet}</span>
        <span><strong>Pump:</strong> ${config.carbSetup.pumpJet}</span>
        <span><strong>Emulsion:</strong> ${config.carbSetup.emulsionTube}</span>
      </div>
      
      ${config.notes ? `<p style="margin-top: var(--space-md); color: var(--color-text-secondary); font-size: 0.875rem;">${config.notes}</p>` : ''}
      
      <div class="config-source">
        <strong>Source:</strong> ${config.source}
      </div>
    </div>
  `).join('');

    container.innerHTML = html;
}

function loadConfigToCalculator(configId) {
    switchTab('calculator');
    document.getElementById('preset-select').value = configId;
    loadPreset(configId);
}

function initTroubleshootingTab() {
    const searchInput = document.getElementById('symptom-search');
    const categoryButtons = document.querySelectorAll('[data-category]');

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (e.target.value.length >= 3) {
                    const results = searchBySymptom(e.target.value);
                    displayTroubleshootingResults(results);
                } else if (e.target.value.length === 0) {
                    displayAllTroubleshooting();
                }
            }, 300);
        });
    }

    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const category = button.dataset.category;
            if (category === 'all') {
                displayAllTroubleshooting();
            } else {
                displayTroubleshootingCategory(category);
            }
        });
    });

    displayAllTroubleshooting();
}

function displayAllTroubleshooting() {
    const container = document.getElementById('troubleshooting-container');
    if (!container) return;

    let html = '';

    Object.entries(TROUBLESHOOTING_GUIDE.categories).forEach(([key, category]) => {
        html += `<h3 style="margin-top: var(--space-xl); margin-bottom: var(--space-lg);">${category.name}</h3>`;
        html += category.problems.map(problem => renderProblemCard(problem)).join('');
    });

    container.innerHTML = html;
}

function displayTroubleshootingCategory(categoryKey) {
    const container = document.getElementById('troubleshooting-container');
    if (!container) return;

    const category = TROUBLESHOOTING_GUIDE.categories[categoryKey];
    if (!category) return;

    const html = category.problems.map(problem => renderProblemCard(problem)).join('');
    container.innerHTML = html;
}

function displayTroubleshootingResults(results) {
    const container = document.getElementById('troubleshooting-container');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<p class="text-center" style="color: var(--color-text-tertiary); padding: var(--space-xl) 0;">No results found. Try different keywords.</p>';
        return;
    }

    const html = results.map(problem => renderProblemCard(problem)).join('');
    container.innerHTML = html;
}

function renderProblemCard(problem) {
    return `
    <div class="problem-card">
      <div class="problem-symptom">
        ${problem.symptom}
      </div>
      
      ${problem.warning ? `<div class="alert alert-danger">${problem.warning}</div>` : ''}
      
      <div class="problem-section">
        <h5>Possible Causes</h5>
        <ul>
          ${problem.possibleCauses.map(cause => `<li>${cause}</li>`).join('')}
        </ul>
      </div>
      
      <div class="problem-section">
        <h5>Solutions</h5>
        <ul>
          ${problem.solutions.map(solution => `<li>${solution}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function initTuningGuideTab() {
    displayTuningProcedure();
    displayQuickReference();
}

function displayTuningProcedure() {
    const container = document.getElementById('tuning-procedure-container');
    if (!container) return;

    const procedure = TROUBLESHOOTING_GUIDE.tuningProcedure;

    const html = `
    <p style="color: var(--color-text-secondary); margin-bottom: var(--space-xl);">
      Follow this systematic approach for best tuning results. Don't skip steps!
    </p>
    
    ${procedure.steps.map(step => `
      <div style="margin-bottom: var(--space-xl);">
        <h3>Step ${step.step}: ${step.name}</h3>
        <ul class="notes-list">
          ${step.tasks.map(task => `<li>${task}</li>`).join('')}
        </ul>
      </div>
    `).join('')}
  `;

    container.innerHTML = html;
}

function displayQuickReference() {
    const container = document.getElementById('quick-reference-container');
    if (!container) return;

    const reference = TROUBLESHOOTING_GUIDE.quickReference;

    const html = `
    <ul class="notes-list">
      ${reference.rules.map(rule => `<li>${rule}</li>`).join('')}
    </ul>
  `;

    container.innerHTML = html;
}

// ===== INITIALIZE ON DOM READY =====
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCalculatorForm();
    initExamplesTab();
    initTroubleshootingTab();
    initTuningGuideTab();
    initSimulator();

    console.log('Weber DCOE Configuration Tool loaded successfully!');
});
/**
 * Weber DCOE Tuning Simulator Engine
 * Analyzes the impact of carburetor component changes
 */

class SimulatorEngine {
    /**
     * Analyze the impact of changing a component
     */
    static analyzeComponentChange(component, oldValue, newValue, baseConfig) {
        const delta = newValue - oldValue;
        const direction = delta > 0 ? 'increase' : 'decrease';
        const magnitude = Math.abs(delta);

        const impact = {
            component,
            oldValue,
            newValue,
            delta,
            direction,
            magnitude,
            description: '',
            affectedRanges: [],
            warnings: [],
            recommendations: []
        };

        switch (component) {
            case 'mainJet':
                impact.affectedRanges = ['mid-range', 'high-rpm'];
                if (direction === 'increase') {
                    impact.description = `**Richer** mixture at mid-high RPM. More fuel = more power potential, but worse economy and possible fouling.`;
                    if (magnitude >= 10) {
                        impact.warnings.push('Significant change - test incrementally');
                    }
                } else {
                    impact.description = `**Leaner** mixture at mid-high RPM. Better economy but risk of lean damage.`;
                    impact.warnings.push('⚠ Running too lean can cause engine damage - monitor spark plugs');
                }
                break;

            case 'airCorrector':
                impact.affectedRanges = ['high-rpm'];
                if (direction === 'increase') {
                    impact.description = `**Leaner** at high RPM (more air bleeding). Better top-end, may lose mid-range richness.`;
                } else {
                    impact.description = `**Richer** at high RPM (less air). More top-end power, may get rich and smoke.`;
                    if (magnitude >= 30) {
                        impact.warnings.push('Large change - may cause rich condition at redline');
                    }
                }
                break;

            case 'idleJet':
                impact.affectedRanges = ['idle', 'transition'];
                if (direction === 'increase') {
                    impact.description = `**Richer** idle and low-speed. Smoother idle, better cold starting, may waste fuel.`;
                    if (newValue > 65) {
                        impact.warnings.push('Very large idle jet - may cause rich idle and stumbling');
                    }
                } else {
                    impact.description = `**Leaner** idle. Better economy but may idle rough or not at all.`;
                    if (newValue < 45) {
                        impact.warnings.push('⚠ Idle jet very small - engine may not idle properly');
                    }
                }
                break;

            case 'pumpJet':
                impact.affectedRanges = ['acceleration'];
                if (direction === 'increase') {
                    impact.description = `**More fuel** on throttle snap. Snappier throttle response, may bog if too rich.`;
                } else {
                    impact.description = `**Less fuel** on acceleration. May hesitate or stumble when opening throttle quickly.`;
                }
                break;

            case 'venturi':
                impact.affectedRanges = ['all'];
                impact.warnings.push('⚠ CRITICAL: Venturi change requires COMPLETE re-jetting of all circuits!');
                if (direction === 'increase') {
                    impact.description = `**Larger venturi** = more airflow. Better top-end power but worse throttle response and low-end torque.`;
                    impact.recommendations.push('Increase main jet approximately by (delta × 4)');
                    impact.recommendations.push('Adjust all other jets proportionally');
                } else {
                    impact.description = `**Smaller venturi** = less airflow. Better throttle response and low-RPM but less top-end power.`;
                    impact.recommendations.push('Decrease main jet approximately by (delta × 4)');
                    impact.recommendations.push('Adjust all other jets proportionally');
                }
                break;

            case 'emulsionTube':
                impact.affectedRanges = ['mid-range', 'high-rpm'];
                impact.description = this.getEmulsionTubeDescription(oldValue, newValue);
                break;
        }

        return impact;
    }

    /**
     * Get description of emulsion tube characteristics
     */
    static getEmulsionTubeDescription(oldTube, newTube) {
        const tubes = {
            'F2': 'Racing tube - lean top-end, many small holes high up',
            'F9': 'Sport tube - balanced progression for street/track',
            'F11': 'Street performance - smooth gradual lean-out',
            'F15': 'Torquey tube - maintains richer mixture longer',
            'F16': 'Street touring - excellent manners, economy'
        };

        return `Changed to **${newTube}**: ${tubes[newTube] || 'Different progression curve'}`;
    }

    /**
     * Calculate overall mixture richness by RPM range
     */
    static calculateMixtureStatus(config) {
        const status = {
            idle: 'normal',
            transition: 'normal',
            midRange: 'normal',
            highRPM: 'normal'
        };

        // Idle circuit (idle jet dominates)
        if (config.idleJet > 60) status.idle = 'rich';
        else if (config.idleJet < 45) status.idle = 'lean';

        // Transition (overlap of idle and main)
        if (config.idleJet > 55 && config.mainJet > config.venturi * 4 + 5) {
            status.transition = 'rich';
        } else if (config.idleJet < 50 && config.mainJet < config.venturi * 4 - 5) {
            status.transition = 'lean';
        }

        // Mid-range (main jet + air corrector balance)
        const expectedMainJet = config.venturi * 4;
        if (config.mainJet > expectedMainJet + 10) {
            status.midRange = 'rich';
        } else if (config.mainJet < expectedMainJet - 10) {
            status.midRange = 'lean';
        }

        // High RPM (main jet vs air corrector)
        const airCorrectDiff = config.airCorrector - config.mainJet;
        if (airCorrectDiff < 40) {
            status.highRPM = 'rich';
        } else if (airCorrectDiff > 70) {
            status.highRPM = 'lean';
        }

        return status;
    }

    /**
     * Predict performance characteristics based on configuration
     */
    static getPerformanceCharacteristics(config) {
        const chars = {
            throttleResponse: 'normal',
            economy: 'average',
            powerDelivery: 'smooth',
            topEndPower: 'adequate'
        };

        // Throttle response (affected by venturi size and pump jet)
        if (config.venturi <= 32 && config.pumpJet >= 45) {
            chars.throttleResponse = 'snappy';
        } else if (config.venturi >= 38 || config.pumpJet <= 40) {
            chars.throttleResponse = 'sluggish';
        }

        // Economy (overall richness)
        const mixtureStatus = this.calculateMixtureStatus(config);
        const richCount = Object.values(mixtureStatus).filter(s => s === 'rich').length;
        const leanCount = Object.values(mixtureStatus).filter(s => s === 'lean').length;

        if (leanCount >= 2) chars.economy = 'good';
        else if (richCount >= 2) chars.economy = 'poor';

        // Power delivery (emulsion tube and jetting balance)
        if (config.emulsionTube === 'F2' || config.emulsionTube === 'F9') {
            chars.powerDelivery = 'peaky';
        } else if (config.emulsionTube === 'F16' || config.emulsionTube === 'F11') {
            chars.powerDelivery = 'smooth';
        }

        // Top end power (venturi size and main jet)
        if (config.venturi >= 36 && config.mainJet >= config.venturi * 4) {
            chars.topEndPower = 'strong';
        } else if (config.venturi <= 30) {
            chars.topEndPower = 'weak';
        }

        return chars;
    }

    /**
     * Get all warnings for a configuration
     */
    static getConfigurationWarnings(config) {
        const warnings = [];
        const mixtureStatus = this.calculateMixtureStatus(config);

        // Lean warnings (critical)
        if (mixtureStatus.midRange === 'lean') {
            warnings.push({
                severity: 'error',
                message: '⚠ DANGER: Lean mid-range - risk of engine damage under load!'
            });
        }
        if (mixtureStatus.highRPM === 'lean') {
            warnings.push({
                severity: 'error',
                message: '⚠ DANGER: Lean at high RPM - risk of piston damage!'
            });
        }

        // Idle warnings
        if (mixtureStatus.idle === 'lean' && config.idleJet < 45) {
            warnings.push({
                severity: 'warning',
                message: 'Idle jet very small - engine may not idle'
            });
        }
        if (mixtureStatus.idle === 'rich' && config.idleJet > 65) {
            warnings.push({
                severity: 'warning',
                message: 'Idle jet very large - may cause rich stumbling'
            });
        }

        // Rich warnings (less critical but noteworthy)
        if (mixtureStatus.midRange === 'rich') {
            warnings.push({
                severity: 'info',
                message: 'Rich mid-range - excess fuel consumption and possible fouling'
            });
        }

        return warnings;
    }

    /**
     * Generate comparison between two configurations
     */
    static compareConfigurations(baseline, modified) {
        const changes = [];

        const components = ['venturi', 'mainJet', 'airCorrector', 'idleJet', 'pumpJet', 'emulsionTube'];

        components.forEach(comp => {
            if (baseline[comp] !== modified[comp]) {
                const analysis = this.analyzeComponentChange(
                    comp,
                    baseline[comp],
                    modified[comp],
                    baseline
                );
                changes.push(analysis);
            }
        });

        return {
            changes,
            baselineMixture: this.calculateMixtureStatus(baseline),
            modifiedMixture: this.calculateMixtureStatus(modified),
            baselinePerformance: this.getPerformanceCharacteristics(baseline),
            modifiedPerformance: this.getPerformanceCharacteristics(modified),
            warnings: this.getConfigurationWarnings(modified)
        };
    }

    /**
     * Get available component values for stepping
     */
    static getAvailableValues(component) {
        const ranges = {
            mainJet: [90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200],
            airCorrector: [120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260],
            idleJet: [40, 45, 50, 55, 60, 65, 70],
            pumpJet: [35, 40, 45, 50, 55, 60],
            venturi: [28, 30, 32, 34, 36, 38, 40],
            emulsionTube: ['F2', 'F9', 'F11', 'F15', 'F16']
        };

        return ranges[component] || [];
    }

    /**
     * Get next/previous value for a component
     */
    static getNextValue(component, currentValue, direction = 1) {
        const available = this.getAvailableValues(component);

        if (component === 'emulsionTube') {
            const currentIndex = available.indexOf(currentValue);
            const newIndex = currentIndex + direction;
            if (newIndex >= 0 && newIndex < available.length) {
                return available[newIndex];
            }
            return currentValue;
        }

        // For numeric values
        const currentIndex = available.indexOf(currentValue);
        if (currentIndex === -1) {
            // If current value not in list, find closest
            return available.reduce((prev, curr) =>
                Math.abs(curr - currentValue) < Math.abs(prev - currentValue) ? curr : prev
            );
        }

        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < available.length) {
            return available[newIndex];
        }

        return currentValue;
    }
}

// SimulatorEngine export removed for standalone bundle

// ===== SIMULATOR FUNCTIONALITY =====
let simulatorBaseline = null;
let simulatorModified = null;

function initSimulator() {
    const loadFromCalcBtn = document.getElementById('load-from-calc');
    const loadFromPresetBtn = document.getElementById('load-from-preset');
    const resetBtn = document.getElementById('reset-simulator');

    loadFromCalcBtn.addEventListener('click', () => loadSimulatorBaseline('calculator'));
    loadFromPresetBtn.addEventListener('click', () => loadSimulatorBaseline('preset'));
    resetBtn.addEventListener('click', resetSimulator);
}

function loadSimulatorBaseline(source) {
    if (source === 'calculator' && currentConfig) {
        simulatorBaseline = {
            venturi: currentConfig.venturi,
            mainJet: currentConfig.mainJet,
            airCorrector: currentConfig.airCorrector,
            idleJet: currentConfig.idleJet,
            pumpJet: currentConfig.pumpJet,
            emulsionTube: currentConfig.emulsionTube
        };
        simulatorModified = { ...simulatorBaseline };
        displaySimulatorBaseline();
        showSimulatorControls();
    } else if (source === 'preset') {
        // Show preset selector
        const presetId = prompt('Enter preset ID (e.g., tr250-stock-cam):');
        const config = EXAMPLE_CONFIGS.find(c => c.id === presetId);
        if (config) {
            simulatorBaseline = {
                venturi: config.carbSetup.venturi,
                mainJet: config.carbSetup.mainJet,
                airCorrector: config.carbSetup.airCorrector,
                idleJet: config.carbSetup.idleJet,
                pumpJet: config.carbSetup.pumpJet,
                emulsionTube: config.carbSetup.emulsionTube
            };
            simulatorModified = { ...simulatorBaseline };
            displaySimulatorBaseline();
            showSimulatorControls();
        }
    }
}

function displaySimulatorBaseline() {
    const display = document.getElementById('baseline-display');
    display.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-md);">
            <div><strong>Venturi:</strong> ${simulatorBaseline.venturi}mm</div>
            <div><strong>Main Jet:</strong> ${simulatorBaseline.mainJet}</div>
            <div><strong>Air Corrector:</strong> ${simulatorBaseline.airCorrector}</div>
            <div><strong>Idle Jet:</strong> ${simulatorBaseline.idleJet}</div>
            <div><strong>Pump Jet:</strong> ${simulatorBaseline.pumpJet}</div>
            <div><strong>Emulsion Tube:</strong> ${simulatorBaseline.emulsionTube}</div>
        </div>
    `;
}

function showSimulatorControls() {
    document.getElementById('simulator-controls').style.display = 'block';
    document.getElementById('simulator-analysis').style.display = 'block';
    createComponentControls();
    updateSimulatorAnalysis();
}

function createComponentControls() {
    const grid = document.getElementById('controls-grid');
    const components = ['mainJet', 'airCorrector', 'idleJet', 'pumpJet', 'venturi'];

    grid.innerHTML = components.map(comp => `
        <div class="component-control">
            <label class="component-label">${formatComponentName(comp)}</label>
            <div class="component-adjuster">
                <button class="btn-adjust" onclick="adjustComponent('${comp}', -1)">−</button>
                <span class="current-value" id="val-${comp}">${simulatorModified[comp]}</span>
                <button class="btn-adjust" onclick="adjustComponent('${comp}', 1)">+</button>
            </div>
            <div class="impact-indicator" id="impact-${comp}">No change</div>
        </div>
    `).join('');
}

function formatComponentName(comp) {
    const names = {
        mainJet: 'Main Jet',
        airCorrector: 'Air Corrector',
        idleJet: 'Idle Jet',
        pumpJet: 'Pump Jet',
        venturi: 'Venturi'
    };
    return names[comp] || comp;
}

window.adjustComponent = function (component, direction) {
    const oldValue = simulatorModified[component];
    const newValue = SimulatorEngine.getNextValue(component, oldValue, direction);

    if (newValue !== oldValue) {
        simulatorModified[component] = newValue;
        document.getElementById(`val-${component}`).textContent = newValue;

        const impact = SimulatorEngine.analyzeComponentChange(component, oldValue, newValue, simulatorBaseline);
        displayComponentImpact(component, impact);
        updateSimulatorAnalysis();
    }
};

function displayComponentImpact(component, impact) {
    const indicator = document.getElementById(`impact-${component}`);
    indicator.innerHTML = impact.description;
    indicator.className = 'impact-indicator';

    if (impact.direction === 'increase') {
        indicator.classList.add('richer');
    } else {
        indicator.classList.add('leaner');
    }

    if (impact.warnings.length > 0) {
        indicator.classList.add('warning');
        indicator.innerHTML += '<br><strong>' + impact.warnings[0] + '</strong>';
    }
}

function updateSimulatorAnalysis() {
    updateMixtureStatus();
    updatePerformanceChars();
    updateComparison();
    updateWarnings();
}

function updateMixtureStatus() {
    const status = SimulatorEngine.calculateMixtureStatus(simulatorModified);
    const grid = document.getElementById('rpm-ranges-grid');

    grid.innerHTML = `
        <div class="rpm-range-item">
            <span class="rpm-range-label">Idle (900-2500 RPM)</span>
            <span class="mixture-indicator ${status.idle}">${status.idle.toUpperCase()}</span>
        </div>
        <div class="rpm-range-item">
            <span class="rpm-range-label">Transition (2500-3500)</span>
            <span class="mixture-indicator ${status.transition}">${status.transition.toUpperCase()}</span>
        </div>
        <div class="rpm-range-item">
            <span class="rpm-range-label">Mid-Range (3500-5500)</span>
            <span class="mixture-indicator ${status.midRange}">${status.midRange.toUpperCase()}</span>
        </div>
        <div class="rpm-range-item">
            <span class="rpm-range-label">High RPM (5500+)</span>
            <span class="mixture-indicator ${status.highRPM}">${status.highRPM.toUpperCase()}</span>
        </div>
    `;
}

function updatePerformanceChars() {
    const chars = SimulatorEngine.getPerformanceCharacteristics(simulatorModified);
    const grid = document.getElementById('performance-grid');

    grid.innerHTML = `
        <div class="performance-item">
            <span class="performance-label">Throttle Response</span>
            <div class="performance-value">${chars.throttleResponse}</div>
        </div>
        <div class="performance-item">
            <span class="performance-label">Fuel Economy</span>
            <div class="performance-value">${chars.economy}</div>
        </div>
        <div class="performance-item">
            <span class="performance-label">Power Delivery</span>
            <div class="performance-value">${chars.powerDelivery}</div>
        </div>
        <div class="performance-item">
            <span class="performance-label">Top-End Power</span>
            <div class="performance-value">${chars.topEndPower}</div>
        </div>
    `;
}

function updateComparison() {
    const tbody = document.getElementById('comparison-tbody');
    const components = ['venturi', 'mainJet', 'airCorrector', 'idleJet', 'pumpJet', 'emulsionTube'];

    tbody.innerHTML = components.map(comp => {
        const baseline = simulatorBaseline[comp];
        const modified = simulatorModified[comp];
        const changed = baseline !== modified;
        const delta = typeof baseline === 'number' ? modified - baseline : '';

        return `
            <tr class="${changed ? 'changed' : ''}">
                <td>${formatComponentName(comp)}</td>
                <td>${baseline}</td>
                <td class="${changed ? 'value-changed' : ''}">${modified}</td>
                <td>${changed && delta ? `<span class="comparison-delta">${delta > 0 ? '+' : ''}${delta}</span>` : '-'}</td>
            </tr>
        `;
    }).join('');
}

function updateWarnings() {
    const warnings = SimulatorEngine.getConfigurationWarnings(simulatorModified);
    const container = document.getElementById('simulator-warnings');

    if (warnings.length > 0) {
        container.style.display = 'block';
        container.innerHTML = warnings.map(w => `
            <div class="warning-item ${w.severity}">
                <span class="warning-icon">${w.severity === 'error' ? '⚠' : 'ℹ'}</span>
                <span class="warning-message">${w.message}</span>
            </div>
        `).join('');
    } else {
        container.style.display = 'none';
    }
}

function resetSimulator() {
    simulatorModified = { ...simulatorBaseline };
    createComponentControls();
    updateSimulatorAnalysis();
}

// ===== MISSING INITIALIZATION CODE =====

// ===== DOM READY =====
document.addEventListener('DOMContentLoaded', () => {
    if (typeof initTabs === 'function') initTabs();
    if (typeof initCalculatorForm === 'function') initCalculatorForm();
    if (typeof initExamplesTab === 'function') initExamplesTab();
    if (typeof initTroubleshootingTab === 'function') initTroubleshootingTab();
    if (typeof initTuningGuideTab === 'function') initTuningGuideTab();
    if (typeof initSimulator === 'function') initSimulator();
});

// ===== TAB NAVIGATION =====
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
    }

    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none'; // Ensure hidden
    });
    const tab = document.getElementById(`${tabName}-tab`);
    if (tab) {
        tab.classList.add('active');
        tab.style.display = 'block'; // Ensure visible
    }
}

// ===== CALCULATOR FORM =====
function initCalculatorForm() {
    const form = document.getElementById('engine-form');
    const presetSelect = document.getElementById('preset-select');

    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadPreset(e.target.value);
            }
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            calculateConfiguration();
        });
    }
}

function loadPreset(presetId) {
    if (typeof EXAMPLE_CONFIGS === 'undefined') return;
    const config = EXAMPLE_CONFIGS.find(c => c.id === presetId);
    if (!config) return;

    // Populate form with preset values
    setVal('displacement', config.engine.displacement);
    setVal('num-carbs', config.carbSetup.numberOfCarbs);
    setVal('compression', config.engine.compression);
    setVal('max-rpm', config.engine.maxRPM);
    setVal('cam-profile', config.engine.camProfile);
    setVal('usage', config.usage);
    setVal('venturi-override', config.carbSetup.venturi);

    // Auto-calculate
    calculateConfiguration();
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function calculateConfiguration() {
    if (typeof WeberCalculator === 'undefined') {
        console.error("WeberCalculator class missing");
        return;
    }
    // Get form values
    const displacement = parseInt(document.getElementById('displacement').value);
    const numCarbs = parseInt(document.getElementById('num-carbs').value);
    const compression = parseFloat(document.getElementById('compression').value);
    const maxRPM = parseInt(document.getElementById('max-rpm').value);
    const camProfile = document.getElementById('cam-profile').value;
    const usage = document.getElementById('usage').value;
    const throttleElements = document.getElementById('throttle-response');
    const throttleResponse = throttleElements ? throttleElements.value : 'normal';
    const venturiOverride = document.getElementById('venturi-override').value;

    // Validation
    if (!displacement || !compression || !maxRPM) {
        alert('Please fill in all required fields (displacement, compression, max RPM)');
        return;
    }

    // Build engine specs object
    const engineSpecs = {
        displacement,
        numCarbs,
        compression,
        maxRPM,
        camProfile,
        usage,
        throttleResponse
    };

    // Add venturi override if specified
    if (venturiOverride) {
        engineSpecs.venturiSize = parseInt(venturiOverride);
    }

    // Calculate configuration
    currentConfig = WeberCalculator.generateConfiguration(engineSpecs);

    // Display results
    displayResults(currentConfig, engineSpecs);
}

function displayResults(config, engineSpecs) {
    const container = document.getElementById('results-container');
    if (!container) return;

    const html = `
    <div class="results-grid">
      <div class="result-item">
        <div class="result-label">Venturi / Choke</div>
        <div class="result-value">${config.venturi}<span class="result-unit">mm</span></div>
      </div>
      <div class="result-item">
        <div class="result-label">Main Jet</div>
        <div class="result-value">${config.mainJet}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Air Corrector</div>
        <div class="result-value">${config.airCorrector}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Idle Jet</div>
        <div class="result-value">${config.idleJet}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Pump Jet</div>
        <div class="result-value">${config.pumpJet}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Emulsion Tube</div>
        <div class="result-value">${config.emulsionTube}</div>
      </div>
    </div>

    <div class="alert alert-warning">
      <strong>⚠ Important:</strong> These are starting point recommendations based on proven formulas. 
      Fine-tuning on a dyno and road testing are essential for optimal performance.
    </div>

    <h4>Emulsion Tube Info</h4>
    <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">
      <strong>${config.emulsionTube}:</strong> ${config.emulsionTubeDescription}<br>
      Alternative: ${config.emulsionTubeAlt}
    </p>

    <h4>Calculation Notes</h4>
    <ul class="notes-list">
      ${config.notes.map(note => `<li>${note}</li>`).join('')}
    </ul>

    <h4>Configuration Summary</h4>
    <p style="color: var(--color-text-secondary);">
      <strong>Engine:</strong> ${engineSpecs.displacement}cc, ${engineSpecs.compression}:1 CR, 
      ${engineSpecs.maxRPM} RPM max, ${engineSpecs.camProfile} cam<br>
      <strong>Setup:</strong> ${engineSpecs.numCarbs} × Weber 40 DCOE (${Math.round(engineSpecs.displacement / engineSpecs.numCarbs)}cc per carb)<br>
      <strong>Usage:</strong> ${engineSpecs.usage.charAt(0).toUpperCase() + engineSpecs.usage.slice(1)}
    </p>
  `;

    container.innerHTML = html;
}

// ===== EXAMPLE CONFIGS TAB =====
function initExamplesTab() {
    const filterUsage = document.getElementById('filter-usage');
    const filterVerified = document.getElementById('filter-verified');

    if (filterUsage) filterUsage.addEventListener('change', filterExamples);
    if (filterVerified) filterVerified.addEventListener('change', filterExamples);

    // Initial display
    if (typeof EXAMPLE_CONFIGS !== 'undefined') displayExamples(EXAMPLE_CONFIGS);
}

function filterExamples() {
    if (typeof EXAMPLE_CONFIGS === 'undefined') return;
    const usageFilter = document.getElementById('filter-usage').value;
    const verifiedFilter = document.getElementById('filter-verified').value;

    let filtered = EXAMPLE_CONFIGS;

    if (usageFilter) {
        filtered = filtered.filter(c => c.usage === usageFilter);
    }

    if (verifiedFilter === 'true') {
        filtered = filtered.filter(c => c.verified);
    }

    displayExamples(filtered);
}

function displayExamples(configs) {
    const container = document.getElementById('examples-container');
    if (!container) return;

    if (configs.length === 0) {
        container.innerHTML = '<p class="text-center" style="color: var(--color-text-tertiary); padding: var(--space-xl) 0;">No configurations match your filters.</p>';
        return;
    }

    const html = configs.map(config => `
    <div class="config-card" onclick="loadConfigToCalculator('${config.id}')">
      <div class="config-header">
        <div>
          <div class="config-title">${config.name}</div>
          <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-xs);">
            <span class="badge badge-${config.usage}">${config.usage}</span>
            ${config.verified ? '<span class="badge badge-verified">✓ Verified</span>' : ''}
          </div>
        </div>
      </div>
      
      <div class="config-specs">
        <span>${config.engine.displacement}cc</span>
        <span>•</span>
        <span>${config.engine.cylinders} cyl</span>
        <span>•</span>
        <span>${config.engine.compression}:1 CR</span>
        <span>•</span>
        <span>${config.carbSetup.numberOfCarbs}× DCOE</span>
      </div>
      
      <div class="config-jets">
        <span><strong>Venturi:</strong> ${config.carbSetup.venturi}mm</span>
        <span><strong>Main:</strong> ${config.carbSetup.mainJet}</span>
        <span><strong>Air:</strong> ${config.carbSetup.airCorrector}</span>
        <span><strong>Idle:</strong> ${config.carbSetup.idleJet}</span>
        <span><strong>Pump:</strong> ${config.carbSetup.pumpJet}</span>
        <span><strong>Emulsion:</strong> ${config.carbSetup.emulsionTube}</span>
      </div>
      
      ${config.notes ? `<p style="margin-top: var(--space-md); color: var(--color-text-secondary); font-size: 0.875rem;">${config.notes}</p>` : ''}
      
      <div class="config-source">
        <strong>Source:</strong> ${config.source}
      </div>
    </div>
  `).join('');

    container.innerHTML = html;
}

// Make function global for onclick handler
window.loadConfigToCalculator = function (configId) {
    switchTab('calculator');
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
        presetSelect.value = configId;
        loadPreset(configId);
    }
};

// ===== TROUBLESHOOTING TAB =====
function initTroubleshootingTab() {
    const searchInput = document.getElementById('symptom-search');
    const categoryButtons = document.querySelectorAll('[data-category]');

    // Search functionality
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (e.target.value.length >= 3) {
                    if (typeof searchBySymptom !== 'undefined') {
                        const results = searchBySymptom(e.target.value);
                        displayTroubleshootingResults(results);
                    }
                } else if (e.target.value.length === 0) {
                    displayAllTroubleshooting();
                }
            }, 300);
        });
    }

    // Category filtering
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update button states
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const category = button.dataset.category;
            if (category === 'all') {
                displayAllTroubleshooting();
            } else {
                displayTroubleshootingCategory(category);
            }
        });
    });

    // Initial display
    displayAllTroubleshooting();
}

function displayAllTroubleshooting() {
    if (typeof TROUBLESHOOTING_GUIDE === 'undefined') return;
    const container = document.getElementById('troubleshooting-container');
    if (!container) return;
    let html = '';

    Object.entries(TROUBLESHOOTING_GUIDE.categories).forEach(([key, category]) => {
        html += `<h3 style="margin-top: var(--space-xl); margin-bottom: var(--space-lg);">${category.name}</h3>`;
        html += category.problems.map(problem => renderProblemCard(problem)).join('');
    });

    container.innerHTML = html;
}

function displayTroubleshootingCategory(categoryKey) {
    if (typeof TROUBLESHOOTING_GUIDE === 'undefined') return;
    const container = document.getElementById('troubleshooting-container');
    const category = TROUBLESHOOTING_GUIDE.categories[categoryKey];

    if (!category || !container) return;

    const html = category.problems.map(problem => renderProblemCard(problem)).join('');
    container.innerHTML = html;
}

function displayTroubleshootingResults(results) {
    const container = document.getElementById('troubleshooting-container');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<p class="text-center" style="color: var(--color-text-tertiary); padding: var(--space-xl) 0;">No results found. Try different keywords.</p>';
        return;
    }

    const html = results.map(problem => renderProblemCard(problem)).join('');
    container.innerHTML = html;
}

function renderProblemCard(problem) {
    return `
    <div class="problem-card">
      <div class="problem-symptom">
        ${problem.symptom}
      </div>
      
      ${problem.warning ? `<div class="alert alert-danger">${problem.warning}</div>` : ''}
      
      <div class="problem-section">
        <h5>Possible Causes</h5>
        <ul>
          ${problem.possibleCauses.map(cause => `<li>${cause}</li>`).join('')}
        </ul>
      </div>
      
      <div class="problem-section">
        <h5>Solutions</h5>
        <ul>
          ${problem.solutions.map(solution => `<li>${solution}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

// ===== TUNING GUIDE TAB =====
function initTuningGuideTab() {
    displayTuningProcedure();
    displayQuickReference();
}

function displayTuningProcedure() {
    if (typeof TROUBLESHOOTING_GUIDE === 'undefined') return;
    const container = document.getElementById('tuning-procedure-container');
    if (!container) return;
    const procedure = TROUBLESHOOTING_GUIDE.tuningProcedure;

    const html = `
    <p style="color: var(--color-text-secondary); margin-bottom: var(--space-xl);">
      Follow this systematic approach for best tuning results. Don't skip steps!
    </p>
    
    ${procedure.steps.map(step => `
      <div style="margin-bottom: var(--space-xl);">
        <h3>Step ${step.step}: ${step.name}</h3>
        <ul class="notes-list">
          ${step.tasks.map(task => `<li>${task}</li>`).join('')}
        </ul>
      </div>
    `).join('')}
  `;

    container.innerHTML = html;
}

function displayQuickReference() {
    if (typeof TROUBLESHOOTING_GUIDE === 'undefined') return;
    const container = document.getElementById('quick-reference-container');
    if (!container) return;
    const reference = TROUBLESHOOTING_GUIDE.quickReference;

    const html = `
    <ul class="notes-list">
      ${reference.rules.map(rule => `<li>${rule}</li>`).join('')}
    </ul>
  `;

    container.innerHTML = html;
}

// ===== SIMULATOR FUNCTIONALITY =====
function initSimulator() {
    const loadFromCalcBtn = document.getElementById('load-from-calc');
    const loadFromPresetBtn = document.getElementById('load-from-preset');
    const resetBtn = document.getElementById('reset-simulator');

    if (loadFromCalcBtn) loadFromCalcBtn.addEventListener('click', () => loadSimulatorBaseline('calculator'));
    if (loadFromPresetBtn) loadFromPresetBtn.addEventListener('click', () => loadSimulatorBaseline('preset'));
    if (resetBtn) resetBtn.addEventListener('click', resetSimulator); // resetSimulator is in existing file
}

function loadSimulatorBaseline(source) {
    if (source === 'calculator' && currentConfig) {
        simulatorBaseline = {
            venturi: currentConfig.venturi,
            mainJet: currentConfig.mainJet,
            airCorrector: currentConfig.airCorrector,
            idleJet: currentConfig.idleJet,
            pumpJet: currentConfig.pumpJet,
            emulsionTube: currentConfig.emulsionTube
        };
        simulatorModified = { ...simulatorBaseline };
        displaySimulatorBaseline();
        showSimulatorControls();
    } else if (source === 'preset') {
        // Show preset selector
        const presetId = prompt('Enter preset ID (e.g., tr250-stock-cam):');
        if (!EXAMPLE_CONFIGS) return;
        const config = EXAMPLE_CONFIGS.find(c => c.id === presetId);
        if (config) {
            simulatorBaseline = {
                venturi: config.carbSetup.venturi,
                mainJet: config.carbSetup.mainJet,
                airCorrector: config.carbSetup.airCorrector,
                idleJet: config.carbSetup.idleJet,
                pumpJet: config.carbSetup.pumpJet,
                emulsionTube: config.carbSetup.emulsionTube
            };
            simulatorModified = { ...simulatorBaseline };
            displaySimulatorBaseline();
            showSimulatorControls();
        }
    }
}

function displaySimulatorBaseline() {
    const display = document.getElementById('baseline-display');
    if (!display) return;

    // Use simulatorBaseline which should be global (defined in existing file?)
    // The existing file had 'let simulatorBaseline = null;' logic?
    // No, I saw lines 1527 'const baseline = simulatorBaseline[comp];'.
    // But where is it defined?
    // It was defined at top of my viewed file, line 14: 'let simulatorBaseline = null;'
    // If 'app-standalone.js' is incomplete, maybe I should define it?
    // But I don't want to redefine if it's there.
    // It's safer to rely on it being loosely typed.

    if (!simulatorBaseline) return;

    display.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-md);">
            <div><strong>Venturi:</strong> ${simulatorBaseline.venturi}mm</div>
            <div><strong>Main Jet:</strong> ${simulatorBaseline.mainJet}</div>
            <div><strong>Air Corrector:</strong> ${simulatorBaseline.airCorrector}</div>
            <div><strong>Idle Jet:</strong> ${simulatorBaseline.idleJet}</div>
            <div><strong>Pump Jet:</strong> ${simulatorBaseline.pumpJet}</div>
            <div><strong>Emulsion Tube:</strong> ${simulatorBaseline.emulsionTube}</div>
        </div>
    `;
}

function showSimulatorControls() {
    const simControls = document.getElementById('simulator-controls');
    const simAnalysis = document.getElementById('simulator-analysis');
    if (simControls) simControls.style.display = 'block';
    if (simAnalysis) simAnalysis.style.display = 'block';
    createComponentControls();
    if (typeof updateSimulatorAnalysis === 'function') updateSimulatorAnalysis();
}

function createComponentControls() {
    const grid = document.getElementById('controls-grid');
    if (!grid) return;
    const components = ['mainJet', 'airCorrector', 'idleJet', 'pumpJet', 'venturi'];

    grid.innerHTML = components.map(comp => `
        <div class="component-control">
            <label class="component-label">${formatComponentName(comp)}</label>
            <div class="component-adjuster">
                <button class="btn-adjust" onclick="adjustComponent('${comp}', -1)">−</button>
                <span class="current-value" id="val-${comp}">${simulatorModified[comp]}</span>
                <button class="btn-adjust" onclick="adjustComponent('${comp}', 1)">+</button>
            </div>
            <div class="impact-indicator" id="impact-${comp}">No change</div>
        </div>
    `).join('');
}

function formatComponentName(comp) {
    const names = {
        mainJet: 'Main Jet',
        airCorrector: 'Air Corrector',
        idleJet: 'Idle Jet',
        pumpJet: 'Pump Jet',
        venturi: 'Venturi'
    };
    return names[comp] || comp;
}

window.adjustComponent = function (component, direction) {
    if (typeof SimulatorEngine === 'undefined') return;
    const oldValue = simulatorModified[component];
    const newValue = SimulatorEngine.getNextValue(component, oldValue, direction);

    if (newValue !== oldValue) {
        simulatorModified[component] = newValue;
        document.getElementById(`val-${component}`).textContent = newValue;

        const impact = SimulatorEngine.analyzeComponentChange(component, oldValue, newValue, simulatorBaseline);
        displayComponentImpact(component, impact);
        updateSimulatorAnalysis();
    }
};

function displayComponentImpact(component, impact) {
    const indicator = document.getElementById(`impact-${component}`);
    if (!indicator) return;

    indicator.innerHTML = impact.description;
    indicator.className = 'impact-indicator';

    if (impact.direction === 'increase') {
        indicator.classList.add('richer');
    } else {
        indicator.classList.add('leaner');
    }

    if (impact.warnings.length > 0) {
        indicator.classList.add('warning');
        indicator.innerHTML += '<br><strong>' + impact.warnings[0] + '</strong>';
    }
}

function updateSimulatorAnalysis() {
    updateMixtureStatus();
    updatePerformanceChars();
    if (typeof updateComparison === 'function') updateComparison();
    if (typeof updateWarnings === 'function') updateWarnings();
}

function updateMixtureStatus() {
    if (typeof SimulatorEngine === 'undefined') return;
    const status = SimulatorEngine.calculateMixtureStatus(simulatorModified);
    const grid = document.getElementById('rpm-ranges-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="rpm-range-item">
            <span class="rpm-range-label">Idle (900-2500 RPM)</span>
            <span class="mixture-indicator ${status.idle}">${status.idle.toUpperCase()}</span>
        </div>
        <div class="rpm-range-item">
            <span class="rpm-range-label">Transition (2500-3500)</span>
            <span class="mixture-indicator ${status.transition}">${status.transition.toUpperCase()}</span>
        </div>
        <div class="rpm-range-item">
            <span class="rpm-range-label">Mid-Range (3500-5500)</span>
            <span class="mixture-indicator ${status.midRange}">${status.midRange.toUpperCase()}</span>
        </div>
        <div class="rpm-range-item">
            <span class="rpm-range-label">High RPM (5500+)</span>
            <span class="mixture-indicator ${status.highRPM}">${status.highRPM.toUpperCase()}</span>
        </div>
    `;
}

// updatePerformanceChars is apparently in the file (lines 1500-1520 in view_file).
// Wait, I saw 'grid.innerHTML = ...' and 'function updateComparison' (line 1522).
// The view started at 1500. It did NOT show `function updatePerformanceChars`.
// It showed the *body* of a function?
// "grid.innerHTML = ..."
// And then "}" at 1520.
// So `updatePerformanceChars` WAS defined but the function signature line was before 1500.
// So I should NOT add `updatePerformanceChars`.
// I will remove it from my code to append.

