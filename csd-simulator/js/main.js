// js/main.js — CSD Simulator entry point and main loop

import { dredge } from './dredge.js';
import { setSoil, physicsTick, triggerStep } from './physics.js';
import { updateControls, setSwingFromSlider, setLadderFromSlider, setCutterFromSlider, setPumpFromSlider } from './controls.js';
import { drawPlanView, markDirty, soil } from './planview.js';
import { drawBridgeView } from './bridgeview.js';
import { drawAnalogGauge, drawDepthBar, drawSwingBar, drawProductionPanel, drawPumpRPMGauge } from './gauges.js';

setSoil(soil);

// ─── Canvas refs ──────────────────────────────────────────────────────────
const planCanvas = document.getElementById('planCanvas');
const bridgeCanvas = document.getElementById('bridgeCanvas');
const rightCanvas = document.getElementById('rightCanvas');
const gaugeCanvas = document.getElementById('gaugeCanvas');

const planCtx = planCanvas.getContext('2d');
const bridgeCtx = bridgeCanvas.getContext('2d');
const rightCtx = rightCanvas.getContext('2d');
const gaugeCtx = gaugeCanvas.getContext('2d');

// ─── Resize ───────────────────────────────────────────────────────────────
function resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const winH = Math.floor(H * 0.56);
    const sideW = Math.floor(W * 0.20);
    const cenW = W - sideW * 2 - 16;

    planCanvas.width = sideW; planCanvas.height = winH;
    bridgeCanvas.width = cenW; bridgeCanvas.height = winH;
    rightCanvas.width = sideW; rightCanvas.height = winH;

    gaugeCanvas.width = W;
    gaugeCanvas.height = gaugeCanvas.offsetHeight || Math.floor(H * 0.28);
}
resize();
window.addEventListener('resize', resize);

// ─── Slider wiring ────────────────────────────────────────────────────────
document.getElementById('slSwing')?.addEventListener('input', e => setSwingFromSlider(parseFloat(e.target.value)));
document.getElementById('slLadder')?.addEventListener('input', e => setLadderFromSlider(parseFloat(e.target.value)));
document.getElementById('slCutter')?.addEventListener('input', e => setCutterFromSlider(parseFloat(e.target.value)));
document.getElementById('slPump')?.addEventListener('input', e => setPumpFromSlider(parseFloat(e.target.value)));

function syncSliders() {
    const map = { slSwing: dredge.swingTarget, slLadder: dredge.ladderWinchTarget, slCutter: dredge.cutterRPMTarget, slPump: dredge.pumpRPMTarget };
    for (const [id, v] of Object.entries(map)) { const el = document.getElementById(id); if (el) el.value = v; }
}

// ─── Buttons ──────────────────────────────────────────────────────────────
const btnEstop = document.getElementById('btnEstop');
btnEstop?.addEventListener('click', () => {
    dredge.estop = !dredge.estop;
    btnEstop.textContent = dredge.estop ? '▶ RESUME' : '⛔ E-STOP';
    btnEstop.classList.toggle('estop-active', dredge.estop);
});
document.getElementById('btnStep')?.addEventListener('click', () => {
    if (dredge.steppingState === 'IDLE') triggerStep();
});

// ─── Gauge draw ───────────────────────────────────────────────────────────
function drawGauges() {
    const ctx = gaugeCtx;
    const W = gaugeCanvas.width;
    const H = gaugeCanvas.height || 180;
    const I = dredge.instruments;

    ctx.clearRect(0, 0, W, H);

    // Wood panel background
    const wg = ctx.createLinearGradient(0, 0, 0, H);
    wg.addColorStop(0, '#3e2808'); wg.addColorStop(0.12, '#4e3010'); wg.addColorStop(0.9, '#3b2508'); wg.addColorStop(1, '#2a1a05');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 7, H); ctx.stroke(); }
    // Top chrome trim
    const tm = ctx.createLinearGradient(0, 0, 0, 5);
    tm.addColorStop(0, '#bbb'); tm.addColorStop(1, '#555');
    ctx.fillStyle = tm; ctx.fillRect(0, 0, W, 5);

    // ── Swing bar ────────────────────────────────────────────────────────
    const swBarH = Math.max(16, Math.floor(H * 0.13));
    drawSwingBar(ctx, 60, 10, W - 120, swBarH, I.swingWidthFt, 65);

    // ── Gauge row ─────────────────────────────────────────────────────────
    const gTop = 10 + swBarH + 8;
    const gH = H - gTop - 6;
    const gR = Math.floor(Math.min(gH * 0.48, W / 22));
    const SLOTS = 9;
    const slotW = W / SLOTS;
    const gCY = gTop + gH / 2;
    const gx = i => Math.floor(slotW * (i + 0.5));

    // 1. Swing Winch
    drawAnalogGauge(ctx, gx(0), gCY, gR, I.swingWinchPSI, 0, 3500, 'SWING WINCH', 'PSI', { redZone: { from: 0.80, to: 1 }, warnZone: { from: 0.65, to: 0.80 } });
    // 2. Ladder Winch
    drawAnalogGauge(ctx, gx(1), gCY, gR, I.ladderWinchPSI, 0, 3500, 'LADDER WINCH', 'PSI', { redZone: { from: 0.80, to: 1 }, warnZone: { from: 0.65, to: 0.80 } });
    // 3. Cutter Pressure
    drawAnalogGauge(ctx, gx(2), gCY, gR, I.cutterPSI, 0, 3500, 'CUTTER PRESS', 'PSI', { redZone: { from: 0.85, to: 1 }, warnZone: { from: 0.70, to: 0.85 } });
    // 4. Depth bar
    const dbW = Math.floor(slotW * 0.38);
    drawDepthBar(ctx, gx(3) - dbW / 2, gTop + 14, dbW, gH - 28, I.depthFt, 35, 'DEPTH');
    // 5a. Velocity  5b. Density (stacked)
    const halfR = Math.floor(gR * 0.58);
    drawAnalogGauge(ctx, gx(4), gCY - halfR * 0.80, halfR, I.velocityFtS, 0, 30, 'VELOCITY', 'ft/s', { majorTicks: 3 });
    drawAnalogGauge(ctx, gx(4), gCY + halfR * 0.80, halfR, I.densitySG, 1.0, 1.6, 'DENSITY', 'SG', { majorTicks: 3, warnZone: { from: 0.75, to: 0.9 }, redZone: { from: 0.9, to: 1 } });
    // 6. Production panel
    const ppW = Math.floor(slotW * 0.90);
    drawProductionPanel(ctx, gx(5) - ppW / 2, gTop + 8, ppW, gH - 12, I.productionCYH, I.productionTonH, I.totalCY, I.totalTons);

    // Pump effort glow on vacuum & discharge
    if (I.pumpEffort > 0.1) {
        ctx.save(); ctx.globalAlpha = I.pumpEffort * 0.16;
        ctx.fillStyle = '#2ab8e0';
        ctx.beginPath(); ctx.arc(gx(6), gCY, gR + 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(gx(7), gCY, gR + 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    // 7. Pump Vacuum
    drawAnalogGauge(ctx, gx(6), gCY, gR, I.pumpVacuumPSI, -15, 10, 'VACUUM', 'PSI', { majorTicks: 5, redZone: { from: 0, to: 0.1 } });
    // 8. Discharge Pressure
    drawAnalogGauge(ctx, gx(7), gCY, gR, I.pumpDischargePSI, 0, 150, 'DISCHARGE', 'PSI', { redZone: { from: 0.87, to: 1 }, warnZone: { from: 0.73, to: 0.87 } });
    // 9. Pump RPM (replaces Gland Pump — shows pump sag under heavy load)
    const prW = Math.floor(slotW * 0.90);
    drawPumpRPMGauge(ctx, gx(8) - prW / 2, gTop + 8, prW, gH - 12, dredge.pumpRPM, dredge.pumpRPMMax, I.pumpEffort);

    // Status bar
    ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#555'; ctx.textAlign = 'left';
    const swDeg = (dredge.swingAngle * 180 / Math.PI).toFixed(1);
    ctx.fillText(`CUTTER ${dredge.cutterRPM.toFixed(0)} RPM  PUMP ${dredge.pumpRPM.toFixed(0)} RPM  LADDER ${dredge.ladderAngleDeg.toFixed(1)}°  DEPTH ${I.depthFt.toFixed(1)} ft  SWING ${swDeg}°  ${dredge.steppingState}`, 10, H - 3);
    ctx.textAlign = 'right'; ctx.fillText(new Date().toLocaleTimeString(), W - 10, H - 3);
}

// ─── Right panel — clean two-line rows, no overlapping text ──────────────────
function drawRightPanel(ctx, W, H) {
    ctx.fillStyle = '#080d14'; ctx.fillRect(0, 0, W, H);

    // Header bar
    const hdrH = 26;
    const hdrG = ctx.createLinearGradient(0, 0, 0, hdrH);
    hdrG.addColorStop(0, '#0d2035'); hdrG.addColorStop(1, '#080d14');
    ctx.fillStyle = hdrG; ctx.fillRect(0, 0, W, hdrH);
    ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#2ab8e0'; ctx.textAlign = 'center';
    ctx.fillText('SYSTEM STATUS', W / 2, 17);
    ctx.fillStyle = '#1a3a4a'; ctx.fillRect(0, hdrH, W, 1);

    const I = dredge.instruments;
    const swDeg = (dredge.swingAngle * 180 / Math.PI).toFixed(1);

    // Each entry: [ label, value, unit, color ]
    const rows = [
        ['CUTTER RPM', dredge.cutterRPM.toFixed(0), 'RPM', '#fff'],
        ['PUMP RPM', dredge.pumpRPM.toFixed(0), 'RPM', '#fff'],
        ['LADDER', dredge.ladderAngleDeg.toFixed(1), '°', '#fff'],
        ['DEPTH', I.depthFt.toFixed(1), 'ft', '#2ab8e0'],
        ['SWING', swDeg, '°', Math.abs(dredge.swingAngle) > 0.001 ? '#f39c12' : '#fff'],
        ['SWING VEL', (dredge.swingVelocityRadS * 180 / Math.PI * 60).toFixed(0), 'deg/m', '#fff'],
        ['DENSITY', I.densitySG.toFixed(3), 'SG', I.densitySG > 1.25 ? '#f39c12' : '#2dca72'],
        ['PRODUCTION', I.productionCYH.toFixed(0), 'cy/h', '#2dca72'],
        ['TOTAL', I.totalCY.toFixed(1), 'cy', '#2dca72'],
        ['EFFORT', (I.pumpEffort * 100).toFixed(0), '%', I.pumpEffort > 0.7 ? '#e74c3c' : '#fff'],
        ['VACUUM', I.pumpVacuumPSI.toFixed(1), 'PSI', '#aaa'],
        ['DISCHARGE', I.pumpDischargePSI.toFixed(0), 'PSI', '#aaa'],
        ['E-STOP', dredge.estop ? 'ACTIVE' : 'CLEAR', '', dredge.estop ? '#e74c3c' : '#2dca72'],
        ['STEP', dredge.steppingState.replace(/_/g, ' '), '', dredge.steppingState !== 'IDLE' ? '#f1c40f' : '#444'],
    ];

    const PAD = 7;
    const usableH = H - hdrH - 40;    // leave room for key guide
    // Each row gets a label line + value line + small gap
    const rowH = Math.min(28, usableH / rows.length);
    const lblSz = Math.min(9, rowH * 0.32);
    const valSz = Math.min(15, rowH * 0.52);

    rows.forEach(([label, val, unit, color], i) => {
        const baseY = hdrH + 4 + i * rowH;
        if (baseY + rowH > H - 38) return;

        // Label (top-left of row, small, muted)
        ctx.font = `${lblSz}px sans-serif`;
        ctx.fillStyle = '#3a4a5a'; ctx.textAlign = 'left';
        ctx.fillText(label, PAD, baseY + lblSz + 1);

        // Value (bottom of row, larger, colored)
        ctx.font = `bold ${valSz}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        const valStr = unit ? `${val} ${unit}` : val;
        ctx.fillText(valStr, W - PAD, baseY + rowH - 3);

        // Thin divider
        ctx.fillStyle = '#0f1820';
        ctx.fillRect(PAD, baseY + rowH - 1, W - PAD * 2, 1);
    });

    // Key guide block at bottom
    const gy = H - 36;
    ctx.fillStyle = '#0a0f18'; ctx.fillRect(0, gy, W, 36);
    ctx.fillStyle = '#1a2a3a'; ctx.fillRect(0, gy, W, 1);
    const lines = ['← → SWING  ↑ ↓ LADDER', 'W/S CUTTER  E/D PUMP', 'SPACE=STEP  ESC=ESTOP'];
    ctx.font = `${Math.min(8, (W - 10) / 14)}px monospace`;
    lines.forEach((ln, i) => {
        ctx.fillStyle = '#2a3a4a'; ctx.textAlign = 'center';
        ctx.fillText(ln, W / 2, gy + 10 + i * 9);
    });
}

// ─── Main loop ────────────────────────────────────────────────────────────
let lastTime = 0;

function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    updateControls(dt);
    physicsTick(dt);
    syncSliders();

    gaugeCanvas.height = gaugeCanvas.offsetHeight;

    planCtx.clearRect(0, 0, planCanvas.width, planCanvas.height);
    drawPlanView(planCtx, planCanvas.width, planCanvas.height);

    drawBridgeView(bridgeCtx, bridgeCanvas.width, bridgeCanvas.height, dt);

    rightCtx.clearRect(0, 0, rightCanvas.width, rightCanvas.height);
    drawRightPanel(rightCtx, rightCanvas.width, rightCanvas.height);

    drawGauges();
    requestAnimationFrame(loop);
}

requestAnimationFrame(ts => { lastTime = ts; resize(); requestAnimationFrame(loop); });


