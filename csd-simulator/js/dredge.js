// js/dredge.js — CSD vessel state
// RIGID BODY SWING: the entire vessel pivots around the working spud.
// All units INTERNAL: ft, PSI, cubic yards, tons, ft/s

export const dredge = {
    // ─── Spud (world pivot) ────────────────────────────────────────────────────
    spud: {
        working: { down: true },
        auxiliary: { down: false },
    },
    spudCarriageOffset: 0,      // ft, 0–12 per stroke
    spudCarriageMax: 12,
    steppingState: 'IDLE',      // 'IDLE'|'LOWERING_AUX'|'RAISING_WORK'|'ADVANCING'|'LOWERING_WORK'|'RAISING_AUX'
    steppingTimer: 0,

    // ─── Swing (entire vessel rotates around spud) ────────────────────────────
    swingAngle: 0,        // radians, 0 = straight ahead, +SB, -PS
    swingLimitRad: 0.96,     // ≈ 55° each side
    swingVelocityRadS: 0,       // rad/s
    swingTarget: 0,       // operator setpoint (rad/s)
    swingMaxVel: 0.0292,  // rad/s ≈ 100 deg/min (real CSD spec)

    // ─── Ladder (depth only — vertical angle, does NOT affect plan-view heading) ──
    ladderAngleDeg: 22,     // 0=horiz, 75=steep; controls cut depth
    ladderWinchTarget: 22,
    ladderWinchRate: 6,      // deg/s

    // Plan-view geometry constants (in canvas pixels, set by planview)
    HULL_H_PX: 80,    // spud-to-bow distance in pixels
    LADDER_PX: 130,   // bow-to-cutter distance in pixels
    get TOTAL_PX() { return this.HULL_H_PX + this.LADDER_PX; },

    // Physical lengths (ft) — used by physics for production calc
    ladderLengthFt: 60,
    get cutterDepthFt() {
        return this.ladderLengthFt * Math.sin(this.ladderAngleDeg * Math.PI / 180);
    },

    // ─── Cutter Head ──────────────────────────────────────────────────────────
    cutterRPM: 0,
    cutterRPMTarget: 0,
    cutterRPMMax: 40,
    cutterRPMRate: 4,
    cutterRotation: 0,

    // ─── Pump ─────────────────────────────────────────────────────────────────
    pumpRPM: 0,
    pumpRPMTarget: 0,
    pumpRPMMax: 800,
    pumpRPMRate: 30,
    pipelineLengthFt: 3000,

    // ─── Instruments ──────────────────────────────────────────────────────────
    instruments: {
        swingWinchPSI: 0,
        ladderWinchPSI: 0,
        cutterPSI: 0,
        depthFt: 0,
        velocityFtS: 0,
        densitySG: 1.025,
        productionCYH: 0,
        productionTonH: 0,
        totalCY: 0,
        totalTons: 0,
        pumpVacuumPSI: 0,
        pumpDischargePSI: 0,
        glandPSI: 0,
        swingWidthFt: 0,
        pumpEffort: 0,    // 0–1 — drives swing/vacuum response
    },

    // ─── Enables ──────────────────────────────────────────────────────────────
    estop: false,
    pumpsEnabled: true,
    cutterEnabled: true,

    // ─── Design constants ─────────────────────────────────────────────────────
    pipeDiameterFt: 1.5,
    soilSG: 2.65,
    waterSG: 1.025,
};
