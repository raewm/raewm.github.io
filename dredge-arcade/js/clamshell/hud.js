// js/hud.js — HUD rendering for both levels

const HUD_PAD = 16;

export class HUD {
    constructor(ctx, game) {
        this.ctx = ctx;
        this.game = game;
        this.flashText = '';
        this.flashTimer = 0;
        this.flashColor = '#2ab8e0';
        this.penaltyFlash = 0;
    }

    flash(text, color = '#2ab8e0') {
        this.flashText = text;
        this.flashTimer = 2.0;
        this.flashColor = color;
    }

    flashPenalty() { this.penaltyFlash = 1.5; }

    update(dt) {
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.penaltyFlash > 0) this.penaltyFlash -= dt;
    }

    // ── Shared ─────────────────────────────────────────────────────────────

    drawScowGauge(x, y, w, h) {
        const ctx = this.ctx;
        const fill = this.game.scowFill;

        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        roundRect(ctx, x, y, w + 120, h + 50, 12);
        ctx.fill();
        ctx.strokeStyle = '#2ab8e0';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, w + 120, h + 50, 12);
        ctx.stroke();

        ctx.fillStyle = '#7fe0f5';
        ctx.font = "bold 13px 'Outfit', sans-serif";
        ctx.fillText('SCOW LOAD', x + 14, y + 22);

        const bx = x + 14, by = y + 30, bw = w + 90, bh = h - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        roundRect(ctx, bx, by, bw, bh, 8);
        ctx.fill();

        const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        if (fill < 0.5) {
            grad.addColorStop(0, '#2ab8e0');
            grad.addColorStop(1, '#2dca72');
        } else if (fill < 0.85) {
            grad.addColorStop(0, '#2dca72');
            grad.addColorStop(1, '#f5a623');
        } else {
            grad.addColorStop(0, '#f5a623');
            grad.addColorStop(1, '#e84040');
        }
        ctx.fillStyle = grad;
        roundRect(ctx, bx, by, bw * fill, bh, 8);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = "bold 14px 'Outfit', sans-serif";
        ctx.fillText(`${Math.round(fill * 100)}%`, bx + bw + 8, by + bh - 4);
        ctx.restore();
    }

    drawScore(x, y) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        roundRect(ctx, x, y, 180, 44, 10);
        ctx.fill();
        ctx.strokeStyle = '#f5a623';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, 180, 44, 10);
        ctx.stroke();
        ctx.fillStyle = '#f5a623';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText('SCORE', x + 12, y + 16);
        ctx.fillStyle = '#fff';
        ctx.font = "bold 18px 'Outfit', sans-serif";
        ctx.fillText(this.game.score.toLocaleString(), x + 12, y + 36);
        ctx.restore();
    }

    drawRound(x, y) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        roundRect(ctx, x, y, 130, 44, 10);
        ctx.fill();
        ctx.strokeStyle = '#7fe0f5';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, 130, 44, 10);
        ctx.stroke();
        ctx.fillStyle = '#7fe0f5';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText('ROUND', x + 12, y + 16);
        ctx.fillStyle = '#fff';
        ctx.font = "bold 18px 'Outfit', sans-serif";
        ctx.fillText(this.game.round, x + 12, y + 36);
        ctx.restore();
    }

    drawLives(x, y) {
        const ctx = this.ctx;
        const maxLives = 3;
        const lives = Math.max(0, maxLives - this.game.penalties);
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        roundRect(ctx, x, y, 130, 44, 10);
        ctx.fill();
        ctx.strokeStyle = '#2dca72';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, 130, 44, 10);
        ctx.stroke();

        ctx.fillStyle = '#2dca72';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText('LIVES', x + 12, y + 16);

        const spacing = 28;
        for (let i = 0; i < maxLives; i++) {
            const ix = x + 40 + i * spacing;
            const iy = y + 28;
            ctx.beginPath();
            ctx.arc(ix, iy, 7, 0, Math.PI * 2);
            if (i < lives) {
                // Alive
                ctx.fillStyle = '#2dca72';
                ctx.fill();
            } else {
                // Lost
                ctx.strokeStyle = 'rgba(45, 202, 114, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
                // red X
                ctx.strokeStyle = '#ff4444';
                ctx.beginPath();
                ctx.moveTo(ix - 5, iy - 5); ctx.lineTo(ix + 5, iy + 5);
                ctx.moveTo(ix + 5, iy - 5); ctx.lineTo(ix - 5, iy + 5);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    drawFlash() {
        if (this.flashTimer <= 0) return;
        const ctx = this.ctx;
        const alpha = Math.min(1, this.flashTimer);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "bold 28px 'Outfit', sans-serif";
        ctx.fillStyle = this.flashColor;
        ctx.textAlign = 'center';
        ctx.shadowColor = this.flashColor;
        ctx.shadowBlur = 16;
        ctx.fillText(this.flashText, this.game.width / 2, this.game.height / 2 - 60);
        ctx.restore();
    }

    drawPenaltyFlash() {
        if (this.penaltyFlash <= 0) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = Math.min(0.35, this.penaltyFlash * 0.25);
        ctx.fillStyle = '#ff2020';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
        ctx.restore();
    }

    // ── Level 1 HUD ────────────────────────────────────────────────────────
    drawDiggingHUD() {
        const W = this.game.width, H = this.game.height;
        this.drawScowGauge(HUD_PAD, HUD_PAD, 180, 26);
        this.drawScore(W - 196, HUD_PAD);
        this.drawRound(W - 196, HUD_PAD + 54);
        this.drawLives(W - 196, HUD_PAD + 108);
        this._drawDiggingControls(H);
        this.drawPenaltyFlash();
        this.drawFlash();
    }

    _drawDiggingControls(H) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.7)';
        roundRect(ctx, HUD_PAD, H - 99, 248, 85, 10);
        ctx.fill();
        ctx.fillStyle = '#7fe0f5';
        ctx.font = "13px 'Outfit', sans-serif";
        ctx.fillText('↓  Lower clamshell bucket', HUD_PAD + 14, H - 75);
        ctx.fillText('↑  Raise clamshell bucket', HUD_PAD + 14, H - 57);
        ctx.fillText('←  →  Move barge left / right', HUD_PAD + 14, H - 39);
        ctx.fillStyle = 'rgba(245,166,35,0.85)';
        ctx.font = "11px 'Outfit', sans-serif";
        ctx.fillText('Grab triggers auto on seabed contact!', HUD_PAD + 14, H - 20);
        ctx.restore();
    }

    // ── Level 2 HUD ────────────────────────────────────────────────────────
    drawTransportHUD() {
        const W = this.game.width, H = this.game.height;
        this.drawScowGauge(HUD_PAD, HUD_PAD, 180, 26);
        this.drawScore(W - 196, HUD_PAD);
        this.drawRound(W - 196, HUD_PAD + 54);
        this.drawLives(W - 196, HUD_PAD + 108);
        if (this.game.levelTransport) {
            this.drawWindIndicator(HUD_PAD, H - 140);
            this.drawCurrentIndicator(HUD_PAD + 130, H - 140);
        }
        this.drawPenaltyFlash();
        this.drawFlash();
        if (this.game.levelTransport && this.game.levelTransport.scowInZone) {
            this._drawDumpingStatus();
        }
    }

    drawWindIndicator(x, y) {
        const ctx = this.ctx;
        const d = this.game.levelTransport;
        const wx = d.windX, wy = d.windY;
        const mag = Math.sqrt(wx * wx + wy * wy);

        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        roundRect(ctx, x, y, 118, 118, 12);
        ctx.fill();
        ctx.strokeStyle = '#2ab8e0';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, 118, 118, 12);
        ctx.stroke();

        ctx.fillStyle = '#7fe0f5';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('WIND', x + 59, y + 17);

        const cx = x + 59, cy = y + 65, r = 34;
        ctx.strokeStyle = 'rgba(42,184,224,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(42,184,224,0.5)';
        ctx.font = "10px 'Outfit', sans-serif";
        ctx.fillText('N', cx, cy - r - 4);
        ctx.fillText('S', cx, cy + r + 12);
        ctx.fillText('E', cx + r + 8, cy + 4);
        ctx.fillText('W', cx - r - 8, cy + 4);
        if (mag > 0.01) {
            const nx = wx / mag, ny = wy / mag;
            drawArrow(ctx, cx, cy, cx + nx * r * 0.8, cy + ny * r * 0.8, '#2ab8e0', 3);
        }
        ctx.fillStyle = '#fff';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText(`${mag.toFixed(1)} kts`, cx, y + 108);
        ctx.restore();
    }

    drawCurrentIndicator(x, y) {
        const ctx = this.ctx;
        const d = this.game.levelTransport;
        const cxv = d.currentX, cyv = d.currentY;
        const mag = Math.sqrt(cxv * cxv + cyv * cyv);

        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        roundRect(ctx, x, y, 118, 118, 12);
        ctx.fill();
        ctx.strokeStyle = '#2dca72';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, 118, 118, 12);
        ctx.stroke();

        ctx.fillStyle = '#a8f0c8';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('CURRENT', x + 59, y + 17);

        const cx = x + 59, cy = y + 65, r = 34;
        ctx.strokeStyle = 'rgba(45,202,114,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(45,202,114,0.5)';
        ctx.font = "10px 'Outfit', sans-serif";
        ctx.fillText('N', cx, cy - r - 4);
        ctx.fillText('S', cx, cy + r + 12);
        ctx.fillText('E', cx + r + 8, cy + 4);
        ctx.fillText('W', cx - r - 8, cy + 4);
        if (mag > 0.01) {
            const nx = cxv / mag, ny = cyv / mag;
            drawArrow(ctx, cx, cy, cx + nx * r * 0.8, cy + ny * r * 0.8, '#2dca72', 3);
        }
        ctx.fillStyle = '#fff';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText(`${mag.toFixed(1)} kts`, cx, y + 108);
        ctx.restore();
    }

    _drawDumpingStatus() {
        const ctx = this.ctx;
        const W = this.game.width;
        const lt = this.game.levelTransport;
        const pct = Math.round((1 - this.game.scowFill) * 100);
        ctx.save();
        ctx.fillStyle = 'rgba(45,202,114,0.15)';
        ctx.strokeStyle = '#2dca72';
        ctx.lineWidth = 2;
        roundRect(ctx, W / 2 - 140, 90, 280, 44, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2dca72';
        ctx.font = "bold 16px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(`⬇ DUMPING… ${pct}% discharged`, W / 2, 118);
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

function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 10;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
