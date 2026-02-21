// js/planview.js — Top-down bathymetric plan view
// Visual: Shallow (5-10ft) = green/lime. Dug deeper = teal→blue. Arc-shaped cut history persists through steps.
// Step scrolls grid; dredge stays fixed.

import { dredge } from './dredge.js';

// ─── Constants ─────────────────────────────────────────────────────────────
const CELL_SIZE = 12;
const MAX_SWING = dredge.swingLimitRad;

let HULL_H = 80;
let LADDER_LEN = 120;
const get_TOTAL = () => HULL_H + LADDER_LEN;
const HULL_W = 44;
const CUTTER_R = 14;

// Step = 2 rows = 24px ≈ cutter diameter (2×CUTTER_R=28px).
// Adjacent swing arcs will overlap slightly so no material is left between passes.
const STEP_ROWS = 2;

// Material types (physics only)
const CT = { WATER: 0, SILT: 1, SAND: 2, CLAY: 3, ROCK: 4 };
const HARDNESS = { [CT.WATER]: 0, [CT.SILT]: 0.20, [CT.SAND]: 0.42, [CT.CLAY]: 0.68, [CT.ROCK]: 1.0 };
const PRESS_RATE = { [CT.SILT]: 0.04, [CT.SAND]: 0.10, [CT.CLAY]: 0.20, [CT.ROCK]: 0.38 };

// ─── Depth → color: SHALLOW = bright lime-green, DEEP = dark navy ───────────
// All values relative to grid baseline depth (5-12ft initial)
function depthColor(depthFt) {
    const t = Math.max(0, Math.min(1, depthFt / 32));
    let r, g, b;
    if (t < 0.22) {           // 0-7 ft — bright green (shoal)
        const u = t / 0.22;
        r = Math.round(50 + u * 30);
        g = Math.round(180 + u * 30);
        b = Math.round(60 - u * 20);
    } else if (t < 0.46) {   // 7-15 ft — green→teal
        const u = (t - 0.22) / 0.24;
        r = Math.round(140 + u * 115);
        g = Math.round(210 + u * 20);
        b = Math.round(10 - u * 10);
    } else if (t < 0.55) {          // 10-14ft — yellow → amber/orange
        const u = (t - 0.37) / 0.18;
        r = Math.round(255);
        g = Math.round(230 - u * 130);
        b = 0;
    } else if (t < 0.78) {          // 14-19ft — orange → red
        const u = (t - 0.55) / 0.23;
        r = Math.round(255 - u * 20);
        g = Math.round(100 - u * 90);
        b = 0;
    } else {                        // 19-25ft — deep red/maroon
        const u = (t - 0.78) / 0.22;
        r = Math.round(235 - u * 80);
        g = Math.round(10);
        b = Math.round(10 + u * 20);
    }
    return `rgb(${r},${g},${b})`;
}

// ─── LCG noise ─────────────────────────────────────────────────────────────
function lcg(seed) {
    let v = seed | 0;
    v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
    v = Math.imul(v ^ (v >>> 15), 0xac4e3b4d);
    return ((v ^ (v >>> 16)) >>> 0) / 0xffffffff;
}

// ─── Grid ──────────────────────────────────────────────────────────────────
let gridRows = 0, gridCols = 0;
let grid = [];
let spudX = 0, spudY = 0;
let _canvasW = 0, _canvasH = 0;

// Initial depths: 5-12ft shoal (green range), max cut adds 12ft → becomes 17-24ft (teal/blue)
function genCell(row, col) {
    const centreDist = Math.abs(col - gridCols / 2) / (gridCols / 2);
    // Channel: 8ft in center, 5ft at edges (cross-section of a shoal)
    const baseDepth = 5 + (1 - centreDist) * 3;
    const ZONE_R = 14, ZONE_C = 10;
    const zr = (row / ZONE_R) | 0, zc = (col / ZONE_C) | 0;
    const fr = (row % ZONE_R) / ZONE_R, fc = (col % ZONE_C) / ZONE_C;
    const s = fr * fr * (3 - 2 * fr), q = fc * fc * (3 - 2 * fc);
    const h = (r, c) => lcg(r * 7919 + c * 104729);
    const noise = (h(zr, zc) * (1 - s) * (1 - q) + h(zr + 1, zc) * s * (1 - q) +
        h(zr, zc + 1) * (1 - s) * q + h(zr + 1, zc + 1) * s * q - 0.5) * 2;
    const depth = Math.max(3, Math.min(12, baseDepth + noise));

    const n2 = lcg(row * 13337 + col * 7919);
    let type;
    if (centreDist < 0.15) type = CT.SILT;
    else if (n2 < 0.30) type = CT.SILT;
    else if (n2 < 0.65) type = CT.SAND;
    else if (n2 < 0.92) type = CT.CLAY;
    else type = CT.CLAY;
    if (lcg(row * 31337 + col * 62711) < 0.025) type = CT.ROCK;

    return { baseDepthFt: depth, cutDepthFt: 0, type };
}

function buildGrid(canvasW, canvasH) {
    _canvasW = canvasW; _canvasH = canvasH;
    HULL_H = Math.round(canvasH * 0.13);
    LADDER_LEN = Math.round(canvasH * 0.22);

    gridCols = Math.ceil(canvasW / CELL_SIZE) + 2;
    gridRows = Math.ceil(canvasH / CELL_SIZE) + 2;
    spudX = canvasW / 2;
    spudY = canvasH * 0.80; // pushed lower to give more forward space for arc history

    grid = [];
    for (let r = 0; r < gridRows; r++) {
        grid[r] = [];
        for (let c = 0; c < gridCols; c++) grid[r][c] = genCell(r, c);
    }
    clearInitialWater();
}

// At startup: clear only the hull corridor and aft area (vessel IS in water already)
function clearInitialWater() {
    const hullHW = Math.ceil(HULL_W / CELL_SIZE / 2) + 1;
    const cL = Math.floor(spudX / CELL_SIZE) - hullHW;
    const cR = Math.ceil(spudX / CELL_SIZE) + hullHW;
    for (let r = 0; r < gridRows; r++) {
        const cellY = r * CELL_SIZE;
        for (let c = 0; c < gridCols; c++) {
            const cell = grid[r]?.[c]; if (!cell) continue;
            // Behind spud = all water; in hull corridor above spud = navigable water
            if (cellY >= spudY || (c >= cL && c <= cR && cellY >= spudY - HULL_H)) {
                cell.cutDepthFt = 12;
            }
        }
    }
}

// After each step: ONLY clear cells immediately aft of the spud (tiny strip)
// This preserves cut arc shapes forward of the hull
function clearAft() {
    for (let r = 0; r < gridRows; r++) {
        if (r * CELL_SIZE < spudY) continue; // only aft of spud
        for (let c = 0; c < gridCols; c++) {
            const cell = grid[r]?.[c]; if (cell) cell.cutDepthFt = 12;
        }
    }
}

// ─── Step: grid scrolls up, spud stays fixed ────────────────────────────────
let stepCount = 0;

export function shiftGridStep() {
    stepCount++;
    for (let i = 0; i < STEP_ROWS; i++) {
        grid.pop();
        const newRow = [];
        for (let c = 0; c < gridCols; c++) newRow.push(genCell(stepCount * STEP_ROWS + i, c));
        grid.unshift(newRow);
    }
    // Do NOT call clearAft() here — preserved cut arcs show channel progress.
}

// ─── Soil interface ─────────────────────────────────────────────────────────
export const soil = {
    cut(swingAngleRad, cutterDepthFt, cutterRPM, swingVelRadS, dt) {
        const TOTAL = get_TOTAL();
        const cx = spudX + Math.sin(swingAngleRad) * TOTAL;
        const cy = spudY - Math.cos(swingAngleRad) * TOTAL;

        const rMin = Math.floor((cy - CUTTER_R) / CELL_SIZE);
        const rMax = Math.ceil((cy + CUTTER_R) / CELL_SIZE);
        const cMin = Math.floor((cx - CUTTER_R) / CELL_SIZE);
        const cMax = Math.ceil((cx + CUTTER_R) / CELL_SIZE);

        let removedCY = 0;

        for (let r = rMin; r <= rMax; r++) {
            if (r < 0 || r >= gridRows) continue;
            if (r * CELL_SIZE >= spudY) continue;
            for (let c = cMin; c <= cMax; c++) {
                if (c < 0 || c >= gridCols) continue;
                const cell = grid[r][c];
                if (!cell || cell.cutDepthFt >= 12) continue;
                const cellCX = c * CELL_SIZE + CELL_SIZE / 2;
                const cellCY = r * CELL_SIZE + CELL_SIZE / 2;
                if (Math.hypot(cx - cellCX, cy - cellCY) > CUTTER_R) continue;

                // ── KEY CHECK: cutter must be DEEPER than the cell's current seabed ──
                // Total cell depth = base shoal depth + already-cut depth
                const cellCurrentDepth = cell.baseDepthFt + cell.cutDepthFt;
                if (cutterDepthFt <= cellCurrentDepth) continue;  // cutter above material = no work

                const depthF = Math.min(1, cutterDepthFt / 12);
                const hardF = HARDNESS[cell.type] ?? 0.4;
                const rpmF = cutterRPM / dredge.cutterRPMMax;
                const swingF = Math.min(1, Math.abs(swingVelRadS) / 0.02);
                const rate = depthF * (1 - hardF * 0.5) * rpmF * swingF;

                cell.cutDepthFt = Math.min(12, cell.cutDepthFt + rate * dt * 3);
                removedCY += rate * dt * 0.003;
            }
        }
        return removedCY;
    },

    getHardnessAt(swingAngleRad) {
        const TOTAL = get_TOTAL();
        const cx = spudX + Math.sin(swingAngleRad) * TOTAL;
        const cy = spudY - Math.cos(swingAngleRad) * TOTAL;
        const col = Math.floor(cx / CELL_SIZE);
        const row = Math.floor(cy / CELL_SIZE);
        if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) return 0.3;
        const cell = grid[row][col];
        if (!cell || cell.cutDepthFt >= 12) return 0;
        // Return 0 if cutter is above the material surface
        const cellCurrentDepth = cell.baseDepthFt + cell.cutDepthFt;
        if (dredge.cutterDepthFt <= cellCurrentDepth) return 0;
        return HARDNESS[cell.type] ?? 0.4;
    },
};

export function markDirty() { }

// ─── Draw ──────────────────────────────────────────────────────────────────
let lastW = 0, lastH = 0;

export function drawPlanView(ctx, W, H) {
    if (W !== lastW || H !== lastH) { lastW = W; lastH = H; buildGrid(W, H); }

    // ── Grid cells ─────────────────────────────────────────────────────────
    for (let r = 0; r < gridRows; r++) {
        const ry = r * CELL_SIZE;
        for (let c = 0; c < gridCols; c++) {
            const cell = grid[r]?.[c]; if (!cell) continue;
            ctx.fillStyle = depthColor(cell.baseDepthFt + cell.cutDepthFt);
            ctx.fillRect(c * CELL_SIZE, ry, CELL_SIZE, CELL_SIZE);
        }
    }

    const TOTAL = get_TOTAL();
    const sa = dredge.swingAngle;
    const cutX = spudX + Math.sin(sa) * TOTAL;
    const cutY = spudY - Math.cos(sa) * TOTAL;

    // ── Cut-face arc (dashed, forward swing limit)
    ctx.save();
    ctx.strokeStyle = 'rgba(45,202,114,0.55)';
    ctx.lineWidth = 1.5; ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(spudX, spudY, TOTAL, -Math.PI / 2 - MAX_SWING, -Math.PI / 2 + MAX_SWING);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();

    // ── Pipeline
    const sternX = spudX - Math.sin(sa) * 8;
    const sternY = spudY + Math.cos(sa) * 8;
    ctx.save();
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sternX, sternY);
    ctx.quadraticCurveTo(sternX - Math.sin(sa) * 60, sternY + Math.cos(sa) * 60, spudX, H + 20);
    ctx.stroke();
    ctx.strokeStyle = '#8a2010'; ctx.lineWidth = 4; ctx.setLineDash([10, 6]);
    ctx.beginPath(); ctx.moveTo(sternX, sternY);
    ctx.quadraticCurveTo(sternX - Math.sin(sa) * 60, sternY + Math.cos(sa) * 60, spudX, H + 20);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();

    // ── Swing wires
    const anchorY = spudY - TOTAL * 1.05;
    ctx.save();
    ctx.strokeStyle = 'rgba(200,190,140,0.35)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
    for (const bx of [spudX - TOTAL * 1.05, spudX + TOTAL * 1.05]) {
        ctx.beginPath(); ctx.moveTo(cutX, cutY); ctx.lineTo(bx, anchorY); ctx.stroke();
        ctx.fillStyle = '#f5a623';
        ctx.beginPath(); ctx.arc(bx, anchorY, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // ── Rigid body (hull + ladder) rotating around spud
    ctx.save();
    ctx.translate(spudX, spudY); ctx.rotate(sa);

    // Ladder
    ctx.strokeStyle = '#5a7a5a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -HULL_H); ctx.lineTo(0, -HULL_H - LADDER_LEN); ctx.stroke();
    ctx.strokeStyle = '#3a5a3a'; ctx.lineWidth = 2;
    for (const rx of [-6, 6]) {
        ctx.beginPath(); ctx.moveTo(rx, -HULL_H); ctx.lineTo(rx, -HULL_H - LADDER_LEN); ctx.stroke();
    }

    // Hull
    const hw = HULL_W / 2;
    const hg = ctx.createLinearGradient(-hw, 0, hw, 0);
    hg.addColorStop(0, '#3a6a3a'); hg.addColorStop(0.5, '#5ab85a'); hg.addColorStop(1, '#3a5a3a');
    ctx.fillStyle = hg; ctx.strokeStyle = '#1a3a1a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-hw + 7, -HULL_H); ctx.lineTo(hw - 7, -HULL_H); ctx.lineTo(hw, -HULL_H + 13);
    ctx.lineTo(hw, 5); ctx.lineTo(-hw, 5); ctx.lineTo(-hw, -HULL_H + 13); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a5a4a'; ctx.fillRect(-12, -HULL_H * 0.65, 24, 22);
    ctx.restore();

    // ── Cutter head
    ctx.save();
    ctx.translate(cutX, cutY); ctx.rotate(dredge.cutterRotation);
    if (dredge.cutterRPM > 2) { ctx.shadowColor = '#e87c20'; ctx.shadowBlur = 8; }
    const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, CUTTER_R);
    cg.addColorStop(0, '#e0a040'); cg.addColorStop(1, '#a84010');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, CUTTER_R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a1a00'; ctx.strokeStyle = '#cc6010'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, -CUTTER_R + 2); ctx.lineTo(4, -CUTTER_R - 6); ctx.lineTo(-4, -CUTTER_R - 6); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ── Spud pin
    ctx.save();
    ctx.fillStyle = '#999'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(spudX, spudY, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(spudX, spudY, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ── Depth legend (right edge) — dark bg panel for readability
    const LX = W - 48, LY = 6, LH = 100, LW = 12;
    // Dark background panel
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(LX - 4, LY - 14, LW + 40, LH + 22);
    // Title
    ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText('DEPTH', LX + LW / 2 + 14, LY - 3);
    // Color bar — scale 0-25ft matching depthColor exactly
    for (let i = 0; i < LH; i++) {
        ctx.fillStyle = depthColor((i / LH) * 25);
        ctx.fillRect(LX, LY + i, LW, 1);
    }
    ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8; ctx.strokeRect(LX, LY, LW, LH);
    // Tick labels — bold white, high contrast
    ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText('0', LX + LW + 3, LY + 5);
    ctx.fillText('12', LX + LW + 3, LY + LH * 0.48 + 4);
    ctx.fillText('25ft', LX + LW + 3, LY + LH + 1);

    if (dredge.steppingState !== 'IDLE') {
        ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#f1c40f'; ctx.textAlign = 'center';
        ctx.fillText(`▶ ${dredge.steppingState.replace(/_/g, ' ')}`, W / 2, H - 7);
    }
}
