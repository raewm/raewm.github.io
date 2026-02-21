// js/controls.js — Incremental analog input
// Swing: non-centering — arrow keys increment target velocity and it HOLDS.
// Ladder: up/down arrow keys. Cutter: W/S. Pump: E/D.

import { dredge } from './dredge.js';
import { triggerStep } from './physics.js';

const keys = {};

window.addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT') return;
    const wasDown = keys[e.code];
    keys[e.code] = true;

    // Prevent page scroll for arrow keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();

    // Single-fire actions on first press only
    if (!wasDown) {
        if (e.code === 'Escape') dredge.estop = !dredge.estop;
        if (e.code === 'Space') triggerStep();
    }
});

window.addEventListener('keyup', e => { keys[e.code] = false; });

// ─── Rate constants ───────────────────────────────────────────────────────
const SWING_STEP = 0.001;   // rad/s per key press — ramps to max in ~0.5s
const LADDER_RATE = 5.0;     // deg/s
const CUTTER_RATE = 8.0;     // RPM/s
const PUMP_RATE = 60.0;    // RPM/s

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function updateControls(dt) {
    if (dredge.estop) return;

    // ── Swing: ArrowLeft/Right → increment swingTarget, NO auto-center
    if (keys['ArrowLeft']) dredge.swingTarget = clamp(dredge.swingTarget - SWING_STEP, -dredge.swingMaxVel, dredge.swingMaxVel);
    if (keys['ArrowRight']) dredge.swingTarget = clamp(dredge.swingTarget + SWING_STEP, -dredge.swingMaxVel, dredge.swingMaxVel);
    // (No else — slider/value holds when keys released)

    // ── Ladder: ArrowUp / ArrowDown
    if (keys['ArrowUp']) dredge.ladderWinchTarget = clamp(dredge.ladderWinchTarget - LADDER_RATE * dt, 2, 75);
    if (keys['ArrowDown']) dredge.ladderWinchTarget = clamp(dredge.ladderWinchTarget + LADDER_RATE * dt, 2, 75);

    // ── Cutter: W / S
    if (keys['KeyW']) dredge.cutterRPMTarget = clamp(dredge.cutterRPMTarget + CUTTER_RATE * dt, 0, dredge.cutterRPMMax);
    if (keys['KeyS']) dredge.cutterRPMTarget = clamp(dredge.cutterRPMTarget - CUTTER_RATE * dt, 0, dredge.cutterRPMMax);

    // ── Pump: E / D
    if (keys['KeyE']) dredge.pumpRPMTarget = clamp(dredge.pumpRPMTarget + PUMP_RATE * dt, 0, dredge.pumpRPMMax);
    if (keys['KeyD']) dredge.pumpRPMTarget = clamp(dredge.pumpRPMTarget - PUMP_RATE * dt, 0, dredge.pumpRPMMax);

    pollGamepad(dt);
}

function pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[0]; if (!gp) return;

    // Left stick X = swing (analog, position-mapped)
    const lx = applyDead(gp.axes[0], 0.10);
    if (Math.abs(lx) > 0.01) dredge.swingTarget = lx * dredge.swingMaxVel;

    // Right stick Y = ladder (incremental)
    const ry = applyDead(gp.axes[3], 0.10);
    dredge.ladderWinchTarget = clamp(dredge.ladderWinchTarget + ry * LADDER_RATE * dt, 2, 75);

    // D-pad up/down = cutter
    if (gp.buttons[12]?.pressed) dredge.cutterRPMTarget = clamp(dredge.cutterRPMTarget + CUTTER_RATE * dt, 0, dredge.cutterRPMMax);
    if (gp.buttons[13]?.pressed) dredge.cutterRPMTarget = clamp(dredge.cutterRPMTarget - CUTTER_RATE * dt, 0, dredge.cutterRPMMax);

    // D-pad right/left = pump
    if (gp.buttons[15]?.pressed) dredge.pumpRPMTarget = clamp(dredge.pumpRPMTarget + PUMP_RATE * dt, 0, dredge.pumpRPMMax);
    if (gp.buttons[14]?.pressed) dredge.pumpRPMTarget = clamp(dredge.pumpRPMTarget - PUMP_RATE * dt, 0, dredge.pumpRPMMax);

    // A = step, B = estop
    if (gp.buttons[0]?.pressed && !gp._prevA) triggerStep();
    gp._prevA = gp.buttons[0]?.pressed;
    if (gp.buttons[1]?.pressed && !gp._prevB) dredge.estop = !dredge.estop;
    gp._prevB = gp.buttons[1]?.pressed;
}

function applyDead(v, d) {
    if (Math.abs(v) < d) return 0;
    return (v - Math.sign(v) * d) / (1 - d);
}

// Slider setters (called from HTML inputs)
export const setSwingFromSlider = v => { dredge.swingTarget = parseFloat(v); };
export const setLadderFromSlider = v => { dredge.ladderWinchTarget = parseFloat(v); };
export const setCutterFromSlider = v => { dredge.cutterRPMTarget = parseFloat(v); };
export const setPumpFromSlider = v => { dredge.pumpRPMTarget = parseFloat(v); };
