// js/level-loading.js — Level 1: Side-scrolling dredging (pivot-arm draghead)

import { transitionToDisposal, showGameOver } from '../engine.js';

const SHIP_SPEED = 60;           // px/s horizontal scroll
const SEABED_SEGMENTS = 180;     // terrain resolution
const SEA_LEVEL_RATIO = 0.38;    // water surface at 38% from top
const ARM_ROTATE_SPEED = 0.75;   // radians/s — slower for finer bottom-following control
const ARM_LENGTH = 220;          // fixed pixel length of suction arm
// Arm angle limits (measured from hull stern vertical):
//   0 = pointing straight down, positive = swept back, negative = pushed forward
const ARM_ANGLE_MIN = -0.18;     // nearly vertical forward
const ARM_ANGLE_MAX = 1.65;      // swept back to surface level (horizontal)
const ARM_ANGLE_DEFAULT = 0.55;  // start mid-range

const COLLECTION_RATE = 0.065;   // fraction of hopper filled per second of contact (~15s full)
const MAX_EMBED_DEPTH = 8;       // px below seabed before grounding triggers (~2m)
const GROUNDING_PENALTY_TIME = 1.8; // seconds the dredge is slowed when grounded

const WORLD_WIDTH = 2400;        // Looping terrain width (px)
const SEABED_STEP = 4;           // Seabed array resolution (px)

// Seabed close to surface — ship can almost always reach with good arm angle
// expressed as fraction of H from the bottom
const SEABED_HEIGHT_MIN = 0.30;  // shallowest areas (30% from bottom)
const SEABED_HEIGHT_MAX = 0.50;  // deepest areas   (50% from bottom)

const TURTLE_INTERVAL_MIN = 6;
const TURTLE_INTERVAL_MAX = 14;

const C = {
    skyTop: '#0a1628',
    skyBot: '#0f3a6e',
    cloudWhite: '#c8e8ff',
    waterTop: '#1a7abf',
    waterBot: '#0b3a6a',
    waterLine: 'rgba(120,220,255,0.7)',
    seabedTop: '#b8923a',
    seabedBot: '#6b4e1a',
    seabedLine: '#7c5a22',
    hullBody: '#3a8a3a',
    hullHighlight: '#5ab85a',
    hopperFill: '#c8921a',
    hopperEmpty: '#555',
    hopperWater: 'rgba(40,140,220,0.5)',
    dragheadBody: '#e87c20',
    dragheadOutline: '#222',
    turtleBody: '#3a8a3a',
    gradeLineCol: 'rgba(255,60,60,0.75)',
};

// ── Noise ───────────────────────────────────────────────────────────────────
function smoothNoise(arr, x) {
    const i = Math.floor(x) % arr.length;
    const f = x - Math.floor(x);
    const a = arr[((i) + arr.length) % arr.length];
    const b = arr[((i + 1) + arr.length) % arr.length];
    return a + (b - a) * (f * f * (3 - 2 * f));
}

function makeNoiseArr(n, seed) {
    const arr = [];
    let v = seed;
    for (let i = 0; i < n; i++) {
        v = (v * 16807 + 0) % 2147483647;
        arr.push((v / 2147483647) * 2 - 1);
    }
    return arr;
}

export class LevelLoading {
    constructor(ctx, canvas, game, keys) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.game = game;
        this.keys = keys;
        this.W = canvas.width;
        this.H = canvas.height;
        this.reset();
    }

    onResize() {
        this.W = this.canvas.width;
        this.H = this.canvas.height;
        this._buildDimensions();

        // Rebuild base noise geometry to fit new H, restoring deformed state
        if (this.game.hopperSeabedState) {
            this._noiseArr1 = this.game.hopperSeabedState.noise1;
            this._noiseArr2 = this.game.hopperSeabedState.noise2;
        }
        this._buildSeabed();
    }

    reset() {
        this.W = this.canvas.width;
        this.H = this.canvas.height;

        // Ship geometry
        this.shipX = this.W * 0.38;   // fixed horizontal position on screen
        this.shipW = 220;
        this.shipH = 70;

        // Scrolling world offset
        this.scrollX = 0;

        // Pivot-arm: angle (radians from stern-downward vertical)
        this.armAngle = ARM_ANGLE_DEFAULT;

        // Grounding state
        this.grounded = false;
        this.groundedTimer = 0;
        this.groundWarningFlash = 0;

        this._buildDimensions();

        // Seabed initialization
        if (!this.game.hopperSeabedState) {
            this._noiseArr1 = makeNoiseArr(128, 12345);
            this._noiseArr2 = makeNoiseArr(64, 99991);
            this._buildSeabed();
        } else {
            this._noiseArr1 = this.game.hopperSeabedState.noise1;
            this._noiseArr2 = this.game.hopperSeabedState.noise2;
            this._seabed = this.game.hopperSeabedState.seabed;
        }

        // Particles
        this.particles = [];

        // Turtles
        this.turtles = [];
        this.nextTurtleTime = TURTLE_INTERVAL_MIN + Math.random() * (TURTLE_INTERVAL_MAX - TURTLE_INTERVAL_MIN);
        this.turtleTimer = 0;

        // Clouds
        this.clouds = [];
        for (let i = 0; i < 6; i++) {
            this.clouds.push({
                x: Math.random() * this.W,
                y: 30 + Math.random() * (this.H * SEA_LEVEL_RATIO * 0.55),
                w: 80 + Math.random() * 100,
                h: 28 + Math.random() * 22,
                speed: 10 + Math.random() * 16,
            });
        }

        this.waveOffset = 0;
        this.transitioned = false;
        this.time = 0;

        this.game.scoring.startLoading();
    }

    _buildDimensions() {
        const H = this.H;
        this.waterY = H * SEA_LEVEL_RATIO;
        // Ship sits on water surface — hull bottom just below waterline
        this.shipWorldY = this.waterY - this.shipH * 0.6;
        // Pivot point: rear underside of hull (stern)
        // x = shipX + half shipW toward stern (stern is to the left/rear in this orientation)
        // In our drawing the stern is actually behind — let's define: ship moves right,
        // bow is right side, stern is left side.
        // Pivot exits from the STERN side at the waterline.
        this.pivotOffsetX = -this.shipW * 0.32;  // behind center
        this.pivotOffsetY = this.shipH * 0.82;    // near hull bottom

        // Overdepth limit
        const piv = {
            x: this.shipX + this.pivotOffsetX,
            y: this.shipWorldY + this.pivotOffsetY,
        };
        const maxReachY = piv.y + ARM_LENGTH;
        this.gradeY = this.waterY + (maxReachY - this.waterY) * 0.9;
    }

    // Compute pivot world position
    _pivotPos() {
        return {
            x: this.shipX + this.pivotOffsetX,
            y: this.shipWorldY + this.pivotOffsetY,
        };
    }

    // Compute draghead tip position from arm angle
    _dragheadPos() {
        const piv = this._pivotPos();
        // Angle: 0 = straight down, positive = swept aft (back/left)
        // The arm hangs down and can sweep from nearly vertical to swept far back
        return {
            x: piv.x - Math.sin(this.armAngle) * ARM_LENGTH,
            y: piv.y + Math.cos(this.armAngle) * ARM_LENGTH,
        };
    }

    _buildSeabed() {
        const cols = Math.ceil(WORLD_WIDTH / SEABED_STEP);
        this._seabed = new Float32Array(cols);
        for (let i = 0; i < cols; i++) {
            const wx = i * SEABED_STEP;
            this._seabed[i] = this._baseSeabedY(wx);
        }

        this.game.hopperSeabedState = {
            noise1: this._noiseArr1,
            noise2: this._noiseArr2,
            seabed: this._seabed,
        };
    }

    _baseSeabedY(worldX) {
        const segW = 120; // world pixels per segment
        const idx = worldX / segW;
        const h1 = smoothNoise(this._noiseArr1, idx * 0.8);
        const h2 = smoothNoise(this._noiseArr2, idx * 1.6) * 0.45;
        const noise = (h1 + h2 + 1) / 2;

        const piv = this._pivotPos();
        const maxReachY = piv.y + ARM_LENGTH;
        const reachRange = maxReachY - this.waterY;

        // Seabed depth scales natively with the arm length so that it's
        // always reachable and always leaves room before the gradeLine (which is 90%).
        return this.waterY + reachRange * (0.4 + 0.45 * noise);
    }

    _seabedAt(worldX) {
        const wrappedX = ((worldX % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
        const fi = wrappedX / SEABED_STEP;
        const cols = this._seabed.length;
        const i0 = Math.floor(fi) % cols;
        const i1 = (i0 + 1) % cols;
        const f = fi - Math.floor(fi);
        return this._seabed[i0] * (1 - f) + this._seabed[i1] * f;
    }

    _deformSeabed(worldX, amount) {
        const wrappedX = ((worldX % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
        const cols = this._seabed.length;
        const radius = 50; // Wider trench effect

        for (let i = 0; i < cols; i++) {
            const wx = i * SEABED_STEP;
            let dist = Math.abs(wx - wrappedX);
            // Handle wrap-around distance
            if (dist > WORLD_WIDTH / 2) {
                dist = WORLD_WIDTH - dist;
            }

            if (dist <= radius) {
                const t = 1 - (dist / radius);
                const drop = amount * t * t;
                const newY = this._seabed[i] + drop;
                // Cap the trench depth so it doesn't go below the overdepth limit.
                // We also use Math.max so that we NEVER lift material UP if the seabead
                // was somehow naturally deeper than the limit.
                this._seabed[i] = Math.max(this._seabed[i], Math.min(newY, this.gradeY + 2));
            }
        }
    }

    _getSeabedYAtDraghead() {
        const dh = this._dragheadPos();
        return this._seabedAt(dh.x + this.scrollX);
    }

    update(dt) {
        if (this.transitioned) return;
        this.time += dt;
        this.waveOffset += dt * 55;
        this.game.hud.update(dt);

        // Scroll world (slow down if grounded)
        const speedMult = this.grounded ? 0.2 : 1.0;
        this.scrollX += SHIP_SPEED * speedMult * dt;

        // Clouds
        for (const c of this.clouds) {
            c.x -= c.speed * speedMult * dt;
            if (c.x + c.w < 0) { c.x = this.W + 20; c.y = 30 + Math.random() * (this.H * SEA_LEVEL_RATIO * 0.55); }
        }

        // Arm angle control — REVERSED per user request:
        // Up = sweep arm AFT (lower tip toward seabed)
        // Down = sweep arm FORWARD (raise tip away from seabed)
        if (this.keys.ArrowUp) {
            this.armAngle = Math.min(ARM_ANGLE_MAX, this.armAngle + ARM_ROTATE_SPEED * dt);
        }
        if (this.keys.ArrowDown) {
            this.armAngle = Math.max(ARM_ANGLE_MIN, this.armAngle - ARM_ROTATE_SPEED * dt);
        }

        // Draghead vs seabed
        const dh = this._dragheadPos();
        const dhWorldX = dh.x + this.scrollX;
        const seabedY = this._seabedAt(dhWorldX);
        const embedDepth = dh.y - seabedY; // positive = below seabed (bad)

        // Grounding check
        if (embedDepth > MAX_EMBED_DEPTH) {
            if (!this.grounded) {
                // If seabed is at grade line limit, we trigger overdepth penalty instead of grounding
                if (seabedY >= this.gradeY - 2) {
                    this.armAngle = Math.max(ARM_ANGLE_MIN, this.armAngle - 0.2); // Force arm up

                    if (this.groundWarningFlash <= 0) {
                        this.groundWarningFlash = 1.0;
                        const pen = this.game.scoring.applyOverdepthPenalty();
                        this.game.hud.flash(`OVERDEPTH! −${pen}`, '#ff4444');
                        this.game.hud.flashPenalty();

                        if (this.game.penalties >= 3 && !this.transitioned) {
                            this.transitioned = true;
                            setTimeout(() => showGameOver(), 1400);
                        }
                    }
                } else {
                    // Regular grounding
                    this.grounded = true;
                    this.groundedTimer = GROUNDING_PENALTY_TIME;
                    this.groundWarningFlash = 1.5;
                    this.game.hud.flash('GROUNDED! Raise the arm!', '#ff4444');
                    this.game.hud.flashPenalty();
                }
            }
        }

        if (this.grounded) {
            this.groundedTimer -= dt;
            this.groundWarningFlash -= dt;
            if (this.groundedTimer <= 0 || embedDepth <= 0) {
                this.grounded = false;
                this.groundedTimer = 0;
            }
        }

        // Collection: draghead tip within sweet-spot above seabed (0–18px above)
        const clearance = seabedY - dh.y; // positive = above seabed
        const inSweetSpot = clearance >= 0 && clearance <= 36;
        if (inSweetSpot && this.game.hopperFill < 1) {
            const delta = COLLECTION_RATE * dt;
            this.game.hopperFill = Math.min(1, this.game.hopperFill + delta);
            this.game.scoring.onMaterialLoaded(delta);
            this._deformSeabed(dhWorldX, 450 * delta); // Deeper material removal (450px removed over 1 full hopper)
            if (Math.random() < 0.35) this._spawnParticle(dh.x, dh.y);
        }

        // Particles
        this.particles = this.particles.filter(p => {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 55 * dt;
            return p.life > 0;
        });

        // Turtles
        this.turtleTimer += dt;
        if (this.turtleTimer >= this.nextTurtleTime) {
            this._spawnTurtle();
            this.turtleTimer = 0;
            this.nextTurtleTime = TURTLE_INTERVAL_MIN + Math.random() * (TURTLE_INTERVAL_MAX - TURTLE_INTERVAL_MIN);
        }
        for (const t of this.turtles) {
            t.x += t.vx * dt;
            t.y += t.vy * dt + Math.sin(this.time * 2 + t.phase) * 8 * dt;
            t.animTime += dt;
        }
        this.turtles = this.turtles.filter(t => t.x > -120 && t.x < this.W + 120);

        // Collision: draghead vs turtles
        for (const t of this.turtles) {
            if (t.hit) continue;
            const dx = t.x - dh.x;
            const dy = t.y - dh.y;
            if (Math.abs(dx) < 32 && Math.abs(dy) < 28) {
                t.hit = true;
                const penalty = this.game.scoring.applyTurtlePenalty();
                this.game.hud.flash(`TURTLE HIT! −${penalty} pts`, '#ff4444');
                this.game.hud.flashPenalty();

                if (this.game.turtlePenalties >= 3 && !this.transitioned) {
                    this.transitioned = true;
                    setTimeout(() => showGameOver(), 1400);
                }
            }
        }

        // Transition when full
        if (this.game.hopperFill >= 1 && !this.transitioned) {
            this.transitioned = true;
            const pts = this.game.scoring.finishLoading();
            this.game.hud.flash(`HOPPER FULL! +${pts} pts`, '#f5a623');
            setTimeout(() => transitionToDisposal(), 1200);
        }

        // Check if level is completely cleared
        if (!this.transitioned) {
            let cleared = true;
            for (let i = 0; i < this._seabed.length; i++) {
                if (this._seabed[i] < this.gradeY - 4) {
                    cleared = false;
                    break;
                }
            }
            if (cleared) {
                this.transitioned = true;
                this.game.score += 5000;
                this.game.hud.flash('SEABED CLEARED! +5000 pts', '#2dca72');
                setTimeout(() => showGameOver(), 3000);
            }
        }
    }

    _spawnParticle(x, y) {
        this.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 60,
            vy: -25 - Math.random() * 35,
            size: 3 + Math.random() * 5,
            life: 0.5 + Math.random() * 0.5,
            maxLife: 1,
            color: `hsl(${28 + Math.random() * 18},72%,${38 + Math.random() * 20}%)`,
        });
    }

    _spawnTurtle() {
        const fromRight = Math.random() < 0.5;
        const waterY = this.H * SEA_LEVEL_RATIO;
        // Turtle spawns somewhere in the water column in front of the ship
        const seabedSample = this._seabedAt(this.scrollX + (fromRight ? this.W + 60 : -60));
        const y = waterY + 30 + Math.random() * Math.max(30, seabedSample - waterY - 60);
        this.turtles.push({
            x: fromRight ? this.W + 60 : -60,
            y,
            vx: fromRight ? -(38 + Math.random() * 28) : (38 + Math.random() * 28),
            vy: 0,
            phase: Math.random() * Math.PI * 2,
            animTime: 0,
            flipX: fromRight,
            hit: false,
        });
    }

    // ── Drawing ──────────────────────────────────────────────────────────────

    draw() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;
        const waterY = H * SEA_LEVEL_RATIO;

        // Sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, waterY);
        skyGrad.addColorStop(0, C.skyTop);
        skyGrad.addColorStop(1, C.skyBot);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, waterY);

        // Sun
        ctx.save();
        ctx.fillStyle = '#ffd040';
        ctx.shadowColor = '#ffa020';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(W * 0.82, H * 0.08, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Clouds
        for (const c of this.clouds) this._drawCloud(c.x, c.y, c.w, c.h);

        // Water body
        const seaGrad = ctx.createLinearGradient(0, waterY, 0, H);
        seaGrad.addColorStop(0, C.waterTop);
        seaGrad.addColorStop(1, C.waterBot);
        ctx.fillStyle = seaGrad;
        ctx.fillRect(0, waterY, W, H - waterY);

        // Seabed
        this._drawSeabed();

        // Grade line
        this._drawGradeLine();

        // Caustic light rays
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#aee8ff';
        for (let i = 0; i < 5; i++) {
            const rx = (i * 180 + this.scrollX * 0.1) % W;
            ctx.beginPath();
            ctx.moveTo(rx - 30, waterY);
            ctx.lineTo(rx + 30, waterY);
            ctx.lineTo(rx + 10, H);
            ctx.lineTo(rx - 50, H);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // Wave surface line
        ctx.save();
        ctx.strokeStyle = C.waterLine;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#88ddff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
            const y = waterY + Math.sin((x + this.waveOffset) * 0.025) * 5
                + Math.sin((x + this.waveOffset * 0.7) * 0.05) * 3;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Turtles (underwater, behind arm)
        for (const t of this.turtles) {
            if (t.y > waterY) this._drawTurtle(t);
        }

        // Drag arm + draghead
        this._drawDragArm();

        // Particles
        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.life / (p.maxLife || 1);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Ship (drawn on top of arm)
        this._drawShip(this.shipX, this.shipWorldY);

        // Depth/clearance HUD
        this._drawDepthGuide(waterY);

        // Grounding warning
        if (this.groundWarningFlash > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.3, this.groundWarningFlash * 0.22);
            ctx.fillStyle = '#ff2020';
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
    }

    _drawCloud(x, y, w, h) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = C.cloudWhite;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(x + w * 0.25, y + h * 0.5, h * 0.55, 0, Math.PI * 2);
        ctx.arc(x + w * 0.5, y + h * 0.3, h * 0.65, 0, Math.PI * 2);
        ctx.arc(x + w * 0.75, y + h * 0.5, h * 0.5, 0, Math.PI * 2);
        ctx.arc(x + w * 0.5, y + h * 0.6, h * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawSeabed() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;
        const segW = 20; // draw resolution (screen px)

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-2, H);
        for (let sx = 0; sx <= W + segW; sx += segW) {
            const worldX = sx + this.scrollX;
            const sy = this._seabedAt(worldX);
            if (sx === 0) ctx.lineTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.lineTo(W + 2, H);
        ctx.closePath();

        const bedGrad = ctx.createLinearGradient(0, H * 0.65, 0, H);
        bedGrad.addColorStop(0, C.seabedTop);
        bedGrad.addColorStop(1, C.seabedBot);
        ctx.fillStyle = bedGrad;
        ctx.fill();

        // Surface outline
        ctx.strokeStyle = C.seabedLine;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let sx = 0; sx <= W + segW; sx += segW) {
            const sy = this._seabedAt(sx + this.scrollX);
            if (sx === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Pebbles
        ctx.fillStyle = '#8a6228';
        for (let i = 0; i < 16; i++) {
            const px = ((i * 137 + this.scrollX * 0.7) % W + W) % W;
            const psy = this._seabedAt(px + this.scrollX);
            ctx.beginPath();
            ctx.ellipse(px, psy - 5, 7, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
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

    _drawDragArm() {
        const ctx = this.ctx;
        const piv = this._pivotPos();
        const dh = this._dragheadPos();
        const seabedY = this._getSeabedYAtDraghead();
        const clearance = seabedY - dh.y;
        const inSweet = clearance >= 0 && clearance <= 18;
        const grounded = this.grounded || dh.y > seabedY;

        // Arm tube — thick dark outer, thinner highlight
        ctx.save();
        ctx.lineCap = 'round';

        // Outer
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(piv.x, piv.y);
        ctx.lineTo(dh.x, dh.y);
        ctx.stroke();

        // Inner highlight
        ctx.strokeStyle = grounded ? '#cc3300' : '#666';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(piv.x, piv.y);
        ctx.lineTo(dh.x, dh.y);
        ctx.stroke();

        // Pivot knuckle
        ctx.fillStyle = '#444';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(piv.x, piv.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // ── Draghead body — realistic suction shoe shape ──
        if (inSweet) {
            ctx.shadowColor = '#f5a623';
            ctx.shadowBlur = 18;
        } else if (grounded) {
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 16;
        }

        // Unit vectors along and perpendicular to arm
        const armDx = dh.x - piv.x;
        const armDy = dh.y - piv.y;
        const armLen2D = Math.sqrt(armDx * armDx + armDy * armDy);
        const ux = armDx / armLen2D; // along arm toward tip
        const uy = armDy / armLen2D;
        const px2 = -uy;             // perpendicular (width dir)
        const py2 = ux;

        const hw = 18;  // half-width of draghead
        const fwd = 10; // forward overhang (toward seabed)
        const aft = 22; // aft body depth

        // Main body: elongated rounded rectangle along arm axis
        // Back (aft) cap — flat rectangular body
        ctx.fillStyle = grounded ? '#993300' : '#888';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Aft body (the heavy rectangular upper section)
        ctx.moveTo(dh.x + px2 * hw - ux * aft, dh.y + py2 * hw - uy * aft);
        ctx.lineTo(dh.x - px2 * hw - ux * aft, dh.y - py2 * hw - uy * aft);
        ctx.lineTo(dh.x - px2 * (hw - 4), dh.y - py2 * (hw - 4));
        ctx.lineTo(dh.x + px2 * (hw - 4), dh.y + py2 * (hw - 4));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Visor / toe: the forward curved suction opening
        ctx.fillStyle = grounded ? '#cc3300' : C.dragheadBody;
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Wide flat shoe profile perpendicular to arm at the tip
        ctx.moveTo(dh.x - px2 * hw, dh.y - py2 * hw);
        ctx.lineTo(dh.x + px2 * hw, dh.y + py2 * hw);
        // Round the front (toward seabed) with an arc
        ctx.arcTo(
            dh.x + px2 * hw + ux * fwd, dh.y + py2 * hw + uy * fwd,
            dh.x + ux * fwd, dh.y + uy * fwd,
            hw * 0.6
        );
        ctx.arcTo(
            dh.x - px2 * hw + ux * fwd, dh.y - py2 * hw + uy * fwd,
            dh.x - px2 * hw, dh.y - py2 * hw,
            hw * 0.6
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Suction gap (dark mouth on the seabed-facing face)
        const mouthW = hw * 0.72;
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(
            dh.x + ux * fwd * 0.6, dh.y + uy * fwd * 0.6,
            mouthW, 4.5,
            Math.atan2(uy, ux) + Math.PI / 2, 0, Math.PI
        );
        ctx.fill();

        // Water jet nozzle details (small circles on side)
        ctx.fillStyle = '#555';
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(dh.x + px2 * s * (hw - 5) - ux * 6, dh.y + py2 * s * (hw - 5) - uy * 6, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = "bold 9px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('DH', dh.x - ux * 10, dh.y - uy * 10 + 3);

        ctx.restore();
    }

    _drawShip(x, y) {
        const ctx = this.ctx;
        const W = this.shipW, H = this.shipH;

        ctx.save();

        // Hull
        ctx.fillStyle = C.hullBody;
        ctx.strokeStyle = '#1a321a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - W * 0.45, y + H * 0.1);
        ctx.lineTo(x + W * 0.45, y + H * 0.1);
        ctx.lineTo(x + W * 0.42, y + H);
        ctx.lineTo(x - W * 0.38, y + H);
        ctx.lineTo(x - W * 0.48, y + H * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Hull waterline stripe
        ctx.strokeStyle = C.hullHighlight;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - W * 0.44, y + H * 0.15);
        ctx.lineTo(x + W * 0.44, y + H * 0.15);
        ctx.stroke();

        // Hopper (deck opening)
        const hopperW = W * 0.44, hopperH = H * 0.22;
        const hopperX = x - hopperW / 2, hopperY = y + H * 0.12;
        ctx.fillStyle = C.hopperEmpty;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.fillRect(hopperX, hopperY, hopperW, hopperH);
        ctx.strokeRect(hopperX, hopperY, hopperW, hopperH);
        if (this.game.hopperFill > 0) {
            ctx.fillStyle = C.hopperFill;
            const fh = hopperH * this.game.hopperFill;
            ctx.fillRect(hopperX, hopperY + hopperH - fh, hopperW, fh);
        }
        if (this.game.hopperFill > 0.05) {
            ctx.fillStyle = C.hopperWater;
            ctx.fillRect(hopperX + 2, hopperY + hopperH - hopperH * this.game.hopperFill, hopperW - 4, 6);
        }

        // Wheelhouse
        const whX = x - W * 0.15, whW = W * 0.3;
        const whH = H * 0.55, whY = y - whH + H * 0.12;
        ctx.fillStyle = '#4a4aaa';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(whX, whY, whW, whH, 6);
        ctx.fill();
        ctx.stroke();

        // Windows
        ctx.fillStyle = 'rgba(180,230,255,0.8)';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.roundRect(whX + 8 + i * (whW - 16) / 3, whY + 8, (whW - 24) / 3, 14, 3);
            ctx.fill();
            ctx.stroke();
        }

        // Mast
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + W * 0.02, whY);
        ctx.lineTo(x + W * 0.02, whY - 40);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + W * 0.02 - 12, whY - 38);
        ctx.lineTo(x + W * 0.02 + 12, whY - 38);
        ctx.stroke();

        // Stern arm housing (where arm pivots)
        ctx.fillStyle = '#555';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x - W * 0.38, y + H * 0.65, 22, 18, 4);
        ctx.fill();
        ctx.stroke();

        // Bow wave
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.ellipse(x + W * 0.44, y + H * 0.75, 12, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Stern wake / arm cable cover
        ctx.save();
        ctx.strokeStyle = 'rgba(180,230,255,0.5)';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
            const wx = x - W * 0.44 - i * 28;
            const wy = y + H * 0.7 + i * 4;
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx - 18, wy + 8);
            ctx.stroke();
        }
        ctx.restore();

        ctx.restore();
    }

    _drawTurtle(t) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(t.x, t.y);
        if (t.flipX) ctx.scale(-1, 1);

        ctx.fillStyle = t.hit ? '#ff4444' : C.turtleBody;
        ctx.strokeStyle = '#1a3a1a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2a5a2a';
        ctx.beginPath();
        ctx.ellipse(0, -1, 14, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a7a3a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(0, 8);
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
        ctx.stroke();

        ctx.fillStyle = C.turtleBody;
        ctx.strokeStyle = '#1a3a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(23, 0, 9, 7, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(27, -2, 2, 0, Math.PI * 2);
        ctx.fill();

        const flipAngle = Math.sin(t.animTime * 4) * 0.5;
        for (const [fx, fy, angle] of [[-6, -14, -0.9], [6, -14, -1.1], [-6, 14, 0.9], [6, 14, 1.1]]) {
            ctx.save();
            ctx.translate(fx, fy);
            ctx.rotate(angle + (fy < 0 ? -flipAngle : flipAngle));
            ctx.fillStyle = C.turtleBody;
            ctx.strokeStyle = '#1a3a1a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }

    _drawDepthGuide(waterY) {
        const ctx = this.ctx;
        const dh = this._dragheadPos();
        const seabedY = this._getSeabedYAtDraghead();
        const clearance = seabedY - dh.y;

        // Vertical dashed guideline at draghead x
        ctx.save();
        ctx.strokeStyle = 'rgba(180,220,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.moveTo(dh.x, waterY);
        ctx.lineTo(dh.x, seabedY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Clearance indicator band
        const bandColor = clearance < 0 ? 'rgba(255,50,50,0.6)'
            : clearance <= 18 ? 'rgba(80,220,80,0.6)'
                : clearance <= 40 ? 'rgba(245,166,35,0.5)'
                    : 'rgba(100,180,255,0.35)';
        ctx.strokeStyle = bandColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dh.x - 24, seabedY);
        ctx.lineTo(dh.x + 24, seabedY);
        ctx.stroke();

        // Clearance text
        ctx.fillStyle = bandColor;
        ctx.font = "bold 12px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        const label = clearance < 0 ? 'EMBEDDED!' : `clr ${Math.round(clearance / 4)}m`;
        ctx.fillText(label, dh.x, seabedY + 18);

        // Draghead dot
        ctx.fillStyle = clearance < 0 ? '#ff3300'
            : clearance <= 18 ? '#50ee50'
                : '#f5a623';
        ctx.beginPath();
        ctx.arc(dh.x, dh.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
