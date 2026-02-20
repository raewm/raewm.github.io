// js/cutter/level-cutting.js — Cutter Suction Dredge: top-down plan view
// The whole vessel (hull + ladder) swings as a rigid body around the working spud.
// Pump can exceed 100% — time spent above 100% accumulates and causes cavitation.

import { transitionNextCutterRound, showGameOver } from '../engine.js';

// ── Constants ────────────────────────────────────────────────────────────────
const CELL_SIZE = 14;
const HULL_W = 52;
const HULL_H = 108;
const LADDER_LEN = 168;
const TOTAL_LEN = HULL_H + LADDER_LEN;   // spud-to-cutter distance
const CUTTER_R = 20;
const MAX_SWING = Math.PI * 0.55;
const SWING_FORCE = 2.4;
const SWING_DAMP = 0.88;
const DEPTH_SPEED = 0.38;
const PRESSURE_DECAY = 0.07;
const MAX_PRESSURE = 1.2;    // 120% — bar overflows into red zone
const CAV_OVERPRESS_TIME = 5.0;    // seconds above 100% before cavitation
const MAX_CAV = 3;
const SWINGS_PER_STEP = 2;
const STEPS_PER_ROUND = 8;
const STEP_ROWS = 2;

// Cell types
const CT = { WATER: 0, SILT: 1, SAND: 2, CLAY: 3, ROCK: 4 };

const COL_UNCUT = { 0: '#0b3a6a', 1: '#c8a86a', 2: '#b09050', 3: '#7a5c38', 4: '#5a4a3a' };
const COL_CUT = { 0: '#0b3a6a', 1: '#144c70', 2: '#114468', 3: '#103c60', 4: '#1a2830' };
const PRESS_RATE = { 1: 0.04, 2: 0.08, 3: 0.16, 4: 0.34 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function lcg(seed) {
    let v = seed | 0;
    v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
    v = Math.imul(v ^ (v >>> 15), 0xac4e3b4d);
    return ((v ^ (v >>> 16)) >>> 0) / 0xffffffff;
}

function lerpColor(c1, c2, t) {
    const h = s => parseInt(s.slice(1), 16);
    const a = h(c1), b = h(c2);
    const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
    const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
    const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
    return `rgb(${r},${g},${bl})`;
}

export class LevelCutting {
    constructor(ctx, canvas, game, keys) {
        this.ctx = ctx; this.canvas = canvas;
        this.game = game; this.keys = keys;
        this.W = canvas.width; this.H = canvas.height;
        this.reset();
    }

    onResize() {
        this.W = this.canvas.width; this.H = this.canvas.height;
        this._buildGrid();
    }

    reset() {
        this.W = this.canvas.width; this.H = this.canvas.height;

        // Spud (pivot) fixed at lower-centre
        this.spudX = this.W / 2;
        this.spudY = this.H * 0.74;

        // Swing
        this.swingAngle = -MAX_SWING;
        this.swingVel = 0;
        this.lastLimit = -1;
        this.passCount = 0;

        // Cutter depth (0=min .. 1=max)
        this.ladderDepth = 0.55;

        // Animation
        this.cutterRot = 0;
        this.time = 0;
        this.waveOffset = 0;

        // Pump
        this.pumpPressure = 0;
        this.overpressureTime = 0;   // seconds above 100%
        this.cavitations = 0;
        this.cavitationTimer = 0;

        this.stepCooldown = 0;       // prevents rapid-fire manual stepping

        // Progress
        this.stepsCompleted = 0;
        this.transitioned = false;

        // FX
        this.particles = [];
        this.clouds = [];
        for (let i = 0; i < 5; i++) this.clouds.push(this._mkCloud());

        this._buildGrid();
        this.game.scoring.startCutting();
    }

    // ── Channel helpers ───────────────────────────────────────────────────────

    _channelBounds() {
        const hw = Math.sin(MAX_SWING) * TOTAL_LEN;
        return {
            left: Math.max(0, Math.floor((this.spudX - hw) / CELL_SIZE)),
            right: Math.min(this.gridCols - 1, Math.ceil((this.spudX + hw) / CELL_SIZE)),
        };
    }

    _clearChannelRows() {
        const { left, right } = this._channelBounds();
        const bowMinRow = Math.floor((this.spudY - HULL_H) / CELL_SIZE);
        const spudRow = Math.floor(this.spudY / CELL_SIZE);

        for (let r = bowMinRow; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                const cell = this.grid[r]?.[c];
                if (!cell) continue;
                const inChannel = c >= left && c <= right;
                const belowSpud = r > spudRow;
                if (inChannel || belowSpud) cell.cut = 1;
            }
        }
    }

    // ── Grid ──────────────────────────────────────────────────────────────────

    _buildGrid() {
        this.gridCols = Math.ceil(this.W / CELL_SIZE) + 2;
        this.gridRows = Math.ceil(this.H / CELL_SIZE) + 2;
        this.grid = [];
        for (let r = 0; r < this.gridRows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.gridCols; c++) {
                this.grid[r][c] = this._genCell(r, c, this.game.round);
            }
        }
        this._clearChannelRows();
    }

    _genCell(row, col, round) {
        // ── Zone-coherent material noise ──────────────────────────────────────
        // Sample noise at a coarse grid (ZONE_R × ZONE_C cells per zone).
        // Bilinear smooth-step interpolation between zone corners produces large,
        // gradually-transitioning geological patches rather than salt-and-pepper noise.
        const ZONE_R = 18, ZONE_C = 14;
        const zr = Math.floor(row / ZONE_R);
        const zc = Math.floor(col / ZONE_C);
        const fr = (row % ZONE_R) / ZONE_R;
        const fc = (col % ZONE_C) / ZONE_C;

        // Smooth-step (ease in-out)
        const sfr = fr * fr * (3 - 2 * fr);
        const sfc = fc * fc * (3 - 2 * fc);

        const seed = (zr, zc) => lcg(zr * 7919 + zc * 104729 + round * 2053);
        const n00 = seed(zr, zc);
        const n10 = seed(zr + 1, zc);
        const n01 = seed(zr, zc + 1);
        const n11 = seed(zr + 1, zc + 1);

        const baseNoise = n00 * (1 - sfr) * (1 - sfc)
            + n10 * sfr * (1 - sfc)
            + n01 * (1 - sfr) * sfc
            + n11 * sfr * sfc;

        // Map smooth noise → material type.
        // Higher rounds shift thresholds slightly toward harder material.
        const shift = Math.min(round * 0.04, 0.2);
        let type;
        if (baseNoise < 0.30 - shift) type = CT.SILT;
        else if (baseNoise < 0.60) type = CT.SAND;
        else if (baseNoise < 0.88 + shift) type = CT.CLAY;
        else type = CT.CLAY;  // top of range stays clay

        // ── Sparse rock inclusions ────────────────────────────────────────────
        // Completely independent noise — only fires at low probability so rocks
        // appear as isolated boulders inside an otherwise consistent stratum.
        const rockRng = lcg(row * 31337 + col * 6271 + round * 9973);
        const rockChance = 0.025 + round * 0.008;
        if (rockRng < rockChance) type = CT.ROCK;

        return { type, cut: 0 };
    }

    _shiftGridForStep() {
        for (let s = 0; s < STEP_ROWS; s++) {
            this.grid.pop();
            const newRow = [];
            for (let c = 0; c < this.gridCols; c++) {
                newRow.push(this._genCell(this.stepsCompleted * STEP_ROWS + s, c, this.game.round));
            }
            this.grid.unshift(newRow);
        }
        // Re-apply channel clearing — only the corridor stays blue, sides stay brown
        this._clearChannelRows();
    }

    // ── Geometry ──────────────────────────────────────────────────────────────

    // Bow position in world coords
    _bowXY() {
        return {
            x: this.spudX + Math.sin(this.swingAngle) * HULL_H,
            y: this.spudY - Math.cos(this.swingAngle) * HULL_H,
        };
    }

    // Cutter head in world coords
    _cutterXY() {
        return {
            x: this.spudX + Math.sin(this.swingAngle) * TOTAL_LEN,
            y: this.spudY - Math.cos(this.swingAngle) * TOTAL_LEN,
        };
    }

    // ── Update ────────────────────────────────────────────────────────────────

    update(dt) {
        if (this.transitioned) return;
        this.time += dt;
        this.waveOffset += dt * 40;
        this.cutterRot += dt * 6;
        this.game.hud.update(dt);

        // Clouds drift
        for (const c of this.clouds) {
            c.x -= c.speed * dt;
            if (c.x + c.w < 0) c.x = this.W + 20;
        }

        // Cavitation lockout
        if (this.cavitationTimer > 0) this.cavitationTimer -= dt;

        // Depth control
        if (this.keys.ArrowUp) this.ladderDepth = Math.max(0.1, this.ladderDepth - DEPTH_SPEED * dt);
        if (this.keys.ArrowDown) this.ladderDepth = Math.min(1.0, this.ladderDepth + DEPTH_SPEED * dt);

        // Manual step forward (W) / step back (S) with cooldown
        if (this.stepCooldown > 0) this.stepCooldown -= dt;
        if (this.stepCooldown <= 0) {
            if (this.keys.KeyW) {
                this.stepCooldown = 1.0;
                this._doStep();
            }
            if (this.keys.KeyS && this.stepsCompleted > 0) {
                this.stepCooldown = 1.0;
                this._doStepBack();
            }
        }

        // Swing control
        if (this.keys.ArrowLeft) this.swingVel -= SWING_FORCE * dt;
        if (this.keys.ArrowRight) this.swingVel += SWING_FORCE * dt;
        this.swingVel *= Math.pow(SWING_DAMP, dt * 60);
        this.swingAngle += this.swingVel * dt;

        // Swing limits — count passes
        if (this.swingAngle >= MAX_SWING) {
            this.swingAngle = MAX_SWING;
            if (this.swingVel > 0) { this.swingVel = -Math.abs(this.swingVel) * 0.25; this._onLimitReached(1); }
        }
        if (this.swingAngle <= -MAX_SWING) {
            this.swingAngle = -MAX_SWING;
            if (this.swingVel < 0) { this.swingVel = Math.abs(this.swingVel) * 0.25; this._onLimitReached(-1); }
        }

        // Cutting
        if (this.cavitationTimer <= 0) this._doCutting(dt);

        // Pressure decay
        this.pumpPressure = Math.max(0, this.pumpPressure - PRESSURE_DECAY * dt);

        // Overpressure timer — accumulate time above 100%, trigger cavitation after threshold
        if (this.pumpPressure >= 1.0 && this.cavitationTimer <= 0) {
            this.overpressureTime += dt;
            if (this.overpressureTime >= CAV_OVERPRESS_TIME) this._triggerCavitation();
        } else if (this.pumpPressure < 1.0) {
            this.overpressureTime = Math.max(0, this.overpressureTime - dt * 0.5); // slow decay when back under
        }

        // Particles
        this.particles = this.particles.filter(p => {
            p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 25 * dt;
            return p.life > 0;
        });
    }

    _onLimitReached(dir) {
        if (dir === this.lastLimit) return;
        this.lastLimit = dir;
        this.passCount++;
        if (this.passCount % SWINGS_PER_STEP === 0) this._doStep();
    }

    _doStep() {
        this.stepsCompleted++;
        const coverage = this._stepCoverage();
        this._shiftGridForStep();

        const pts = this.game.scoring.onStep(coverage);
        if (pts > 0) this.game.hud.flash(`+${pts}  STEP BONUS`, '#2dca72');

        if (this.stepsCompleted >= STEPS_PER_ROUND && !this.transitioned) {
            this.transitioned = true;
            const bonus = this.game.scoring.finishRound();
            this.game.hud.flash(`ROUND DONE! +${bonus}`, '#f5a623');
            setTimeout(() => transitionNextCutterRound(), 1500);
        }
    }

    _doStepBack() {
        this.stepsCompleted = Math.max(0, this.stepsCompleted - 1);
        // Reverse shift: pop fresh row from top, add uncut row at bottom
        for (let s = 0; s < STEP_ROWS; s++) {
            this.grid.shift();
            const newRow = [];
            for (let c = 0; c < this.gridCols; c++) {
                newRow.push(this._genCell(this.stepsCompleted * STEP_ROWS + s + this.gridRows, c, this.game.round));
            }
            this.grid.push(newRow);
        }
        this._clearChannelRows();
        this.game.hud.flash('◀ STEP BACK', '#a8d8ff');
    }

    _doCutting(dt) {
        const { x: cx, y: cy } = this._cutterXY();
        const spudY = this.spudY;
        const rMin = Math.floor((cy - CUTTER_R) / CELL_SIZE);
        const rMax = Math.ceil((cy + CUTTER_R) / CELL_SIZE);
        const cMin = Math.floor((cx - CUTTER_R) / CELL_SIZE);
        const cMax = Math.ceil((cx + CUTTER_R) / CELL_SIZE);
        let pressureDelta = 0;

        for (let r = rMin; r <= rMax; r++) {
            if (r < 0 || r >= this.gridRows) continue;
            if (r * CELL_SIZE >= spudY) continue;        // never cut behind the spud
            for (let c = cMin; c <= cMax; c++) {
                if (c < 0 || c >= this.gridCols) continue;
                const cell = this.grid[r][c];
                if (!cell || cell.type === CT.WATER || cell.cut >= 1) continue;

                const cellCX = c * CELL_SIZE + CELL_SIZE / 2;
                const cellCY = r * CELL_SIZE + CELL_SIZE / 2;
                if (Math.hypot(cx - cellCX, cy - cellCY) > CUTTER_R) continue;

                const depthFactor = 0.25 + this.ladderDepth * 0.75;
                const hardnessFactor = cell.type === CT.ROCK ? 0.22
                    : cell.type === CT.CLAY ? 0.42 : 0.85;
                const cutRate = depthFactor * hardnessFactor;

                const prev = cell.cut;
                cell.cut = Math.min(1, cell.cut + cutRate * dt);

                if (cell.cut >= 1 && prev < 1) {
                    this.game.scoring.onCellCut(cell.type);
                    this._spawnCutParticles(cellCX, cellCY, cell.type);
                }

                pressureDelta += (PRESS_RATE[cell.type] ?? 0.08) * depthFactor * dt;
            }
        }

        if (this.ladderDepth > 0.9 && pressureDelta > 0) pressureDelta *= 1.6;
        this.pumpPressure = Math.min(MAX_PRESSURE, this.pumpPressure + pressureDelta * 0.4);
    }

    _stepCoverage() {
        const { left: cLeft, right: cRight } = this._channelBounds();
        const bowMinRow = Math.floor((this.spudY - HULL_H) / CELL_SIZE);
        const topRow = Math.max(0, bowMinRow - 16);
        let total = 0, cut = 0;
        for (let r = topRow; r < bowMinRow; r++) {
            for (let c = cLeft; c <= cRight; c++) {
                const cell = this.grid[r]?.[c];
                if (!cell || cell.type === CT.WATER) continue;
                total++;
                if (cell.cut >= 1) cut++;
            }
        }
        return total > 0 ? cut / total : 0;
    }

    _triggerCavitation() {
        this.cavitations++;
        this.cavitationTimer = 2.5;
        this.overpressureTime = 0;
        this.pumpPressure = 0.15;
        const pen = this.game.scoring.applyCavitationPenalty();
        this.game.hud.flash(`CAVITATION! −${pen}`, '#ff4444');
        this.game.hud.flashPenalty();
        this.game.penalties++;
        const { x, y } = this._cutterXY();
        this._spawnCavParticles(x, y);
        if (this.cavitations >= MAX_CAV && !this.transitioned) {
            this.transitioned = true;
            setTimeout(() => showGameOver(), 1400);
        }
    }

    // ── Particles / FX ────────────────────────────────────────────────────────

    _mkCloud() {
        return {
            x: Math.random() * this.W, y: 15 + Math.random() * 80,
            w: 80 + Math.random() * 90, h: 24 + Math.random() * 18,
            speed: 6 + Math.random() * 12
        };
    }

    _spawnCutParticles(x, y, type) {
        const col = type === CT.ROCK ? '#9a8070' : type === CT.CLAY ? '#8a6040' : '#b09050';
        for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2, s = 18 + Math.random() * 35;
            this.particles.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                size: 2 + Math.random() * 3, life: 0.35 + Math.random() * 0.35, color: col
            });
        }
    }

    _spawnCavParticles(x, y) {
        for (let i = 0; i < 22; i++) {
            const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 90;
            this.particles.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                size: 3 + Math.random() * 5, life: 0.5 + Math.random() * 0.8,
                color: `hsl(${15 + Math.random() * 35},90%,60%)`
            });
        }
    }

    // ── Drawing ───────────────────────────────────────────────────────────────

    draw() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;

        const bgG = ctx.createLinearGradient(0, 0, 0, H);
        bgG.addColorStop(0, '#0a1e3a'); bgG.addColorStop(1, '#051028');
        ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

        this._drawGrid();
        this._drawCutFace();
        this._drawCaustics();
        this._drawPipeline();
        this._drawSwingWires();
        this._drawLadder();
        this._drawHull();
        this._drawCutterHead();
        this._drawSpuds();

        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        for (const c of this.clouds) this._drawCloud(c);

        // Red screen flash when cavitating
        if (this.cavitationTimer > 0) {
            ctx.save();
            ctx.globalAlpha = 0.12 + 0.1 * Math.sin(this.time * 28);
            ctx.fillStyle = '#ff3300';
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        // Overpressure amber pulse when above 100%
        if (this.pumpPressure >= 1.0 && this.cavitationTimer <= 0) {
            ctx.save();
            ctx.globalAlpha = 0.06 + 0.05 * Math.sin(this.time * 12);
            ctx.fillStyle = '#ff8800';
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
    }

    _drawGrid() {
        const ctx = this.ctx;
        for (let r = 0; r < this.gridRows; r++) {
            const ry = r * CELL_SIZE;
            for (let c = 0; c < this.gridCols; c++) {
                const cell = this.grid[r]?.[c];
                if (!cell) continue;
                const cx = c * CELL_SIZE;
                let color;
                if (cell.cut >= 1) {
                    color = '#0d3a60';
                } else if (cell.cut <= 0) {
                    color = COL_UNCUT[cell.type] ?? COL_UNCUT[2];
                } else {
                    color = lerpColor(COL_UNCUT[cell.type] ?? COL_UNCUT[2],
                        COL_CUT[cell.type] ?? COL_CUT[2], cell.cut);
                }
                ctx.fillStyle = color;
                ctx.fillRect(cx, ry, CELL_SIZE - 1, CELL_SIZE - 1);

                if (cell.type === CT.ROCK && cell.cut < 1) {
                    ctx.fillStyle = 'rgba(0,0,0,0.28)';
                    ctx.fillRect(cx + 3, ry + 3, CELL_SIZE - 8, CELL_SIZE - 8);
                }
            }
        }
    }

    // Dashed arc showing the cutter head sweep path
    _drawCutFace() {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = 'rgba(45,202,114,0.65)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 6]);
        ctx.shadowColor = '#2dca72'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.spudX, this.spudY, TOTAL_LEN,
            -Math.PI / 2 - MAX_SWING,
            -Math.PI / 2 + MAX_SWING);
        ctx.stroke();
        ctx.setLineDash([]);
        // Label at current bow position
        const bow = this._bowXY();
        ctx.fillStyle = 'rgba(45,202,114,0.9)';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText('◀ CUT FACE ▶', bow.x, bow.y - 12);
        ctx.restore();
    }

    _drawCaustics() {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = '#5aeaff';
        for (let i = 0; i < 4; i++) {
            const rx = ((i * 220 + this.waveOffset * 0.6) % this.W + this.W) % this.W;
            ctx.beginPath();
            ctx.ellipse(rx, this.spudY + 40 + i * 55, 55, 14, 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // Pipeline exits from stern, curves down to bottom of screen
    _drawPipeline() {
        const ctx = this.ctx;
        ctx.save();

        const sternX = this.spudX - Math.sin(this.swingAngle) * 8;
        const sternY = this.spudY + Math.cos(this.swingAngle) * 8;

        const endX = this.spudX;
        const endY = this.H + 20; // past bottom of screen

        // Control point: pushed backward from the hull to make a curve
        const cpX = sternX - Math.sin(this.swingAngle) * 80;
        const cpY = sternY + Math.cos(this.swingAngle) * 80;

        ctx.strokeStyle = '#444'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sternX, sternY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();

        ctx.strokeStyle = '#e84040'; ctx.lineWidth = 6;
        ctx.setLineDash([18, 10]);
        ctx.beginPath();
        ctx.moveTo(sternX, sternY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
    }

    // Dashed swing-arc guide + port/stbd anchor wires
    _drawSwingWires() {
        const ctx = this.ctx;
        ctx.save();
        // Dashed arc guide (faint)
        ctx.strokeStyle = 'rgba(200,200,180,0.18)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(this.spudX, this.spudY, HULL_H + LADDER_LEN * 0.7,
            -Math.PI / 2 - MAX_SWING, -Math.PI / 2 + MAX_SWING);
        ctx.stroke();
        ctx.setLineDash([]);

        // Swing anchors placed wide and forward (top 1/3 of the screen)
        const anchorY = this.spudY - TOTAL_LEN * 1.1;
        const portBx = this.spudX - TOTAL_LEN * 1.3;
        const stbdBx = this.spudX + TOTAL_LEN * 1.3;
        const cutter = this._cutterXY();

        ctx.strokeStyle = 'rgba(200,200,180,0.5)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        for (const bx of [portBx, stbdBx]) {
            ctx.beginPath(); ctx.moveTo(cutter.x, cutter.y); ctx.lineTo(bx, anchorY); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = '#f5a623';
        for (const bx of [portBx, stbdBx]) {
            ctx.beginPath(); ctx.arc(bx, anchorY, 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // Ladder drawn in local coords, rotated around spud with the hull
    _drawLadder() {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.spudX, this.spudY);
        ctx.rotate(this.swingAngle);

        const bowLocalY = -HULL_H;
        const cuttLocalY = -HULL_H - LADDER_LEN;

        // Main ladder beam
        ctx.strokeStyle = '#5a7a5a'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, bowLocalY); ctx.lineTo(0, cuttLocalY); ctx.stroke();

        // Side rails (truss)
        ctx.strokeStyle = '#3a5a3a'; ctx.lineWidth = 3;
        for (const rx of [-8, 8]) {
            ctx.beginPath(); ctx.moveTo(rx, bowLocalY); ctx.lineTo(rx, cuttLocalY); ctx.stroke();
        }

        // Suction pipe highlight
        ctx.strokeStyle = 'rgba(100,200,255,0.3)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(0, bowLocalY); ctx.lineTo(0, cuttLocalY); ctx.stroke();

        ctx.restore();
    }

    // Hull drawn in local coords, rotated around spud
    _drawHull() {
        const ctx = this.ctx;
        const hw = HULL_W / 2, hh = HULL_H;

        ctx.save();
        ctx.translate(this.spudX, this.spudY);
        ctx.rotate(this.swingAngle);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-hw + 5, -hh + 5, HULL_W, hh + 8);

        // Hull body — bow at (0, -hh), stern at (0, +8)
        const hullG = ctx.createLinearGradient(-hw, 0, hw, 0);
        hullG.addColorStop(0, '#3a6a3a'); hullG.addColorStop(0.5, '#5ab85a'); hullG.addColorStop(1, '#3a5a3a');
        ctx.fillStyle = hullG;
        ctx.strokeStyle = '#1a3a1a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-hw + 8, -hh);
        ctx.lineTo(hw - 8, -hh);
        ctx.lineTo(hw, -hh + 18);
        ctx.lineTo(hw, 8);
        ctx.lineTo(-hw, 8);
        ctx.lineTo(-hw, -hh + 18);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Bow deck rail
        ctx.strokeStyle = '#2d8a2d'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-hw + 8, -hh + 6); ctx.lineTo(hw - 8, -hh + 6); ctx.stroke();

        // Pump house
        ctx.fillStyle = '#556655'; ctx.strokeStyle = '#334433'; ctx.lineWidth = 1.5;
        ctx.fillRect(-18, -hh * 0.65, 36, 34);
        ctx.strokeRect(-18, -hh * 0.65, 36, 34);

        // Winch drums
        for (const wx of [-hw + 14, hw - 14]) {
            ctx.fillStyle = '#888'; ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(wx, -hh * 0.38, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#aaa';
            ctx.beginPath(); ctx.arc(wx, -hh * 0.38, 4, 0, Math.PI * 2); ctx.fill();
        }

        // Name plate
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = "bold 10px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('CSD-1', 0, -hh * 0.18);

        ctx.restore();
    }

    _drawCutterHead() {
        const ctx = this.ctx;
        const { x, y } = this._cutterXY();
        const r = CUTTER_R;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.cutterRot);

        if (this.cavitationTimer <= 0) {
            ctx.shadowColor = '#e87c20'; ctx.shadowBlur = 14;
        }

        const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
        cg.addColorStop(0, '#e0a040'); cg.addColorStop(1, '#a84010');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2a1a00'; ctx.strokeStyle = '#cc6010'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            ctx.save(); ctx.rotate(i * Math.PI / 3);
            ctx.beginPath(); ctx.moveTo(0, -r + 4); ctx.lineTo(5, -r - 9); ctx.lineTo(-5, -r - 9); ctx.closePath();
            ctx.fill(); ctx.stroke(); ctx.restore();
        }

        ctx.fillStyle = '#666'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.shadowColor = 'transparent';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        if (this.cavitationTimer > 0) {
            ctx.fillStyle = 'rgba(255,50,0,0.4)';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }

    _drawSpuds() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#888'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.spudX, this.spudY, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(this.spudX, this.spudY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(200,220,255,0.7)';
        ctx.font = "10px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('SPUD', this.spudX, this.spudY + 20);
        ctx.restore();
    }

    _drawCloud(c) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#c8e8ff'; ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(c.x + c.w * 0.25, c.y + c.h * 0.5, c.h * 0.55, 0, Math.PI * 2);
        ctx.arc(c.x + c.w * 0.5, c.y + c.h * 0.3, c.h * 0.65, 0, Math.PI * 2);
        ctx.arc(c.x + c.w * 0.75, c.y + c.h * 0.5, c.h * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
