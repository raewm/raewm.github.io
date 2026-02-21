// js/bridgeview.js — Pseudo-3D perspective forward view
// Ladder and cutter submerge into water as angle increases.
// At < ~5ft depth (small angle): cutter visible above water.
// At > 5ft: only see the above-waterline portion of the ladder + base splash.

import { dredge } from './dredge.js';

let waveTime = 0;
const HORIZON_FRAC = 0.40;
const FOV = 0.62;

function pX(wx, wz, W) { return W / 2 + (wx / (wz * FOV)) * W * 0.5; }
function pY(wy, wz, H) { return H * HORIZON_FRAC - (wy / (wz * FOV)) * H * 0.30; }

export function drawBridgeView(ctx, W, H, dt) {
    waveTime += dt;
    const horizon = H * HORIZON_FRAC;
    const worldShift = -dredge.swingAngle * W * 0.32;

    ctx.save();

    // ── Sky ──────────────────────────────────────────────────────────────
    const skyG = ctx.createLinearGradient(0, 0, 0, horizon);
    skyG.addColorStop(0, '#0a1628'); skyG.addColorStop(0.5, '#0d3a6e'); skyG.addColorStop(1, '#1a65aa');
    ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, horizon);
    const hazeG = ctx.createLinearGradient(0, horizon - 25, 0, horizon);
    hazeG.addColorStop(0, 'rgba(80,150,230,0)'); hazeG.addColorStop(1, 'rgba(80,150,230,0.18)');
    ctx.fillStyle = hazeG; ctx.fillRect(0, horizon - 25, W, 25);

    // ── Shoreline (pans with heading) ────────────────────────────────────
    ctx.save(); ctx.translate(worldShift, 0);
    ctx.fillStyle = '#1a3a12';
    ctx.beginPath(); ctx.moveTo(-W, horizon);
    for (let i = 0; i <= 20; i++) {
        const fx = i / 20;
        ctx.lineTo(-W / 2 + fx * W * 2, horizon - Math.sin(fx * Math.PI * 3) * horizon * 0.07 - 5);
    }
    ctx.lineTo(W * 1.5, horizon); ctx.closePath(); ctx.fill();
    ctx.restore();

    // ── Water ────────────────────────────────────────────────────────────
    const waterG = ctx.createLinearGradient(0, horizon, 0, H);
    waterG.addColorStop(0, '#0c4a71'); waterG.addColorStop(0.4, '#09304e'); waterG.addColorStop(1, '#061a2e');
    ctx.fillStyle = waterG; ctx.fillRect(0, horizon, W, H - horizon);

    ctx.save(); ctx.translate(worldShift * 0.1, 0);
    ctx.strokeStyle = 'rgba(40,100,160,0.38)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 16; i++) {
        const frac = i / 16;
        const wy = horizon + frac * (H - horizon);
        const wo = Math.sin(waveTime * 0.75 + frac * 5) * 2 * frac;
        ctx.beginPath(); ctx.moveTo(-W, wy + wo); ctx.lineTo(W * 2, wy + wo); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(100,180,255,0.1)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
        const frac = 0.3 + (i / 6) * 0.7;
        const wy = horizon + frac * (H - horizon);
        const wo = Math.sin(waveTime * 1.2 + i * 2.2) * 15 * frac;
        const ww = (35 + i * 22) * frac;
        ctx.beginPath(); ctx.moveTo(W / 2 - ww + wo, wy); ctx.lineTo(W / 2 + ww + wo, wy); ctx.stroke();
    }
    ctx.restore();

    // ── Deck (fixed — operator is on the vessel) ─────────────────────────
    const dkTopY = horizon + (H - horizon) * 0.50;
    ctx.fillStyle = '#1a3a1a';
    ctx.beginPath();
    ctx.moveTo(-W * 0.1, H + 20); ctx.lineTo(W * 1.1, H + 20);
    ctx.lineTo(W * 0.72, dkTopY); ctx.lineTo(W * 0.28, dkTopY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2e6b2e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.28, dkTopY); ctx.lineTo(W * 0.72, dkTopY); ctx.stroke();
    ctx.strokeStyle = 'rgba(35,65,35,0.5)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 7; i++) {
        const f = i / 8;
        ctx.beginPath(); ctx.moveTo(f * W, H + 20); ctx.lineTo(W * 0.28 + f * (W * 0.44), dkTopY); ctx.stroke();
    }

    // ── A-frame gantry ───────────────────────────────────────────────────
    const gBase = dkTopY + (H - dkTopY) * 0.10;
    const gTop = horizon + (H - horizon) * 0.10;
    const gW = W * 0.22;
    const gMid = W / 2;

    ctx.strokeStyle = '#182818'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gMid - gW, gBase); ctx.lineTo(gMid, gTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gMid + gW, gBase); ctx.lineTo(gMid, gTop); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(gMid - gW * 0.5, gBase - (gBase - gTop) * 0.36);
    ctx.lineTo(gMid + gW * 0.5, gBase - (gBase - gTop) * 0.36);
    ctx.stroke();
    ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.arc(gMid, gTop, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(gMid, gBase + 4, 9, 0, Math.PI * 2); ctx.fill();

    // ── Ladder — clipped at waterline ────────────────────────────────────
    const ladAngle = dredge.ladderAngleDeg * Math.PI / 180;
    // Approximate physical depth of cutter tip in ft
    const cutterPhysDepthFt = dredge.ladderLengthFt * Math.sin(ladAngle);
    // Project tip position
    const tipZ = Math.max(6, dredge.ladderLengthFt * Math.cos(ladAngle));
    const tipY_w = -(dredge.ladderLengthFt * Math.sin(ladAngle)) * 0.55 + 8;
    const ladSX = gMid;
    const ladSY = pY(tipY_w, tipZ, H);

    const hinge = { x: gMid, y: gBase };

    // Ladder end: clip at waterline if cutter is below water
    let drawToY = ladSY;
    let drawToX = ladSX;
    let cutterVisible = ladSY <= horizon;

    if (!cutterVisible) {
        // Find where ladder crosses the horizon
        const t = (horizon - hinge.y) / (ladSY - hinge.y);
        drawToX = hinge.x + t * (ladSX - hinge.x);
        drawToY = horizon;
    }

    // Draw the pipe from hinge to waterline (or tip if above water)
    const pipeGr = ctx.createLinearGradient(hinge.x, hinge.y, drawToX, drawToY);
    pipeGr.addColorStop(0, '#4a4a4a'); pipeGr.addColorStop(1, '#252525');
    ctx.strokeStyle = pipeGr; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hinge.x, hinge.y); ctx.lineTo(drawToX, drawToY); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,70,70,0.3)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(hinge.x - 2, hinge.y); ctx.lineTo(drawToX - 2, drawToY); ctx.stroke();

    // Lift cable (to wherever visible end is)
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(gMid, gTop); ctx.lineTo((hinge.x + drawToX) / 2, (hinge.y + drawToY) / 2); ctx.stroke();
    ctx.setLineDash([]);

    // Waterline entry: show disturbance circle where ladder enters water
    if (!cutterVisible && ladAngle > 0.05) {
        // Water splash / turbulence at waterline
        ctx.save();
        const entAlpha = Math.min(0.6, cutterPhysDepthFt / 10);
        ctx.globalAlpha = 0.3 + entAlpha * 0.3;
        ctx.strokeStyle = '#2ab8e0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(drawToX, horizon, 14 + cutterPhysDepthFt * 1.2, 4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#2ab8e0';
        ctx.beginPath(); ctx.ellipse(drawToX, horizon, 20 + cutterPhysDepthFt * 1.5, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ── Cutter head (only draw if visible above waterline) ───────────────
    if (cutterVisible) {
        ctx.save();
        ctx.translate(ladSX, ladSY); ctx.rotate(dredge.cutterRotation);
        const isSpinning = dredge.cutterRPM > 2;
        if (isSpinning) { ctx.shadowColor = '#e87c20'; ctx.shadowBlur = 12; }
        const cR = 13;
        const cgR = ctx.createRadialGradient(0, 0, 2, 0, 0, cR);
        cgR.addColorStop(0, isSpinning ? '#e0a040' : '#555');
        cgR.addColorStop(1, isSpinning ? '#a84010' : '#2a2a2a');
        ctx.fillStyle = cgR; ctx.beginPath(); ctx.arc(0, 0, cR, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2a1a00'; ctx.strokeStyle = '#cc6010'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
            ctx.save(); ctx.rotate(i * Math.PI / 3);
            ctx.beginPath(); ctx.moveTo(0, -cR + 2); ctx.lineTo(4, -cR - 7); ctx.lineTo(-4, -cR - 7); ctx.closePath();
            ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ── Pipeline aft (always visible on deck) ────────────────────────────
    ctx.strokeStyle = '#1a2a1a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(W / 2 + 60, H); ctx.bezierCurveTo(W * 0.65, H * 0.85, W * 0.82, H * 0.78, W * 0.94, H * 0.84); ctx.stroke();

    ctx.restore();

    // ── E-stop ───────────────────────────────────────────────────────────
    if (dredge.estop) {
        ctx.fillStyle = 'rgba(200,20,20,0.75)'; ctx.fillRect(0, 0, W, H);
        ctx.font = `bold ${Math.min(H * 0.08, 50)}px sans-serif`;
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText('E-STOP ENGAGED', W / 2, H / 2);
        ctx.font = `${Math.min(H * 0.04, 28)}px sans-serif`;
        ctx.fillText('Press ESC to release', W / 2, H / 2 + H * 0.1);
    }
}
