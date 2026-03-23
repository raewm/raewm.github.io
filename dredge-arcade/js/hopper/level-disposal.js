// js/level-disposal.js — Level 2: Top-down navigation to disposal site

import { transitionToLoading } from '../engine.js';

const SHIP_ACCEL = 450;        // px/s² (increased for better control against strong environment)
const SHIP_FRICTION = 0.88;    // velocity damping per frame factor
const MAX_SPEED = 315;         // px/s (increased)
const UNLOAD_RATE = 0.12;      // fraction per second (full unload ~8.5s)
const DISPOSAL_ZONE_W = 160;
const DISPOSAL_ZONE_H = 100;
const WIND_CHANGE_RATE = 0.04; // how fast wind direction shifts
const TRAFFIC_MAX = 4;         // max simultaneous traffic vessels
const TRAFFIC_SPAWN_MIN = 4.5; // seconds between spawns (min)
const TRAFFIC_SPAWN_MAX = 8.0; // seconds between spawns (max)
const TRAFFIC_COLLISION_RADIUS = 38; // px — bounding half-size for hit detection
const TRAFFIC_PUSH = 280;     // px/s impulse applied to dredge on collision
const TRAFFIC_PENALTY = 100;  // score deduction per collision
const TRAFFIC_COOLDOWN = 2.0; // seconds before same ship can hurt again

// Colors
const C = {
    waterDeep: '#0a2d52',
    waterMid: '#0d4070',
    gridLine: 'rgba(42,184,224,0.07)',
    shipBody: '#3a8a3a',
    shipDark: '#256025',
    shipDeck: '#4aaa4a',
    shipBow: '#2a6a2a',
    zoneActive: 'rgba(45,202,114,0.18)',
    zoneBorder: '#2dca72',
    zoneInactive: 'rgba(200,200,200,0.06)',
    zoneBorderInactive: 'rgba(200,200,200,0.25)',
    bubbles: 'rgba(120,200,255,0.3)',
    trafficHull: '#4a5060',
    trafficDark: '#2a2e36',
    trafficSuperstructure: '#d0d8e0',
    trafficWake: 'rgba(160,210,255,0.35)',
};

export class LevelDisposal {
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
        this._placeZone();
    }

    reset() {
        this.W = this.canvas.width;
        this.H = this.canvas.height;

        // Ship position and velocity
        this.shipX = this.W * 0.15;
        this.shipY = this.H * 0.5;
        this.vx = 0;
        this.vy = 0;
        this.heading = 0; // radians, 0 = right

        // Disposal zone
        this._placeZone();

        // Wind & current  (px/s applied to ship)
        this._randomizeEnvironment();

        // Wind/current display values (exposed to HUD module)
        this.windX = 0;
        this.windY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this._syncDisplayValues();

        // Internal changing direction
        this._windAngle = Math.atan2(this._windDY, this._windDX);
        this._currentAngle = Math.atan2(this._currentDY, this._currentDX);

        // State
        this.inZone = false;
        this.transitioned = false;
        this.time = 0;

        // Visual
        this.wakePoints = [];
        this.bubbles = [];
        for (let i = 0; i < 18; i++) {
            this.bubbles.push({
                x: Math.random() * this.W,
                y: Math.random() * this.H,
                r: 2 + Math.random() * 5,
                speed: 10 + Math.random() * 25,
            });
        }

        // Unloading effect particles
        this.unloadParticles = [];

        // Traffic ships
        this.trafficShips = [];
        this.trafficSpawnTimer = 0;
        this.trafficSpawnInterval = TRAFFIC_SPAWN_MIN + Math.random() * (TRAFFIC_SPAWN_MAX - TRAFFIC_SPAWN_MIN);

        // Score
        this.game.scoring.startDisposal();
    }

    _placeZone() {
        // Disposal zone in the upper-right quadrant, with some margin
        this.zoneX = this.W * 0.62 + (Math.random() - 0.5) * this.W * 0.15;
        this.zoneY = this.H * 0.35 + (Math.random() - 0.5) * this.H * 0.15;
        this.zoneW = DISPOSAL_ZONE_W;
        this.zoneH = DISPOSAL_ZONE_H;
    }

    _randomizeEnvironment() {
        const windSpeed = 30 + Math.random() * 40;    // px/s (strong)
        const windDir = Math.random() * Math.PI * 2;
        this._windDX = Math.cos(windDir) * windSpeed;
        this._windDY = Math.sin(windDir) * windSpeed;
        this._windSpeed = windSpeed;

        const currentSpeed = 15 + Math.random() * 20;
        const currentDir = Math.random() * Math.PI * 2;
        this._currentDX = Math.cos(currentDir) * currentSpeed;
        this._currentDY = Math.sin(currentDir) * currentSpeed;
        this._currentSpeed = currentSpeed;
    }

    _syncDisplayValues() {
        // Convert internal px/s to display "knots" (just label them as such for game flavor)
        const SCALE = 0.08;
        this.windX = this._windDX * SCALE;
        this.windY = this._windDY * SCALE;
        this.currentX = this._currentDX * SCALE;
        this.currentY = this._currentDY * SCALE;
    }

    update(dt) {
        if (this.transitioned) return;
        this.time += dt;
        this.game.hud.update(dt);

        // Slowly shift wind/current direction
        this._windAngle += (Math.random() - 0.5) * WIND_CHANGE_RATE * dt * 2;
        this._currentAngle += (Math.random() - 0.5) * WIND_CHANGE_RATE * dt * 1.5;
        this._windDX = Math.cos(this._windAngle) * this._windSpeed;
        this._windDY = Math.sin(this._windAngle) * this._windSpeed;
        this._currentDX = Math.cos(this._currentAngle) * this._currentSpeed;
        this._currentDY = Math.sin(this._currentAngle) * this._currentSpeed;
        this._syncDisplayValues();

        // Ship thrust
        let ax = 0, ay = 0;
        if (this.keys.ArrowUp) ay -= SHIP_ACCEL;
        if (this.keys.ArrowDown) ay += SHIP_ACCEL;
        if (this.keys.ArrowLeft) ax -= SHIP_ACCEL;
        if (this.keys.ArrowRight) ax += SHIP_ACCEL;

        // Add wind & current forces (strong environmental pressure)
        ax += (this._windDX + this._currentDX) * 1.8;
        ay += (this._windDY + this._currentDY) * 1.8;

        // Velocity
        this.vx += ax * dt;
        this.vy += ay * dt;
        this.vx *= Math.pow(SHIP_FRICTION, dt * 60);
        this.vy *= Math.pow(SHIP_FRICTION, dt * 60);

        // Clamp speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > MAX_SPEED) {
            this.vx = (this.vx / speed) * MAX_SPEED;
            this.vy = (this.vy / speed) * MAX_SPEED;
        }

        // Move
        this.shipX += this.vx * dt;
        this.shipY += this.vy * dt;

        // Heading (smooth rotate toward velocity direction)
        if (speed > 8) {
            const targetAngle = Math.atan2(this.vy, this.vx);
            let diff = targetAngle - this.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.heading += diff * Math.min(1, dt * 5);
        }

        // Boundary bounce
        const margin = 50;
        if (this.shipX < margin) { this.shipX = margin; this.vx = Math.abs(this.vx) * 0.5; }
        if (this.shipX > this.W - margin) { this.shipX = this.W - margin; this.vx = -Math.abs(this.vx) * 0.5; }
        if (this.shipY < margin) { this.shipY = margin; this.vy = Math.abs(this.vy) * 0.5; }
        if (this.shipY > this.H - margin) { this.shipY = this.H - margin; this.vy = -Math.abs(this.vy) * 0.5; }

        // Wake trail
        if (speed > 5) {
            this.wakePoints.push({ x: this.shipX, y: this.shipY, age: 0 });
        }
        for (const w of this.wakePoints) w.age += dt;
        this.wakePoints = this.wakePoints.filter(w => w.age < 2.5);

        // Bubble drift
        for (const b of this.bubbles) {
            b.y -= b.speed * dt;
            if (b.y < -10) { b.y = this.H + 10; b.x = Math.random() * this.W; }
        }

        // Disposal zone check
        const hw = 32, hh = 20;
        this.inZone = (
            this.shipX + hw > this.zoneX &&
            this.shipX - hw < this.zoneX + this.zoneW &&
            this.shipY + hh > this.zoneY &&
            this.shipY - hh < this.zoneY + this.zoneH
        );

        // Unloading
        if (this.inZone && this.game.hopperFill > 0) {
            const delta = UNLOAD_RATE * dt;
            this.game.hopperFill = Math.max(0, this.game.hopperFill - delta);

            // Unload particles
            if (Math.random() < 0.4) {
                this.unloadParticles.push({
                    x: this.zoneX + Math.random() * this.zoneW,
                    y: this.zoneY + Math.random() * this.zoneH,
                    vx: (Math.random() - 0.5) * 30,
                    vy: (Math.random() - 0.5) * 30,
                    life: 1.2 + Math.random() * 0.6,
                    size: 4 + Math.random() * 8,
                    color: `hsl(${25 + Math.random() * 25},70%,${35 + Math.random() * 20}%)`,
                });
            }
        }

        // Update unload particles
        this.unloadParticles = this.unloadParticles.filter(p => {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            return p.life > 0;
        });

        // ── Traffic ships ──
        this.trafficSpawnTimer += dt;
        if (this.trafficSpawnTimer >= this.trafficSpawnInterval && this.trafficShips.length < TRAFFIC_MAX) {
            this._spawnTrafficShip();
            this.trafficSpawnTimer = 0;
            this.trafficSpawnInterval = TRAFFIC_SPAWN_MIN + Math.random() * (TRAFFIC_SPAWN_MAX - TRAFFIC_SPAWN_MIN);
        }

        for (const t of this.trafficShips) {
            t.x += t.vx * dt;
            t.y += t.vy * dt;
            if (t.cooldown > 0) t.cooldown -= dt;

            // Collision with dredge
            if (t.cooldown <= 0) {
                const dx = this.shipX - t.x;
                const dy = this.shipY - t.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < TRAFFIC_COLLISION_RADIUS) {
                    // Impulse: push dredge away from vessel
                    const nx = dx / Math.max(dist, 1);
                    const ny = dy / Math.max(dist, 1);
                    this.vx += nx * TRAFFIC_PUSH;
                    this.vy += ny * TRAFFIC_PUSH;
                    t.cooldown = TRAFFIC_COOLDOWN;
                    this.game.score = Math.max(0, this.game.score - TRAFFIC_PENALTY);
                    this.game.hud.flash(`VESSEL COLLISION! −${TRAFFIC_PENALTY}`, '#ff8c00');
                    this.game.hud.flashPenalty();
                }
            }
        }

        // Remove off-screen traffic ships
        this.trafficShips = this.trafficShips.filter(t =>
            t.x > -200 && t.x < this.W + 200 && t.y > -200 && t.y < this.H + 200
        );

        // Done unloading
        if (this.game.hopperFill <= 0 && !this.transitioned) {
            this.transitioned = true;
            this.game.hopperFill = 0;
            const pts = this.game.scoring.finishDisposal();
            this.game.hud.flash(`DISPOSAL COMPLETE! +${pts} pts`, '#2dca72');
            setTimeout(() => transitionToLoading(), 1400);
        }
    }

    draw() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;

        // ── Ocean background ──
        const seaGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
        seaGrad.addColorStop(0, C.waterMid);
        seaGrad.addColorStop(1, C.waterDeep);
        ctx.fillStyle = seaGrad;
        ctx.fillRect(0, 0, W, H);

        // Grid (nautical chart feel)
        ctx.strokeStyle = C.gridLine;
        ctx.lineWidth = 1;
        const gridSz = 80;
        for (let gx = 0; gx < W; gx += gridSz) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (let gy = 0; gy < H; gy += gridSz) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

        // Bubbles
        ctx.save();
        ctx.fillStyle = C.bubbles;
        for (const b of this.bubbles) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // ── Wake trail ──
        if (this.wakePoints.length > 1) {
            ctx.save();
            for (let i = 1; i < this.wakePoints.length; i++) {
                const p = this.wakePoints[i];
                const alpha = (1 - p.age / 2.5) * 0.4;
                ctx.strokeStyle = `rgba(180,230,255,${alpha})`;
                ctx.lineWidth = (1 - p.age / 2.5) * 8;
                ctx.beginPath();
                ctx.moveTo(this.wakePoints[i - 1].x, this.wakePoints[i - 1].y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // ── Disposal zone ──
        this._drawDisposalZone();

        // ── Unload particles ──
        for (const p of this.unloadParticles) {
            ctx.save();
            ctx.globalAlpha = p.life / 1.8;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // ── Traffic vessels (behind the dredge) ──
        for (const t of this.trafficShips) this._drawTrafficShip(t);

        // ── Ship (top-down view) ──
        this._drawShipTopDown();

        // ── Compass Rose (decorative, corner) ──
        this._drawCompassRose(W - 70, H - 70, 48);
    }

    _drawDisposalZone() {
        const ctx = this.ctx;
        const { zoneX, zoneY, zoneW, zoneH } = this;
        const active = this.inZone;

        // Glow
        ctx.save();
        if (active) {
            ctx.shadowColor = '#2dca72';
            ctx.shadowBlur = 24;
        }

        // Fill
        ctx.fillStyle = active ? C.zoneActive : C.zoneInactive;
        this._roundRect(zoneX, zoneY, zoneW, zoneH, 12);
        ctx.fill();

        // Dashed border
        ctx.strokeStyle = active ? C.zoneBorder : C.zoneBorderInactive;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        this._roundRect(zoneX, zoneY, zoneW, zoneH, 12);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Label
        ctx.save();
        ctx.fillStyle = active ? '#2dca72' : 'rgba(200,200,200,0.5)';
        ctx.font = "bold 14px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('DISPOSAL SITE', zoneX + zoneW / 2, zoneY + 22);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = "11px 'Outfit', sans-serif";
        ctx.fillText('Navigate here to unload', zoneX + zoneW / 2, zoneY + 40);

        // Animated target cross
        if (!active) {
            const cx = zoneX + zoneW / 2, cy = zoneY + zoneH / 2;
            const pulse = 0.5 + Math.sin(this.time * 3) * 0.4;
            ctx.strokeStyle = `rgba(200,200,200,${pulse * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy);
            ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, 12, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawShipTopDown() {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.shipX, this.shipY);
        ctx.rotate(this.heading + Math.PI / 2); // offset so "up" = north by default

        // Shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.filter = 'blur(6px)';
        ctx.beginPath();
        ctx.ellipse(4, 4, 28, 56, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Hull body (elongated shape)
        ctx.fillStyle = C.shipBody;
        ctx.strokeStyle = '#1a321a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -56);       // bow tip
        ctx.bezierCurveTo(22, -38, 26, 20, 20, 48);   // starboard
        ctx.lineTo(-20, 48);                            // stern
        ctx.bezierCurveTo(-26, 20, -22, -38, 0, -56); // port
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Deck stripe (lighter)
        ctx.fillStyle = C.shipDeck;
        ctx.beginPath();
        ctx.moveTo(0, -48);
        ctx.bezierCurveTo(16, -32, 18, 14, 14, 40);
        ctx.lineTo(-14, 40);
        ctx.bezierCurveTo(-18, 14, -16, -32, 0, -48);
        ctx.closePath();
        ctx.fill();

        // Hopper (center trough)
        const hFill = this.game.hopperFill;
        ctx.fillStyle = '#555';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-11, -22, 22, 52);
        ctx.strokeRect(-11, -22, 22, 52);
        if (hFill > 0) {
            const grad = ctx.createLinearGradient(0, 30 - 52 * hFill, 0, 30);
            grad.addColorStop(0, '#c8921a');
            grad.addColorStop(1, '#e0a820');
            ctx.fillStyle = grad;
            ctx.fillRect(-10, 30 - 52 * hFill, 20, 52 * hFill);
        }

        // Stern structure / wheelhouse
        ctx.fillStyle = '#4a4aaa';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        roundRect(ctx, -11, -50, 22, 22, 4);
        ctx.fill();
        ctx.stroke();

        // Bow wave indicator
        ctx.save();
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (spd > 15) {
            ctx.globalAlpha = Math.min(1, spd / 80) * 0.7;
            ctx.strokeStyle = 'rgba(150,220,255,0.9)';
            ctx.lineWidth = 2;
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(-8 * i, -56 - i * 10);
                ctx.lineTo(0, -56 - i * 6);
                ctx.lineTo(8 * i, -56 - i * 10);
                ctx.stroke();
            }
        }
        ctx.restore();

        // Suction pipes on sides
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(side * 10, 10);
            ctx.lineTo(side * 28, 20);
            ctx.stroke();
            // Draghead at end
            ctx.fillStyle = '#e87c20';
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(side * 28, 20, 7, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    _drawCompassRose(cx, cy, r) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.6;
        // Outer ring
        ctx.strokeStyle = 'rgba(42,184,224,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

        // Cardinal lines
        ctx.strokeStyle = 'rgba(42,184,224,0.6)';
        ctx.lineWidth = 2;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * (r * 0.4), cy + Math.sin(a) * (r * 0.4));
            ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            ctx.stroke();
        }

        // N label
        ctx.fillStyle = 'rgba(42,184,224,0.9)';
        ctx.font = "bold 12px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, cy - r - 6);
        ctx.fillStyle = 'rgba(42,184,224,0.5)';
        ctx.font = "10px 'Outfit', sans-serif";
        ctx.fillText('S', cx, cy + r + 12);
        ctx.fillText('E', cx + r + 10, cy + 4);
        ctx.fillText('W', cx - r - 10, cy + 4);

        ctx.restore();
    }

    _drawEnvironmentArrows() {
        const ctx = this.ctx;
        const sx = this.shipX, sy = this.shipY;
        const SCALE = 0.8;

        // Wind arrow (blue, dashed)
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(42,184,224,0.7)';
        ctx.fillStyle = 'rgba(42,184,224,0.7)';
        ctx.lineWidth = 2;
        const wLen = Math.sqrt(this._windDX ** 2 + this._windDY ** 2) * SCALE;
        if (wLen > 2) {
            const wNx = this._windDX / Math.sqrt(this._windDX ** 2 + this._windDY ** 2);
            const wNy = this._windDY / Math.sqrt(this._windDX ** 2 + this._windDY ** 2);
            drawArrow(ctx, sx - wNx * 20, sy - wNy * 20, sx + wNx * Math.min(wLen, 60), sy + wNy * Math.min(wLen, 60), 'rgba(42,184,224,0.7)', 2, 10);
        }
        ctx.restore();

        // Current arrow (green)
        ctx.save();
        ctx.strokeStyle = 'rgba(45,202,114,0.7)';
        ctx.fillStyle = 'rgba(45,202,114,0.7)';
        ctx.lineWidth = 2;
        const cLen = Math.sqrt(this._currentDX ** 2 + this._currentDY ** 2) * SCALE;
        if (cLen > 2) {
            const cNx = this._currentDX / Math.sqrt(this._currentDX ** 2 + this._currentDY ** 2);
            const cNy = this._currentDY / Math.sqrt(this._currentDX ** 2 + this._currentDY ** 2);
            drawArrow(ctx, sx - cNx * 20, sy - cNy * 20, sx + cNx * Math.min(cLen, 50), sy + cNy * Math.min(cLen, 50), 'rgba(45,202,114,0.7)', 2, 10);
        }
        ctx.restore();
    }

    _roundRect(x, y, w, h, r) {
        const ctx = this.ctx;
        roundRect(ctx, x, y, w, h, r);
    }

    // ── Traffic ship spawner ────────────────────────────────────────────────
    _spawnTrafficShip() {
        // Choose a crossing path: enter from one edge, exit the opposite (or adjacent)
        // Bias toward horizontal crossings (left↔right) since those cut across the dredge path
        const side = Math.floor(Math.random() * 4); // 0=left, 1=right, 2=top, 3=bottom
        let x, y, vx, vy;
        const speed = 65 + Math.random() * 80; // px/s
        // Slight diagonal so ships don't always go perfectly straight
        const drift = (Math.random() - 0.5) * 40;

        switch (side) {
            case 0: // enter from left
                x = -100; y = this.H * (0.25 + Math.random() * 0.55);
                vx = speed; vy = drift;
                break;
            case 1: // enter from right
                x = this.W + 100; y = this.H * (0.25 + Math.random() * 0.55);
                vx = -speed; vy = drift;
                break;
            case 2: // enter from top
                x = this.W * (0.1 + Math.random() * 0.8); y = -100;
                vx = drift; vy = speed;
                break;
            default: // enter from bottom
                x = this.W * (0.1 + Math.random() * 0.8); y = this.H + 100;
                vx = drift; vy = -speed;
                break;
        }

        this.trafficShips.push({
            x, y, vx, vy,
            heading: Math.atan2(vy, vx),
            cooldown: 0,
            // random vessel size variation
            scale: 0.8 + Math.random() * 0.5,
        });
    }

    // ── Traffic ship renderer (top-down freighter) ──────────────────────────
    _drawTrafficShip(ship) {
        const ctx = this.ctx;
        const s = ship.scale;

        // Wake trail behind the vessel
        const wakeLen = 55 * s;
        const bx = -Math.cos(ship.heading) * wakeLen;
        const by = -Math.sin(ship.heading) * wakeLen;
        const wakeGrad = ctx.createLinearGradient(ship.x, ship.y, ship.x + bx, ship.y + by);
        wakeGrad.addColorStop(0, C.trafficWake);
        wakeGrad.addColorStop(1, 'rgba(160,210,255,0)');
        ctx.save();
        ctx.strokeStyle = wakeGrad;
        ctx.lineWidth = 14 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ship.x, ship.y);
        ctx.lineTo(ship.x + bx, ship.y + by);
        ctx.stroke();
        ctx.restore();

        // Hull
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.heading + Math.PI / 2);

        const hw = 18 * s, hl = 48 * s;

        // Hull body
        ctx.fillStyle = C.trafficHull;
        ctx.strokeStyle = C.trafficDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -hl);           // bow
        ctx.bezierCurveTo(hw, -hl * 0.6, hw, hl * 0.5, hw * 0.7, hl);  // starboard
        ctx.lineTo(-hw * 0.7, hl);                                        // stern
        ctx.bezierCurveTo(-hw, hl * 0.5, -hw, -hl * 0.6, 0, -hl);      // port
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Deck stripe
        ctx.fillStyle = '#5a6070';
        ctx.beginPath();
        ctx.moveTo(0, -hl * 0.85);
        ctx.bezierCurveTo(hw * 0.7, -hl * 0.5, hw * 0.7, hl * 0.3, hw * 0.55, hl * 0.85);
        ctx.lineTo(-hw * 0.55, hl * 0.85);
        ctx.bezierCurveTo(-hw * 0.7, hl * 0.3, -hw * 0.7, -hl * 0.5, 0, -hl * 0.85);
        ctx.closePath();
        ctx.fill();

        // Superstructure (white block near stern)
        ctx.fillStyle = C.trafficSuperstructure;
        ctx.strokeStyle = C.trafficDark;
        ctx.lineWidth = 1.5;
        roundRect(ctx, -hw * 0.45, hl * 0.2, hw * 0.9, hl * 0.38, 3 * s);
        ctx.fill();
        ctx.stroke();

        // Cargo hatches (simple dark rectangles)
        ctx.fillStyle = C.trafficDark;
        for (let i = 0; i < 2; i++) {
            roundRect(ctx, -hw * 0.32, -hl * 0.45 + i * hl * 0.32, hw * 0.64, hl * 0.22, 2 * s);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawArrow(ctx, x1, y1, x2, y2, color, lw, headLen = 10) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
