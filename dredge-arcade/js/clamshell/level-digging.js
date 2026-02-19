// js/level-digging.js — Level 1: Stationary clamshell crane with L/R barge movement

import { transitionToTransport } from '../engine.js';

// ── Constants ───────────────────────────────────────────────────────────────
const BARGE_SPEED = 90;     // px/s left/right
const SEA_LEVEL_RATIO = 0.35;   // water surface = 35% from top
const CABLE_SPEED = 140;    // px/s raise/lower
const CABLE_MIN_LEN = 30;

const GRAB_DURATION = 0.55;   // s clam stays closed during grab
const DUMP_DURATION = 0.45;   // s for material to fall into scow
const BITES_TO_FULL = 14;     // bites to fill scow

// Seabed initial depth range (fraction from bottom of screen)
const BED_HEIGHT_MIN = 0.30;   // seabed top = H*(1-0.30) = 70% of H
const BED_HEIGHT_MAX = 0.48;   // seabed bottom

// Over-depth grade line — below this screen Y the player gets penalised
// expressed as fraction from top of water surface to bottom of screen
const OVERDEPTH_FRAC = 0.55;  // 55% below the waterline is the max grade
const BUCKET_GRAB_RADIUS = 28;    // px — horizontal radius modified per bite

// Piling hazards
const PILING_INTERVAL_MIN = 8;
const PILING_INTERVAL_MAX = 18;

// Bucket state machine
const BUCK = { IDLE: 0, LOWERING: 1, GRABBING: 2, RAISING: 3, DUMPING: 4, STUCK: 5 };

const C = {
    skyTop: '#0a1628', skyBot: '#0e3a6e',
    waterTop: '#1a7abf', waterBot: '#0b3a6a',
    waterLine: 'rgba(120,220,255,0.7)',
    seabedTop: '#b49030', seabedBot: '#6b4e1a',
    seabedLine: '#7c5a22',
    bargeHull: '#4a7a4a', bargeAccent: '#5ab85a',
    craneTower: '#555', craneBoom: '#888',
    cableCol: '#aaa',
    bucketBody: '#e87c20', bucketOpen: '#c85c10',
    scowHull: '#336699', scowAccent: '#4488bb',
    scowMud: '#b49030',
    cloudWhite: '#c8e8ff',
    gradeLineCol: 'rgba(255,60,60,0.75)',
};

// ── Noise helpers ────────────────────────────────────────────────────────────
function smoothNoise(arr, x) {
    const i = Math.floor(x) % arr.length;
    const f = x - Math.floor(x);
    const a = arr[((i) + arr.length) % arr.length];
    const b = arr[((i + 1) + arr.length) % arr.length];
    return a + (b - a) * (f * f * (3 - 2 * f));
}
function makeNoise(n, seed) {
    const arr = []; let v = seed;
    for (let i = 0; i < n; i++) {
        v = (v * 16807) % 2147483647;
        arr.push((v / 2147483647) * 2 - 1);
    }
    return arr;
}

export class LevelDigging {
    constructor(ctx, canvas, game, keys) {
        this.ctx = ctx; this.canvas = canvas;
        this.game = game; this.keys = keys;
        this.W = canvas.width; this.H = canvas.height;
        this.reset();
    }

    onResize() {
        this.W = this.canvas.width; this.H = this.canvas.height;
        this._buildDims();
        this._buildSeabed();  // rebuild grid at new resolution
    }

    reset() {
        this.W = this.canvas.width; this.H = this.canvas.height;
        this._noise1 = makeNoise(128, 23456 + this.game.round * 5);
        this._noise2 = makeNoise(64, 77777 + this.game.round * 11);
        this._buildDims();
        this._buildSeabed();

        this.waveOffset = 0;
        this.time = 0;
        this.transitioned = false;

        // Cable
        this.cableLen = CABLE_MIN_LEN;
        this.cableSwing = 0;
        this.swingVel = 0;

        // Bucket state
        this.buckState = BUCK.IDLE;
        this.buckTimer = 0;
        this.bitesLoaded = 0;
        this.stuckTimer = 0;

        // Particles
        this.particles = [];

        // Pilings — fixed for the entire level, seeded by round number
        // (built after _buildSeabed so seabed is ready to sample)
        this.pilings = this._buildPilings();

        // Clouds
        this.clouds = [];
        for (let i = 0; i < 7; i++) this.clouds.push(this._mkCloud());

        this.game.scoring.startDigging();
    }

    _buildDims() {
        this.waterY = this.H * SEA_LEVEL_RATIO;

        // Barge starts centred
        if (this.bargeX === undefined) this.bargeX = this.W * 0.38;
        this.bargeY = this.waterY - 12;
        this.bargeW = 260; this.bargeH = 54;

        // Over-depth grade Y (fixed screen position relative to water)
        this.gradeY = this.waterY + (this.H - this.waterY) * OVERDEPTH_FRAC;

        this._updateAnchorPoints();
    }

    _updateAnchorPoints() {
        // Crane boom tip — moves with barge
        this.boomTipX = this.bargeX + 10;
        this.boomTipY = this.bargeY - 120;

        // Scow — fixed offset to the right of barge
        this.scowX = this.bargeX + this.bargeW * 0.5 + 95;
        this.scowY = this.waterY - 8;
        this.scowW = 200; this.scowH = 48;
        this.holdX = this.scowX - this.scowW * 0.38;
        this.holdW = this.scowW * 0.76;
        this.holdH = this.scowH * 0.55;
    }

    // ── Seabed grid (stored per screen column at 4px resolution) ────────────
    _buildSeabed() {
        const cols = Math.ceil(this.W / 4) + 1;
        this._sbCols = cols;
        this._sbStep = 4;   // px per column
        this._seabed = new Float32Array(cols);
        for (let i = 0; i < cols; i++) {
            const wx = i * this._sbStep;
            this._seabed[i] = this._baseSeabedY(wx);
        }
    }

    _baseSeabedY(screenX) {
        // Use screen X directly as indexing key (world doesn't scroll)
        const idx = screenX / 80;
        const h1 = smoothNoise(this._noise1, idx * 0.75);
        const h2 = smoothNoise(this._noise2, idx * 1.5) * 0.4;
        const frac = BED_HEIGHT_MIN + (BED_HEIGHT_MAX - BED_HEIGHT_MIN) * ((h1 + h2 + 1) / 2);
        return this.H - frac * this.H;
    }

    // Sample seabed at any screen X (interpolated)
    _seabedAt(screenX) {
        const step = this._sbStep;
        const fi = screenX / step;
        const i0 = Math.max(0, Math.min(this._sbCols - 1, Math.floor(fi)));
        const i1 = Math.max(0, Math.min(this._sbCols - 1, i0 + 1));
        const f = fi - i0;
        return this._seabed[i0] * (1 - f) + this._seabed[i1] * f;
    }

    // Deform seabed after a bucket bite
    _deformSeabed(centerX, biteDepth) {
        const step = this._sbStep;
        const cols = this._sbCols;
        for (let i = 0; i < cols; i++) {
            const sx = i * step;
            const dist = Math.abs(sx - centerX);
            if (dist > BUCKET_GRAB_RADIUS) continue;
            // Gaussian-ish falloff
            const t = 1 - dist / BUCKET_GRAB_RADIUS;
            const drop = biteDepth * t * t;  // lower = bigger Y
            const newY = this._seabed[i] + drop;
            // Never deform below grade line (capped at gradeY + a soft band)
            this._seabed[i] = Math.min(newY, this.gradeY + 2);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    _mkCloud() {
        return {
            x: Math.random() * this.W,
            y: 20 + Math.random() * (this.H * SEA_LEVEL_RATIO * 0.5),
            w: 80 + Math.random() * 110, h: 28 + Math.random() * 22,
            speed: 8 + Math.random() * 14,
        };
    }

    _bucketPos() {
        return {
            x: this.boomTipX + this.cableSwing,
            y: this.boomTipY + this.cableLen,
        };
    }

    // ── Update ───────────────────────────────────────────────────────────────
    update(dt) {
        if (this.transitioned) return;
        this.time += dt;
        this.waveOffset += dt * 50;
        this.game.hud.update(dt);

        // Clouds
        for (const c of this.clouds) {
            c.x -= c.speed * dt;
            if (c.x + c.w < 0) { c.x = this.W + 20; c.y = 20 + Math.random() * (this.H * SEA_LEVEL_RATIO * 0.5); }
        }

        // ── Barge movement (L/R) ─────────────────────────────────────────────
        const bargeLeft = this.bargeX - this.bargeW / 2;
        const bargeRight = this.bargeX + this.bargeW / 2;
        const canMoveLeft = this.buckState === BUCK.IDLE || this.buckState === BUCK.RAISING;
        const canMoveRight = canMoveLeft;

        if (this.keys.ArrowLeft && canMoveLeft && bargeLeft > 20) this.bargeX -= BARGE_SPEED * dt;
        if (this.keys.ArrowRight && canMoveRight && bargeRight < this.W - 80) this.bargeX += BARGE_SPEED * dt;

        // Clamp scow to canvas
        this.bargeX = Math.max(this.bargeW / 2 + 10, Math.min(this.W - 310, this.bargeX));
        this._updateAnchorPoints();

        // ── Bucket state machine ─────────────────────────────────────────────
        const bp = this._bucketPos();
        const seabedY = this._seabedAt(bp.x);

        switch (this.buckState) {
            case BUCK.IDLE:
                if (this.keys.ArrowDown) this.buckState = BUCK.LOWERING;
                break;

            case BUCK.LOWERING: {
                if (this.keys.ArrowDown) {
                    this.cableLen = Math.min(
                        seabedY - this.boomTipY + 4,
                        this.cableLen + CABLE_SPEED * dt
                    );
                }
                if (this.keys.ArrowUp) { this.buckState = BUCK.RAISING; break; }

                // Auto-grab on seabed contact
                if (bp.y >= seabedY - 4) {
                    // Check overdepth — if seabed is already at grade line
                    if (seabedY >= this.gradeY - 2) {
                        // Stuck in overdepth zone
                        this.buckState = BUCK.STUCK;
                        this.stuckTimer = 1.2;
                        const pen = this.game.scoring.applyPilingPenalty();
                        this.game.hud.flash(`OVERDEPTH! −${pen}`, '#ff4444');
                        this.game.hud.flashPenalty();
                    } else {
                        this.cableLen = seabedY - this.boomTipY;
                        this.buckState = BUCK.GRABBING;
                        this.buckTimer = GRAB_DURATION;
                        this._spawnGrabParticles(bp.x, bp.y);
                    }
                }
                break;
            }

            case BUCK.GRABBING:
                this.buckTimer -= dt;
                this.swingVel += (Math.random() - 0.5) * 2;
                if (this.buckTimer <= 0) {
                    this.bitesLoaded++;
                    const pts = this.game.scoring.onBite();
                    this.game.hud.flash(`+${pts} pts`, '#2dca72');

                    // Deform seabed — lower it at the grab point
                    const biteDropPx = 22 + Math.random() * 14;  // 22–36 px drop
                    this._deformSeabed(bp.x, biteDropPx);

                    this.buckState = BUCK.RAISING;
                }
                break;

            case BUCK.RAISING:
                this.cableLen = Math.max(CABLE_MIN_LEN, this.cableLen - CABLE_SPEED * dt);
                if (this.cableLen <= CABLE_MIN_LEN + 2) {
                    if (this.bitesLoaded > 0) {
                        this.buckState = BUCK.DUMPING;
                        this.buckTimer = DUMP_DURATION;
                        this._spawnDumpParticles(this.scowX, this.scowY + 4);
                    } else {
                        this.buckState = BUCK.IDLE;
                    }
                }
                break;

            case BUCK.DUMPING:
                this.buckTimer -= dt;
                if (this.buckTimer <= 0) {
                    const fillDelta = 1 / BITES_TO_FULL;
                    this.game.scowFill = Math.min(1, this.game.scowFill + fillDelta);
                    this.buckState = BUCK.IDLE;
                    this.bitesLoaded = 0;
                }
                break;

            case BUCK.STUCK:
                // Force raise, penalise, flash red screen
                this.stuckTimer -= dt;
                this.cableLen = Math.max(CABLE_MIN_LEN, this.cableLen - CABLE_SPEED * 0.6 * dt);
                if (this.stuckTimer <= 0) this.buckState = BUCK.IDLE;
                break;
        }

        // Cable swing physics
        this.swingVel += -(this.cableSwing) * 0.5 * dt;
        this.swingVel *= Math.pow(1 - 3.5 * dt, 1);
        this.cableSwing += this.swingVel;
        this.cableSwing = Math.max(-80, Math.min(80, this.cableSwing));

        // Collision: bucket vs pilings
        if (this.buckState === BUCK.LOWERING || this.buckState === BUCK.GRABBING) {
            for (const p of this.pilings) {
                if (p.hit) continue;
                const bpNow = this._bucketPos();
                const dx = bpNow.x - p.screenX;
                const dy = bpNow.y - p.topY;
                if (Math.abs(dx) < 20 && dy > -10 && dy < 50) {
                    p.hit = true;
                    this.swingVel += (Math.random() > 0.5 ? 1 : -1) * 35;
                    const pen = this.game.scoring.applyPilingPenalty();
                    this.game.hud.flash(`PILING HIT! −${pen} pts`, '#ff4444');
                    this.game.hud.flashPenalty();
                    this.buckState = BUCK.RAISING;
                }
            }
        }

        // Particles
        this.particles = this.particles.filter(p => {
            p.life -= dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vy += 60 * dt;
            return p.life > 0;
        });

        // Transition when scow full
        if (this.game.scowFill >= 1 && !this.transitioned) {
            this.transitioned = true;
            const bonus = this.game.scoring.finishDigging();
            this.game.hud.flash(`SCOW FULL! +${bonus} pts`, '#f5a623');
            setTimeout(() => transitionToTransport(), 1400);
        }
    }

    // ── Particle factories ───────────────────────────────────────────────────
    _spawnGrabParticles(x, y) {
        for (let i = 0; i < 18; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 25 + Math.random() * 60;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20,
                size: 3 + Math.random() * 5,
                life: 0.6 + Math.random() * 0.5,
                color: `hsl(${32 + Math.random() * 16},68%,${36 + Math.random() * 18}%)`,
            });
        }
    }

    _spawnDumpParticles(x, y) {
        for (let i = 0; i < 14; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 30, y,
                vx: (Math.random() - 0.5) * 50,
                vy: 20 + Math.random() * 40,
                size: 4 + Math.random() * 6,
                life: 0.5 + Math.random() * 0.4,
                color: `hsl(${32 + Math.random() * 16},65%,38%)`,
            });
        }
    }

    // Build a deterministic, fixed set of pilings for the level.
    // Seeded by round number so each round has different positions.
    _buildPilings() {
        const list = [];
        // Five pilings spread across the screen — avoid the leftmost barge start zone
        const slots = [0.15, 0.30, 0.52, 0.68, 0.83];
        let rng = 42 + this.game.round * 137;
        const rand = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647; };

        for (const t of slots) {
            const screenX = this.W * t + (rand() - 0.5) * 60;
            const clamped = Math.max(30, Math.min(this.W - 30, screenX));
            const sbY = this._seabedAt(clamped);
            const pilingH = 70 + rand() * 130;
            list.push({
                screenX: clamped,
                topY: sbY - pilingH,
                height: pilingH,
                w: 14 + rand() * 10,
                hit: false,
                hue: rand() < 0.5 ? 30 : 200,
            });
        }
        return list;
    }

    // ── Drawing ──────────────────────────────────────────────────────────────
    draw() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;
        const waterY = H * SEA_LEVEL_RATIO;

        // Sky
        const skyG = ctx.createLinearGradient(0, 0, 0, waterY);
        skyG.addColorStop(0, C.skyTop); skyG.addColorStop(1, C.skyBot);
        ctx.fillStyle = skyG;
        ctx.fillRect(0, 0, W, waterY);

        // Moon / sun
        ctx.save();
        ctx.fillStyle = '#ffd040'; ctx.shadowColor = '#ffa020'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(W * 0.84, H * 0.08, 36, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Clouds
        for (const c of this.clouds) this._drawCloud(c);

        // Water body
        const seaG = ctx.createLinearGradient(0, waterY, 0, H);
        seaG.addColorStop(0, C.waterTop); seaG.addColorStop(1, C.waterBot);
        ctx.fillStyle = seaG;
        ctx.fillRect(0, waterY, W, H - waterY);

        // Seabed
        this._drawSeabed();

        // Over-depth grade line
        this._drawGradeLine();

        // Caustic rays
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#aee8ff';
        for (let i = 0; i < 5; i++) {
            const rx = ((i * 180 + this.time * 8) % W + W) % W;
            ctx.beginPath();
            ctx.moveTo(rx - 30, waterY); ctx.lineTo(rx + 30, waterY);
            ctx.lineTo(rx + 8, H); ctx.lineTo(rx - 52, H);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        // Wave line
        ctx.save();
        ctx.strokeStyle = C.waterLine; ctx.lineWidth = 3;
        ctx.shadowColor = '#88ddff'; ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
            const y = waterY + Math.sin((x + this.waveOffset) * 0.025) * 5
                + Math.sin((x + this.waveOffset * 0.7) * 0.05) * 3;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Pilings
        for (const p of this.pilings) this._drawPiling(p);

        // Cable + bucket (drawn BEFORE barge hull so barge covers cable base)
        this._drawCraneAndBucket();

        // Particles
        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // Barge and scow on top
        this._drawCraneBarge();
        this._drawScow();

        // Red flash on stuck
        if (this.buckState === BUCK.STUCK) {
            ctx.save();
            ctx.globalAlpha = 0.12 + 0.08 * Math.sin(this.time * 20);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

    }

    _drawGradeLine() {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = C.gradeLineCol;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([14, 8]);
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(0, this.gradeY);
        ctx.lineTo(this.W, this.gradeY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.font = 'bold 11px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(255,100,100,0.9)';
        ctx.fillText('▶ OVERDEPTH LIMIT', 8, this.gradeY - 5);
        ctx.restore();
    }



    _drawCloud(c) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = C.cloudWhite; ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(c.x + c.w * 0.25, c.y + c.h * 0.5, c.h * 0.55, 0, Math.PI * 2);
        ctx.arc(c.x + c.w * 0.5, c.y + c.h * 0.3, c.h * 0.65, 0, Math.PI * 2);
        ctx.arc(c.x + c.w * 0.75, c.y + c.h * 0.5, c.h * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawSeabed() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-2, H);
        for (let sx = 0; sx <= W + 4; sx += 4) {
            ctx.lineTo(sx, this._seabedAt(sx));
        }
        ctx.lineTo(W + 2, H);
        ctx.closePath();
        const bedG = ctx.createLinearGradient(0, H * 0.62, 0, H);
        bedG.addColorStop(0, C.seabedTop); bedG.addColorStop(1, C.seabedBot);
        ctx.fillStyle = bedG; ctx.fill();

        ctx.strokeStyle = C.seabedLine; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let sx = 0; sx <= W + 4; sx += 4) {
            const sy = this._seabedAt(sx);
            if (sx === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Pebbles
        ctx.fillStyle = '#8a6228';
        for (let i = 0; i < 18; i++) {
            const px = ((i * 137 + this.time * 0.7) % W + W) % W;
            const psy = this._seabedAt(px);
            ctx.beginPath();
            ctx.ellipse(px, psy - 5, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    _drawPiling(p) {
        const ctx = this.ctx;
        ctx.save();
        const x = p.screenX;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 4, p.topY + 4, p.w, p.height);
        const g = ctx.createLinearGradient(x, p.topY, x + p.w, p.topY);
        if (p.hue === 30) {
            g.addColorStop(0, '#8b6040'); g.addColorStop(0.5, '#c49060'); g.addColorStop(1, '#7a5030');
        } else {
            g.addColorStop(0, '#445566'); g.addColorStop(0.5, '#7799aa'); g.addColorStop(1, '#334455');
        }
        ctx.fillStyle = g;
        ctx.fillRect(x, p.topY, p.w, p.height);
        ctx.fillStyle = p.hit ? '#ff4444' : (p.hue === 30 ? '#a87848' : '#6688aa');
        ctx.fillRect(x - 4, p.topY, p.w + 8, 10);
        ctx.restore();
    }

    // ── Crane tower, boom, cable ─────────────────────────────────────────────
    _drawCraneAndBucket() {
        const ctx = this.ctx;
        const bx = this.bargeX, by = this.bargeY;
        const bw = this.bargeW;

        const towerBaseL = bx - bw * 0.08;
        const towerBaseR = bx + bw * 0.04;
        const towerTop = by - 120;

        ctx.save();
        ctx.strokeStyle = C.craneTower; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(towerBaseL, by); ctx.lineTo(this.boomTipX, towerTop); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(towerBaseR, by); ctx.lineTo(this.boomTipX, towerTop); ctx.stroke();
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(towerBaseL, by - 45); ctx.lineTo(towerBaseR, by - 70); ctx.stroke();

        ctx.strokeStyle = C.craneBoom; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(this.boomTipX, towerTop); ctx.lineTo(bx + bw * 0.40, by - 55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.boomTipX, towerTop); ctx.lineTo(bx - bw * 0.32, by - 30); ctx.stroke();
        ctx.strokeStyle = C.cableCol; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(this.boomTipX, towerTop); ctx.lineTo(bx - bw * 0.28, by); ctx.stroke();
        ctx.restore();

        // Hoist cable
        const bp = this._bucketPos();
        ctx.save();
        ctx.strokeStyle = C.cableCol; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(this.boomTipX, this.boomTipY); ctx.lineTo(bp.x, bp.y); ctx.stroke();
        ctx.restore();

        // Sheave
        ctx.save();
        ctx.fillStyle = '#777'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.boomTipX, this.boomTipY, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();

        this._drawBucket(bp.x, bp.y);
    }

    // ── Clamshell bucket — vertical jaw design ───────────────────────────────
    // Two curved jaws (top + bottom) that open vertically like a pair of tongs
    _drawBucket(x, y) {
        const ctx = this.ctx;
        const isOpen = this.buckState === BUCK.IDLE || this.buckState === BUCK.LOWERING;
        const isRaising = this.buckState === BUCK.RAISING || this.buckState === BUCK.STUCK;
        const isGrab = this.buckState === BUCK.GRABBING;
        const isDump = this.buckState === BUCK.DUMPING;
        const isStuck = this.buckState === BUCK.STUCK;
        const grabT = isGrab ? (1 - this.buckTimer / GRAB_DURATION) : 0;

        // Gap between jaw tips: large when open, 0 when closed/raising
        const maxGap = 22;  // px open gap (radius from centre to each tip)
        const jawGap = isOpen ? maxGap : (isRaising ? 0 : isDump ? maxGap * 0.7 : maxGap * (1 - grabT));

        const jawW = 28;   // horizontal extent of each jaw
        const jawH = 18;   // height of each jaw blade

        // Colour shifts
        const bodyCol = isStuck ? '#cc3300' : isGrab ? '#c85c10' : C.bucketBody;

        ctx.save();
        ctx.translate(x, y);

        // ── Hanger link (small rectangle connecting cable to bucket) ─────────
        ctx.fillStyle = '#888'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-6, -14, 12, 14, 3);
        ctx.fill(); ctx.stroke();

        // ── Two connecting side links ─────────────────────────────────────────
        for (const lx of [-8, 8]) {
            ctx.beginPath(); ctx.moveTo(lx, -2); ctx.lineTo(lx, 4); ctx.stroke();
        }

        // ── Draw jaw (shared helper) ──────────────────────────────────────────
        // sign: -1 = top jaw (flips up), +1 = bottom jaw (flips down)
        const drawJaw = (sign) => {
            ctx.save();
            // Pivot at y=0, tip travels ±jawGap
            ctx.translate(0, sign * jawGap);

            // Jaw body — a rounded trapezoid viewed from the side
            const g = ctx.createLinearGradient(-jawW, 0, jawW, sign * jawH);
            if (sign < 0) {
                g.addColorStop(0, '#d06010'); g.addColorStop(1, bodyCol);
            } else {
                g.addColorStop(0, bodyCol); g.addColorStop(1, '#a84010');
            }
            ctx.fillStyle = g;
            ctx.strokeStyle = '#1a0a00'; ctx.lineWidth = 2;

            ctx.beginPath();
            // Two halves form a D-shape pointing inward
            if (sign < 0) {
                // Top jaw — concave on bottom, convex on top
                ctx.moveTo(-jawW, 0);
                ctx.lineTo(jawW, 0);
                ctx.lineTo(jawW * 0.65, -jawH);
                ctx.quadraticCurveTo(0, -jawH * 0.7, -jawW * 0.65, -jawH);
                ctx.closePath();
            } else {
                // Bottom jaw — concave on top, convex on bottom
                ctx.moveTo(-jawW, 0);
                ctx.lineTo(jawW, 0);
                ctx.lineTo(jawW * 0.65, jawH);
                ctx.quadraticCurveTo(0, jawH * 0.7, -jawW * 0.65, jawH);
                ctx.closePath();
            }
            ctx.fill(); ctx.stroke();

            // Teeth along the inner lip
            ctx.fillStyle = '#2a1a00';
            const toothCount = 5;
            for (let i = 0; i < toothCount; i++) {
                const tx = -jawW * 0.7 + (i / (toothCount - 1)) * jawW * 1.4;
                const ty = 0;
                ctx.beginPath();
                ctx.moveTo(tx - 3, ty);
                ctx.lineTo(tx, ty + sign * 7);
                ctx.lineTo(tx + 3, ty);
                ctx.closePath();
                ctx.fill();
            }

            // Mud fill when closed/grabbing
            if (!isOpen && !isDump) {
                ctx.globalAlpha = 0.65;
                ctx.fillStyle = '#b49030';
                ctx.beginPath();
                ctx.ellipse(0, sign * jawGap * 0.3, jawW * 0.6, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            ctx.restore();
        };

        drawJaw(-1);  // top jaw
        drawJaw(+1);  // bottom jaw

        // Centre pivot pin
        ctx.fillStyle = '#555'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        ctx.restore();
    }

    _drawCraneBarge() {
        const ctx = this.ctx;
        const x = this.bargeX - this.bargeW / 2;
        const y = this.bargeY;
        const W = this.bargeW, H = this.bargeH;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 6, y + 6, W, H);

        const hullG = ctx.createLinearGradient(x, y, x, y + H);
        hullG.addColorStop(0, C.bargeAccent); hullG.addColorStop(1, C.bargeHull);
        ctx.fillStyle = hullG;
        ctx.strokeStyle = '#1a321a'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 10, y);
        ctx.lineTo(x + W - 10, y);
        ctx.lineTo(x + W, y + H * 0.5);
        ctx.lineTo(x + W - 5, y + H);
        ctx.lineTo(x + 5, y + H);
        ctx.lineTo(x, y + H * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.strokeStyle = C.bargeAccent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 14, y + 6); ctx.lineTo(x + W - 14, y + 6); ctx.stroke();

        ctx.fillStyle = '#888';
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(x + 30 + i * (W - 60) / 4, y + 14, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#3a3aaa'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(x + W - 65, y - 28, 52, 28, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(180,230,255,0.8)';
        for (let i = 0; i < 2; i++) {
            ctx.beginPath(); ctx.roundRect(x + W - 60 + i * 22, y - 22, 16, 12, 3); ctx.fill();
        }

        ctx.save(); ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.ellipse(x + W + 2, y + H * 0.6, 14, 6, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.restore();
    }

    _drawScow() {
        const ctx = this.ctx;
        const sx = this.scowX - this.scowW / 2;
        const sy = this.scowY;
        const W = this.scowW, H = this.scowH;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(sx + 5, sy + 5, W, H);

        const hullG = ctx.createLinearGradient(sx, sy, sx, sy + H);
        hullG.addColorStop(0, C.scowAccent); hullG.addColorStop(1, C.scowHull);
        ctx.fillStyle = hullG; ctx.strokeStyle = '#1a2a44'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx + 8, sy); ctx.lineTo(sx + W - 8, sy);
        ctx.lineTo(sx + W, sy + H * 0.45); ctx.lineTo(sx + W - 4, sy + H);
        ctx.lineTo(sx + 4, sy + H); ctx.lineTo(sx, sy + H * 0.45);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        const hx = this.holdX, hy = sy + 6, hw = this.holdW, hht = this.holdH;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.strokeStyle = '#224'; ctx.lineWidth = 2;
        ctx.fillRect(hx, hy, hw, hht); ctx.strokeRect(hx, hy, hw, hht);

        if (this.game.scowFill > 0) {
            const fh = hht * this.game.scowFill;
            const mudG = ctx.createLinearGradient(hx, hy + hht - fh, hx, hy + hht);
            mudG.addColorStop(0, '#c8a040'); mudG.addColorStop(1, '#7a5010');
            ctx.fillStyle = mudG;
            ctx.fillRect(hx, hy + hht - fh, hw, fh);
            ctx.fillStyle = 'rgba(40,100,180,0.35)';
            ctx.fillRect(hx, hy + hht - fh, hw, 5);
        }

        ctx.strokeStyle = C.scowAccent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx + 10, sy + 3); ctx.lineTo(sx + W - 10, sy + 3); ctx.stroke();

        ctx.fillStyle = '#aaa';
        for (const cx of [sx + 16, sx + W - 16]) {
            ctx.beginPath(); ctx.arc(cx, sy + 10, 5, 0, Math.PI * 2); ctx.fill();
        }

        // Tow line
        ctx.strokeStyle = C.cableCol; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, sy + H * 0.4);
        ctx.lineTo(this.bargeX + this.bargeW * 0.5 - 20, this.bargeY + this.bargeH * 0.4);
        ctx.stroke(); ctx.setLineDash([]);

        ctx.restore();
    }
}
