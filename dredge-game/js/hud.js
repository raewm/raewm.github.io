// js/hud.js — HUD rendering for both levels

const HUD_PAD = 16;

export class HUD {
    constructor(ctx, game) {
        this.ctx = ctx;
        this.game = game;

        // Score flash
        this.flashText = '';
        this.flashTimer = 0;
        this.flashColor = '#2ab8e0';

        // Penalty flash
        this.penaltyFlash = 0;
    }

    flash(text, color = '#2ab8e0') {
        this.flashText = text;
        this.flashTimer = 2.0;
        this.flashColor = color;
    }

    flashPenalty() {
        this.penaltyFlash = 1.5;
    }

    update(dt) {
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.penaltyFlash > 0) this.penaltyFlash -= dt;
    }

    // ── Shared drawers ────────────────────────────────────────────────────────

    drawHopperGauge(x, y, w, h) {
        const ctx = this.ctx;
        const fill = this.game.hopperFill; // 0–1

        // Background panel
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        roundRect(ctx, x, y, w + 120, h + 50, 12);
        ctx.fill();
        ctx.strokeStyle = '#2ab8e0';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, w + 120, h + 50, 12);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#7fe0f5';
        ctx.font = "bold 13px 'Outfit', sans-serif";
        ctx.fillText('HOPPER LOAD', x + 14, y + 22);

        // Bar track
        const bx = x + 14, by = y + 30, bw = w + 90, bh = h - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        roundRect(ctx, bx, by, bw, bh, 8);
        ctx.fill();

        // Fill gradient
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

        // Percent text
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

    // ── Level 1 HUD ────────────────────────────────────────────────────────────
    drawLoadingHUD() {
        const W = this.game.width, H = this.game.height;
        // Hopper gauge — top left
        this.drawHopperGauge(HUD_PAD, HUD_PAD, 180, 26);
        // Score — top right
        this.drawScore(W - 196, HUD_PAD);
        // Round
        this.drawRound(W - 196, HUD_PAD + 54);
        // Depth hint
        this.drawDepthControl();
        // Flashes
        this.drawPenaltyFlash();
        this.drawFlash();
    }

    drawDepthControl() {
        const ctx = this.ctx;
        const W = this.game.width, H = this.game.height;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.7)';
        roundRect(ctx, HUD_PAD, H - 76, 240, 60, 10);
        ctx.fill();
        ctx.fillStyle = '#7fe0f5';
        ctx.font = "13px 'Outfit', sans-serif";
        ctx.fillText('↑ Lower draghead toward seabed', HUD_PAD + 14, H - 52);
        ctx.fillText('↓ Raise draghead off seabed', HUD_PAD + 14, H - 34);
        ctx.fillStyle = 'rgba(245,166,35,0.8)';
        ctx.font = "11px 'Outfit', sans-serif";
        ctx.fillText('Keep draghead in green zone!', HUD_PAD + 14, H - 17);
        ctx.restore();
    }

    // ── Level 2 HUD ────────────────────────────────────────────────────────────
    drawDisposalHUD() {
        const W = this.game.width, H = this.game.height;
        // Hopper gauge — top left
        this.drawHopperGauge(HUD_PAD, HUD_PAD, 180, 26);
        // Score — top right
        this.drawScore(W - 196, HUD_PAD);
        // Round
        this.drawRound(W - 196, HUD_PAD + 54);
        // Wind indicator
        if (this.game.levelDisposal) {
            this.drawWindIndicator(HUD_PAD, H - 140);
            this.drawCurrentIndicator(HUD_PAD + 130, H - 140);
        }
        // Flashes
        this.drawPenaltyFlash();
        this.drawFlash();
        // In-zone status
        if (this.game.levelDisposal && this.game.levelDisposal.inZone) {
            this.drawUnloadingStatus();
        }
    }

    drawWindIndicator(x, y) {
        const ctx = this.ctx;
        const d = this.game.levelDisposal;
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

        // compass circle
        const cx2 = x + 59, cy2 = y + 65, r = 34;
        ctx.strokeStyle = 'rgba(42,184,224,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI * 2); ctx.stroke();
        // cardinal marks
        ctx.fillStyle = 'rgba(42,184,224,0.5)';
        ctx.font = "10px 'Outfit', sans-serif";
        ctx.fillText('N', cx2, cy2 - r - 4);
        ctx.fillText('S', cx2, cy2 + r + 12);
        ctx.fillText('E', cx2 + r + 8, cy2 + 4);
        ctx.fillText('W', cx2 - r - 8, cy2 + 4);
        // Arrow
        if (mag > 0.01) {
            const nx = wx / mag, ny = wy / mag;
            drawArrow(ctx, cx2, cy2, cx2 + nx * r * 0.8, cy2 + ny * r * 0.8, '#2ab8e0', 3);
        }
        // Speed label
        ctx.fillStyle = '#fff';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText(`${mag.toFixed(1)} kts`, cx2, y + 108);
        ctx.restore();
    }

    drawCurrentIndicator(x, y) {
        const ctx = this.ctx;
        const d = this.game.levelDisposal;
        const cx2val = d.currentX, cy2val = d.currentY;
        const mag = Math.sqrt(cx2val * cx2val + cy2val * cy2val);

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
            const nx = cx2val / mag, ny = cy2val / mag;
            drawArrow(ctx, cx, cy, cx + nx * r * 0.8, cy + ny * r * 0.8, '#2dca72', 3);
        }
        ctx.fillStyle = '#fff';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText(`${mag.toFixed(1)} kts`, cx, y + 108);
        ctx.restore();
    }

    drawUnloadingStatus() {
        const ctx = this.ctx;
        const W = this.game.width;
        ctx.save();
        ctx.fillStyle = 'rgba(45,202,114,0.15)';
        ctx.strokeStyle = '#2dca72';
        ctx.lineWidth = 2;
        roundRect(ctx, W / 2 - 120, 90, 240, 44, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2dca72';
        ctx.font = "bold 16px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('⬇ UNLOADING...', W / 2, 118);
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
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
