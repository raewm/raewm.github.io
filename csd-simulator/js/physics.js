// js/physics.js — CSD hydraulic/cutting simulation
// EMA smoothing on all gauge outputs. Correct PSI scales. Proper pump work model.

import { dredge } from './dredge.js';

const PIPE_AREA_FT2 = Math.PI * (dredge.pipeDiameterFt / 2) ** 2;

let _soil = null;
export function setSoil(si) { _soil = si; }
const defaultSoil = { cut: () => 0, getHardnessAt: () => 0.4 };
const getSoil = () => _soil || defaultSoil;

function slew(cur, tgt, rate, dt) {
    const d = tgt - cur; const s = rate * dt;
    return Math.abs(d) <= s ? tgt : cur + Math.sign(d) * s;
}

// Exponential moving average — smooths jumpy gauge outputs
// tau = time constant in seconds; small tau = fast response, large = slow/smooth
function ema(prev, next, dt, tau = 2.0) {
    const alpha = dt / (dt + tau);
    return prev + alpha * (next - prev);
}

// ─── Step: instant advance, no animation ─────────────────────────────────────
// STEP_ROWS is set in planview.js (currently 2 rows = ~24px ≈ cutter diameter).
// triggerStep just calls shiftGridStep immediately — no FSM delay.
import { shiftGridStep } from './planview.js';

export function triggerStep() {
    if (dredge.steppingState !== 'IDLE') return;
    shiftGridStep();
    // Brief status flash so operator sees it happened
    dredge.steppingState = 'ADVANCING';
    dredge.steppingTimer = 0;
}

function stepMachine(dt) {
    if (dredge.steppingState === 'IDLE') return;
    dredge.steppingTimer += dt;
    if (dredge.steppingTimer > 0.25) {
        dredge.steppingState = 'IDLE';
        dredge.steppingTimer = 0;
    }
}


// ─── Main tick ────────────────────────────────────────────────────────────────
export function physicsTick(dt) {
    if (dredge.estop) {
        dredge.cutterRPMTarget = 0; dredge.pumpRPMTarget = 0; dredge.swingTarget = 0;
    }

    // Slew RPMs
    dredge.cutterRPM = slew(dredge.cutterRPM, dredge.cutterEnabled ? dredge.cutterRPMTarget : 0, dredge.cutterRPMRate, dt);
    dredge.pumpRPM = slew(dredge.pumpRPM, dredge.pumpsEnabled ? dredge.pumpRPMTarget : 0, dredge.pumpRPMRate, dt);

    // Ladder
    dredge.ladderAngleDeg = slew(dredge.ladderAngleDeg, dredge.ladderWinchTarget, dredge.ladderWinchRate, dt);
    dredge.ladderAngleDeg = Math.max(2, Math.min(75, dredge.ladderAngleDeg));

    // Swing (rigid body)
    dredge.swingVelocityRadS = slew(dredge.swingVelocityRadS, dredge.swingTarget, 0.04, dt);
    dredge.swingAngle += dredge.swingVelocityRadS * dt;
    dredge.swingAngle = Math.max(-dredge.swingLimitRad, Math.min(dredge.swingLimitRad, dredge.swingAngle));
    if (Math.abs(dredge.swingAngle) >= dredge.swingLimitRad - 0.005) dredge.swingTarget = 0;

    dredge.cutterRotation += (dredge.cutterRPM / 60) * 2 * Math.PI * dt;

    // ── Soil & cutting ────────────────────────────────────────────────────────
    const soil = getSoil();
    const hardness = soil.getHardnessAt(dredge.swingAngle);

    let cuttingRate = 0;
    if (dredge.cutterRPM > 2 && Math.abs(dredge.swingVelocityRadS) > 0.001) {
        cuttingRate = soil.cut(dredge.swingAngle, dredge.cutterDepthFt, dredge.cutterRPM, dredge.swingVelocityRadS, dt);
    }

    // ── Pump flow & slurry ────────────────────────────────────────────────────
    const pumpFrac = dredge.pumpRPM / dredge.pumpRPMMax;
    const maxFlowFtS = 22;
    const velocityFtS = pumpFrac * maxFlowFtS;
    const volFt3S = velocityFtS * PIPE_AREA_FT2;
    const volCYS = volFt3S / 27;

    // ── Cv from operating conditions ─────────────────────────────────────────
    const cutterFrac = dredge.cutterRPM / dredge.cutterRPMMax;
    // Swing fraction vs new (slow) max vel reference
    const swingFrac = Math.min(1, Math.abs(dredge.swingVelocityRadS) / dredge.swingMaxVel);
    const depthFrac = Math.min(1, dredge.cutterDepthFt / 15);
    // Max Cv ~28% in best conditions (hard material, full RPM, full swing, deep)
    const CvTarget = cutterFrac * swingFrac * depthFrac * (0.05 + hardness * 0.23);
    const Cv = CvTarget;    // written to I.densitySG via EMA below
    const mixSGRaw = dredge.waterSG + Cv * (dredge.soilSG - dredge.waterSG);

    // ── Pump load physics ─────────────────────────────────────────────────────
    // Real CSD: pump works hardest when:
    //   1) Slurry is dense (high Cv) → higher discharge PSI (friction × density)
    //   2) Cutter is deep → higher vacuum (more lift head)
    //   3) Material is hard → cutter stalls, swing stresses increase
    //
    // Pump sags in RPM when hydraulic power demanded > available motor power
    const pumpPowerFrac = Cv * 2.5 + (1 - Cv) * 0.30;   // 0.3 unloaded → 1.0 at Cv=28%
    const pumpEffort = Math.min(1, pumpPowerFrac);

    // Pipeline friction head (Darcy-Weisbach simplified)
    const Re_loss = 0.018 * (dredge.pipelineLengthFt / dredge.pipeDiameterFt);
    const velHead = velocityFtS ** 2 / (2 * 32.174);
    const fricPSI = Re_loss * velHead * mixSGRaw * 62.4 / 144;

    // Vacuum: hydrostatic head of slurry column from cutter to pump
    // Ranges from ~-8 PSI (water, 15ft depth) to ~-18 PSI (dense slurry, deep)
    const staticHead = dredge.cutterDepthFt * mixSGRaw * 62.4 / 144;
    const velLoss = velHead * mixSGRaw * 62.4 / 144 * 0.5;
    const vacRaw = -(staticHead + velLoss);
    const vacClamped = Math.max(-20, Math.min(5, vacRaw));

    // Discharge: friction + static lift
    const dischRaw = Math.max(0, fricPSI + staticHead * 0.3);
    const dischClamped = Math.min(150, dischRaw);

    // ── Winch & cutter PSI — correctly tied to actual work done ───────────────────────────
    //
    // SWING WINCH: only loads when swinging through uncut material (hardness > 0).
    //   Zero when dredge is over already-dug water; high when swinging into hard soil.
    const swingFracAbs = Math.min(1, Math.abs(dredge.swingVelocityRadS) / dredge.swingMaxVel);
    const swingPSIraw = swingFracAbs * hardness * (600 + hardness * 1800)
        + swingFracAbs * pumpEffort * 200
        + (Math.random() * 50 - 25);

    // LADDER WINCH: static gravity/buoyancy hold + large spike only when actively
    //   lowering the ladder into uncut material (plunge cutting).
    const isLoweringLadder = dredge.ladderWinchTarget > dredge.ladderAngleDeg + 0.5;
    const ladderHoldPSI = 250 + (dredge.ladderAngleDeg / 75) * 350;  // static weight
    const ladderDugPSI = isLoweringLadder ? hardness * 2200 : 0;    // plunge load
    const ladderPSIraw = ladderHoldPSI + ladderDugPSI + (Math.random() * 40 - 20);

    // CUTTER MOTOR: always loads with RPM × hardness (regardless of swing/plunge)
    const cutterPSIraw = cutterFrac * (300 + hardness * 2400) + (Math.random() * 80 - 40);

    // ── Production ────────────────────────────────────────────────────────────
    const momentaryCYH = Cv * volFt3S * 3600 / 27;
    const momentaryTonH = momentaryCYH * dredge.soilSG * 0.9144;

    // ── Pump RPM sag: at high load, motor can't maintain speed ───────────────
    // Simulate: actual RPM = target RPM × (1 - pumpEffort × 0.15)
    // This is already handled by the pumpRPM instrument — we just read dredge.pumpRPM
    // The physics slew already smooths it, so it will track naturally.

    // ── Swing width in ft ─────────────────────────────────────────────────────
    const swingWidthFt = Math.sin(dredge.swingAngle) * (dredge.ladderLengthFt + 30);

    // ── Write instruments with EMA smoothing (prevents jumpy gauges) ──────────
    const I = dredge.instruments;
    I.swingWinchPSI = ema(I.swingWinchPSI, Math.max(0, swingPSIraw), dt, 0.8);
    I.ladderWinchPSI = ema(I.ladderWinchPSI, Math.max(0, ladderPSIraw), dt, 1.0);
    I.cutterPSI = ema(I.cutterPSI, Math.max(0, cutterPSIraw), dt, 0.6);
    I.depthFt = dredge.cutterDepthFt;
    I.velocityFtS = ema(I.velocityFtS, velocityFtS, dt, 1.5);
    I.densitySG = ema(I.densitySG, mixSGRaw, dt, 2.5);  // slow — shows gradual density change
    I.productionCYH = ema(I.productionCYH, momentaryCYH, dt, 2.0);
    I.productionTonH = ema(I.productionTonH, momentaryTonH, dt, 2.0);
    I.totalCY += momentaryCYH * dt / 3600;
    I.totalTons += momentaryTonH * dt / 3600;
    I.pumpVacuumPSI = ema(I.pumpVacuumPSI, vacClamped, dt, 1.2);
    I.pumpDischargePSI = ema(I.pumpDischargePSI, dischClamped, dt, 1.2);
    I.swingWidthFt = swingWidthFt;
    I.pumpEffort = ema(I.pumpEffort, pumpEffort, dt, 1.5);

    stepMachine(dt);
}
