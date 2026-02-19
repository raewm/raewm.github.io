// js/level-transport.js — Level 2: Top-down tugboat towing scow to disposal site

import { transitionToDigging } from '../engine.js';
import { showGameOver } from '../engine.js';

// ── Constants ───────────────────────────────────────────────────────────────
const TUG_THRUST = 240;    // px/s² forward thrust
const TUG_DRAG = 0.72;   // velocity drag per second (multiplicative retain)
const TUG_TURN_SPEED = 2.2;    // radians/s
const TUG_MAX_SPEED = 180;

const TOW_REST_LEN = 90;     // natural tow line length
const TOW_STIFFNESS = 6.0;    // spring constant
const TOW_DAMPING = 0.55;

const WIND_CHANGE_INT = 12;     // seconds between wind shifts
const DUMP_RATE = 0.12;   // fraction of scow drained per second (~8s to full empty)
const ZONE_RADIUS = 75;     // disposal zone radius px (must contain scow center)
const ZONE_DWELL_REQ = 1.0;    // seconds scow must be inside before dumping starts

const ENV_FORCE_SCALE = 28;     // environmental force strength (px/s²)

const C = {
    waterDeep: '#083060',
    waterShallow: '#1a6aaa',
    waterLine: 'rgba(120,220,255,0.18)',
    zoneColor: 'rgba(45,202,114,0.25)',
    zoneBorder: '#2dca72',
    towLine: '#ccc',
    tugHull: '#e87c20',
    tugDeck: '#f5a623',
    scowHull: '#336699',
    scowMud: '#b49030',
    bubbles: 'rgba(180,230,255,0.5)',
};

export class LevelTransport {
    constructor(ctx, canvas, game, keys) {
        this.ctx = ctx; this.canvas = canvas;
        this.game = game; this.keys = keys;
        this.W = canvas.width; this.H = canvas.height;
        this._initStatics();
        this.reset();
    }

    onResize() { this.W = this.canvas.width; this.H = this.canvas.height; }

    _initStatics() {
        // These persist across resets within same session
        this.windX = (Math.random() - 0.5) * 2 * ENV_FORCE_SCALE;
        this.windY = (Math.random() - 0.5) * 2 * ENV_FORCE_SCALE;
        this.currentX = (Math.random() - 0.5) * 1.4 * ENV_FORCE_SCALE;
        this.currentY = (Math.random() - 0.5) * 1.4 * ENV_FORCE_SCALE;
        this._windTimer = 0;
    }

    reset() {
        this.W = this.canvas.width; this.H = this.canvas.height;

        // Tugboat
        this.tugX = this.W * 0.25;
        this.tugY = this.H * 0.5;
        this.tugAngle = 0;            // radians, 0 = right
        this.tugVX = 0; this.tugVY = 0;

        // Scow (starts behind tug)
        this.scowX = this.tugX - TOW_REST_LEN * 1.3;
        this.scowY = this.tugY;
        this.scowVX = 0; this.scowVY = 0;
        this.scowAngle = 0;

        // Disposal zone — randomised, right-hand side of screen
        this.zoneX = this.W * (0.58 + Math.random() * 0.28);
        this.zoneY = this.H * (0.2 + Math.random() * 0.6);

        // Dumping state
        this.scowInZone = false;
        this.zoneDwellTimer = 0;
        this.dumping = false;
        this.transitioned = false;

        // Environment
        this._windTimer = 0;

        // Wake particles
        this.wakes = [];
        this.time = 0;

        this.game.scoring.startTransport();
    }

    update(dt) {
        if (this.transitioned) return;
        this.time += dt;
        this.game.hud.update(dt);

        // ── Wind shift ──────────────────────────────────────────────────────
        this._windTimer += dt;
        if (this._windTimer > WIND_CHANGE_INT) {
            this._windTimer = 0;
            this.windX += (Math.random() - 0.5) * ENV_FORCE_SCALE * 0.6;
            this.windY += (Math.random() - 0.5) * ENV_FORCE_SCALE * 0.6;
            this.windX = Math.max(-ENV_FORCE_SCALE, Math.min(ENV_FORCE_SCALE, this.windX));
            this.windY = Math.max(-ENV_FORCE_SCALE, Math.min(ENV_FORCE_SCALE, this.windY));
        }

        // ── Tug controls ────────────────────────────────────────────────────
        if (this.keys.ArrowLeft) this.tugAngle -= TUG_TURN_SPEED * dt;
        if (this.keys.ArrowRight) this.tugAngle += TUG_TURN_SPEED * dt;

        const fx = Math.cos(this.tugAngle) * TUG_THRUST * dt;
        const fy = Math.sin(this.tugAngle) * TUG_THRUST * dt;

        if (this.keys.ArrowUp) {
            this.tugVX += fx; this.tugVY += fy;
        }
        if (this.keys.ArrowDown) {
            this.tugVX -= fx * 0.5; this.tugVY -= fy * 0.5;
        }

        // Wind force on tug (smaller effect)
        this.tugVX += this.windX * 0.2 * dt;
        this.tugVY += this.windY * 0.2 * dt;
        // Current force on tug
        this.tugVX += this.currentX * 0.35 * dt;
        this.tugVY += this.currentY * 0.35 * dt;

        // Speed cap + drag
        const tugSpd = Math.sqrt(this.tugVX * this.tugVX + this.tugVY * this.tugVY);
        if (tugSpd > TUG_MAX_SPEED) {
            const sc = TUG_MAX_SPEED / tugSpd;
            this.tugVX *= sc; this.tugVY *= sc;
        }
        this.tugVX *= Math.pow(TUG_DRAG, dt);
        this.tugVY *= Math.pow(TUG_DRAG, dt);

        this.tugX += this.tugVX * dt;
        this.tugY += this.tugVY * dt;

        // Bounce off edges
        const pad = 40;
        if (this.tugX < pad) { this.tugX = pad; this.tugVX = Math.abs(this.tugVX) * 0.4; }
        if (this.tugX > this.W - pad) { this.tugX = this.W - pad; this.tugVX = -Math.abs(this.tugVX) * 0.4; }
        if (this.tugY < pad) { this.tugY = pad; this.tugVY = Math.abs(this.tugVY) * 0.4; }
        if (this.tugY > this.H - pad) { this.tugY = this.H - pad; this.tugVY = -Math.abs(this.tugVY) * 0.4; }

        // ── Scow spring physics ─────────────────────────────────────────────
        // Tow attach point = stern of tug
        const towAttX = this.tugX - Math.cos(this.tugAngle) * 28;
        const towAttY = this.tugY - Math.sin(this.tugAngle) * 28;

        const dx = this.scowX - towAttX;
        const dy = this.scowY - towAttY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

        // Spring force only when taut
        if (dist > TOW_REST_LEN) {
            const stretch = dist - TOW_REST_LEN;
            const nx = dx / dist, ny = dy / dist;
            const relVx = this.scowVX - this.tugVX;
            const relVy = this.scowVY - this.tugVY;
            const relVn = relVx * nx + relVy * ny;
            const force = -(TOW_STIFFNESS * stretch + TOW_DAMPING * relVn);
            this.scowVX += force * nx * dt;
            this.scowVY += force * ny * dt;
        }

        // Wind + current on scow (heavier, more affected)
        this.scowVX += this.windX * 0.45 * dt;
        this.scowVY += this.windY * 0.45 * dt;
        this.scowVX += this.currentX * 0.6 * dt;
        this.scowVY += this.currentY * 0.6 * dt;

        this.scowVX *= Math.pow(0.65, dt);
        this.scowVY *= Math.pow(0.65, dt);

        this.scowX += this.scowVX * dt;
        this.scowY += this.scowVY * dt;

        // Scow stays in world bounds
        this.scowX = Math.max(pad, Math.min(this.W - pad, this.scowX));
        this.scowY = Math.max(pad, Math.min(this.H - pad, this.scowY));

        // Scow heading tracks velocity
        const sv = Math.sqrt(this.scowVX * this.scowVX + this.scowVY * this.scowVY);
        if (sv > 4) {
            const targetAngle = Math.atan2(this.scowVY, this.scowVX);
            let da = targetAngle - this.scowAngle;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            this.scowAngle += da * Math.min(1, 2 * dt);
        }

        // ── Disposal zone check ─────────────────────────────────────────────
        const zoneDx = this.scowX - this.zoneX;
        const zoneDy = this.scowY - this.zoneY;
        const zoneDist = Math.sqrt(zoneDx * zoneDx + zoneDy * zoneDy);
        this.scowInZone = zoneDist < ZONE_RADIUS;

        if (this.scowInZone) {
            this.zoneDwellTimer += dt;
            if (this.zoneDwellTimer >= ZONE_DWELL_REQ && !this.dumping) {
                this.dumping = true;
                this.game.hud.flash('DUMPING! Hold position…', '#2dca72');
            }
        } else {
            this.zoneDwellTimer = 0;
            if (this.dumping) {
                this.dumping = false;
                this.game.hud.flash('Left zone — reposition scow!', '#f5a623');
            }
        }

        // Drain scow if dumping
        if (this.dumping && this.game.scowFill > 0) {
            this.game.scowFill = Math.max(0, this.game.scowFill - DUMP_RATE * dt);
        }

        // Round complete when empty
        if (this.dumping && this.game.scowFill <= 0 && !this.transitioned) {
            this.transitioned = true;
            const bonus = this.game.scoring.finishTransport();
            this.game.hud.flash(`DISPOSAL COMPLETE! +${bonus} pts`, '#f5a623');
            setTimeout(() => transitionToDigging(), 1600);
        }

        // Wake particles
        if (tugSpd > 20 && Math.random() < 0.25) {
            this.wakes.push({
                x: this.tugX - Math.cos(this.tugAngle) * 22 + (Math.random() - 0.5) * 12,
                y: this.tugY - Math.sin(this.tugAngle) * 22 + (Math.random() - 0.5) * 12,
                r: 3 + Math.random() * 8,
                life: 0.8 + Math.random() * 0.8,
                maxLife: 1.6,
            });
        }
        this.wakes = this.wakes.filter(w => {
            w.life -= dt; w.r += 6 * dt;
            return w.life > 0;
        });
    }

    // ── Drawing ──────────────────────────────────────────────────────────────

    draw() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;

        // Ocean background with slight depth gradient
        const oceanG = ctx.createRadialGradient(W * 0.5, H * 0.5, 60, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
        oceanG.addColorStop(0, C.waterShallow);
        oceanG.addColorStop(1, C.waterDeep);
        ctx.fillStyle = oceanG;
        ctx.fillRect(0, 0, W, H);

        // Ocean grid / ripple texture
        this._drawOceanPattern();

        // Disposal zone
        this._drawDisposalZone();

        // Wake rings
        for (const w of this.wakes) {
            ctx.save();
            ctx.globalAlpha = (w.life / w.maxLife) * 0.45;
            ctx.strokeStyle = C.bubbles;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // Tow line
        this._drawTowLine();

        // Scow
        this._drawScow();

        // Tug
        this._drawTug();

        // Compass rose (small, top-right corner)
        this._drawCompassRose();
    }

    _drawOceanPattern() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;
        ctx.save();
        ctx.strokeStyle = C.waterLine;
        ctx.lineWidth = 1;
        const spacing = 60;
        const shift = (this.time * 12) % spacing;
        for (let x = -spacing + (shift % spacing); x < W + spacing; x += spacing) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 30, H); ctx.stroke();
        }
        for (let y = -spacing + (shift * 0.4 % spacing); y < H + spacing; y += spacing) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 20); ctx.stroke();
        }
        ctx.restore();
    }

    _drawDisposalZone() {
        const ctx = this.ctx;
        const zx = this.zoneX, zy = this.zoneY, r = ZONE_RADIUS;
        const inZone = this.scowInZone;
        const pulseR = r + Math.sin(this.time * 3) * 6;

        ctx.save();

        // Filled circle
        ctx.fillStyle = inZone ? 'rgba(45,202,114,0.35)' : C.zoneColor;
        ctx.beginPath(); ctx.arc(zx, zy, pulseR, 0, Math.PI * 2); ctx.fill();

        // Border
        ctx.strokeStyle = C.zoneBorder;
        ctx.lineWidth = inZone ? 4 : 2.5;
        ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.arc(zx, zy, pulseR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        // Crosshair
        ctx.strokeStyle = 'rgba(45,202,114,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(zx - 20, zy); ctx.lineTo(zx + 20, zy);
        ctx.moveTo(zx, zy - 20); ctx.lineTo(zx, zy + 20);
        ctx.stroke();

        // Label
        ctx.fillStyle = C.zoneBorder;
        ctx.font = "bold 13px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('DISPOSAL', zx, zy - r - 10);
        ctx.fillText('SITE', zx, zy - r + 5);

        // Buoy markers
        const bAngle = this.time * 0.4;
        for (let i = 0; i < 4; i++) {
            const a = bAngle + i * Math.PI / 2;
            const bx2 = zx + Math.cos(a) * (r - 12);
            const by2 = zy + Math.sin(a) * (r - 12);
            ctx.fillStyle = '#f5a623';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(bx2, by2, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // Buoy vertical mast
            ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(bx2, by2 - 6); ctx.lineTo(bx2, by2 - 16); ctx.stroke();
        }

        ctx.restore();
    }

    _drawTowLine() {
        const ctx = this.ctx;
        const towAttX = this.tugX - Math.cos(this.tugAngle) * 28;
        const towAttY = this.tugY - Math.sin(this.tugAngle) * 28;

        // Catenary-ish curve using quadratic with midpoint sag
        const mx = (towAttX + this.scowX) * 0.5 + (Math.random() - 0.5) * 2;
        const my = (towAttY + this.scowY) * 0.5 + 14; // slight droop

        ctx.save();
        ctx.strokeStyle = C.towLine; ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(towAttX, towAttY);
        ctx.quadraticCurveTo(mx, my, this.scowX, this.scowY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    _drawScow() {
        const ctx = this.ctx;
        const x = this.scowX, y = this.scowY;
        const angle = this.scowAngle;
        const sW = 80, sH = 36;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-sW / 2 + 5, -sH / 2 + 5, sW, sH);

        // Hull shape (flat barge)
        const hull = ctx.createLinearGradient(-sW / 2, -sH / 2, -sW / 2, sH / 2);
        hull.addColorStop(0, '#4488bb'); hull.addColorStop(1, '#225588');
        ctx.fillStyle = hull;
        ctx.strokeStyle = '#112244'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-sW / 2 + 6, -sH / 2);
        ctx.lineTo(sW / 2 - 6, -sH / 2);
        ctx.lineTo(sW / 2, 0);
        ctx.lineTo(sW / 2 - 6, sH / 2);
        ctx.lineTo(-sW / 2 + 6, sH / 2);
        ctx.lineTo(-sW / 2, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Hold / cargo area
        const hx = -sW * 0.35, hhy = -sH * 0.28, hw2 = sW * 0.7, hht = sH * 0.56;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(hx, hhy, hw2, hht);

        if (this.game.scowFill > 0) {
            const fh = hht * this.game.scowFill;
            const mudG = ctx.createLinearGradient(hx, hhy + hht - fh, hx, hhy + hht);
            mudG.addColorStop(0, '#c8a040'); mudG.addColorStop(1, '#7a5010');
            ctx.fillStyle = mudG;
            ctx.fillRect(hx, hhy + hht - fh, hw2, fh);
            // Slurry water
            ctx.fillStyle = 'rgba(40,100,180,0.35)';
            ctx.fillRect(hx, hhy + hht - fh, hw2, 4);
        }

        // If dumping: show open-door particles below
        if (this.dumping) {
            ctx.fillStyle = 'rgba(180,130,40,0.7)';
            for (let i = 0; i < 5; i++) {
                const px = hx + Math.random() * hw2;
                const py = hhy + hht + Math.random() * 20;
                ctx.beginPath(); ctx.arc(px, py, 3 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
            }
        }

        // Rails
        ctx.strokeStyle = '#338'; ctx.lineWidth = 1.5;
        ctx.strokeRect(hx, hhy, hw2, hht);
        ctx.strokeStyle = '#4488bb'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-sW / 2 + 8, -sH / 2 + 4); ctx.lineTo(sW / 2 - 8, -sH / 2 + 4);
        ctx.stroke();

        // Tow bitt (bow)
        ctx.fillStyle = '#aaa'; ctx.strokeStyle = '#333';
        ctx.beginPath(); ctx.arc(-sW / 2 + 8, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        ctx.restore();
    }

    _drawTug() {
        const ctx = this.ctx;
        const x = this.tugX, y = this.tugY;
        const angle = this.tugAngle;
        const tW = 52, tH = 26;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Wake spray at stern
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(200,240,255,0.9)';
        ctx.beginPath();
        ctx.ellipse(-tW * 0.55, 0, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Hull
        const g = ctx.createLinearGradient(-tW / 2, -tH / 2, -tW / 2, tH / 2);
        g.addColorStop(0, '#f5a623'); g.addColorStop(1, '#b87010');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#5a3008'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tW * 0.5, 0);            // bow point
        ctx.lineTo(tW * 0.32, -tH * 0.5);
        ctx.lineTo(-tW * 0.42, -tH * 0.5);
        ctx.lineTo(-tW * 0.5, -tH * 0.25);
        ctx.lineTo(-tW * 0.5, tH * 0.25);
        ctx.lineTo(-tW * 0.42, tH * 0.5);
        ctx.lineTo(tW * 0.32, tH * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Wheelhouse
        ctx.fillStyle = '#4a4aaa'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-tW * 0.25, -tH * 0.42, tW * 0.44, tH * 0.84, 4);
        ctx.fill(); ctx.stroke();
        // Window
        ctx.fillStyle = 'rgba(180,230,255,0.8)';
        ctx.beginPath();
        ctx.roundRect(-tW * 0.02, -tH * 0.28, tW * 0.2, tH * 0.34, 3);
        ctx.fill();

        // Stack / exhaust
        ctx.fillStyle = '#333'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-tW * 0.38, -tH * 0.55, 10, 12, 2);
        ctx.fill(); ctx.stroke();

        // Bow fender
        ctx.strokeStyle = '#e8b070'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tW * 0.30, -tH * 0.42);
        ctx.lineTo(tW * 0.44, 0);
        ctx.lineTo(tW * 0.30, tH * 0.42);
        ctx.stroke();

        ctx.restore();
    }

    _drawCompassRose() {
        const ctx = this.ctx;
        const cx = this.W - 55, cy = 55, r = 30;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.6)';
        ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(42,184,224,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

        ctx.fillStyle = '#7fe0f5';
        ctx.font = "bold 10px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, cy - r + 6);
        ctx.fillText('S', cx, cy + r + 2);
        ctx.fillText('E', cx + r, cy + 4);
        ctx.fillText('W', cx - r, cy + 4);

        // Tug heading arrow
        const nx2 = Math.cos(this.tugAngle), ny2 = Math.sin(this.tugAngle);
        ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - nx2 * r * 0.55, cy - ny2 * r * 0.55);
        ctx.lineTo(cx + nx2 * r * 0.75, cy + ny2 * r * 0.75);
        ctx.stroke();
        ctx.fillStyle = '#f5a623';
        ctx.beginPath();
        const ha = this.tugAngle;
        ctx.moveTo(cx + nx2 * r * 0.75, cy + ny2 * r * 0.75);
        ctx.lineTo(cx + Math.cos(ha - 2.5) * r * 0.45, cy + Math.sin(ha - 2.5) * r * 0.45);
        ctx.lineTo(cx + Math.cos(ha + 2.5) * r * 0.45, cy + Math.sin(ha + 2.5) * r * 0.45);
        ctx.closePath(); ctx.fill();

        ctx.restore();
    }
}
