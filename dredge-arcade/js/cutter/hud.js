// js/cutter/hud.js — HUD rendering for the Cutter Suction Dredge game

const HUD_PAD = 16;

export class HUD {
    constructor(ctx, game) {
        this.ctx = ctx;
        this.game = game;
        this.flashText = '';
        this.flashTimer = 0;
        this.flashColor = '#2dca72';
        this.penaltyFlash = 0;
    }

    flash(text, color = '#2dca72') {
        this.flashText = text;
        this.flashTimer = 2.0;
        this.flashColor = color;
    }

    flashPenalty() { this.penaltyFlash = 1.5; }

    update(dt) {
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.penaltyFlash > 0) this.penaltyFlash -= dt;
    }

    drawCuttingHUD(pumpPressure, ladderDepth, cavitations, maxCavitations, overpressureTime, cavOverpressThreshold) {
        const W = this.game.width, H = this.game.height;
        this._drawPressureGauge(HUD_PAD, HUD_PAD, 180, 26, pumpPressure, overpressureTime, cavOverpressThreshold);
        this._drawDepthIndicator(HUD_PAD, HUD_PAD + 116, ladderDepth);
        this._drawScore(W - 196, HUD_PAD);
        this._drawRound(W - 196, HUD_PAD + 54);
        this._drawCavitationCounter(W / 2, HUD_PAD, cavitations, maxCavitations);
        this._drawControls(H);
        this._drawPenaltyFlash();
        this._drawFlash();
    }

    _drawPressureGauge(x, y, w, h, pressure, overpressureTime, overpressThreshold) {
        const ctx = this.ctx;
        const MAX_P = 1.2;
        const boxW = w + 120, boxH = h + 80;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        _roundRect(ctx, x, y, boxW, boxH, 12); ctx.fill();
        const borderCol = pressure >= 1.0 ? '#e84040' : pressure >= 0.7 ? '#f5a623' : '#2dca72';
        ctx.strokeStyle = borderCol; ctx.lineWidth = 2;
        _roundRect(ctx, x, y, boxW, boxH, 12); ctx.stroke();

        ctx.fillStyle = '#a8f0c8';
        ctx.font = "bold 13px 'Outfit', sans-serif";
        ctx.fillText('PUMP PRESSURE', x + 14, y + 22);

        // Percentage label — can exceed 100%
        const pctLabel = `${Math.round(pressure * 100)}%`;
        ctx.fillStyle = pressure >= 1.0 ? '#ff6060' : '#fff';
        ctx.font = "bold 13px 'Outfit', sans-serif";
        ctx.textAlign = 'right';
        ctx.fillText(pctLabel, x + boxW - 8, y + 22);
        ctx.textAlign = 'left';

        // Bar track
        const bx = x + 14, by = y + 30, bw = boxW - 28, bh = h - 4;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        _roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();

        // Danger zone tint (100–120% region)
        const p100x = bx + bw * (1.0 / MAX_P);
        ctx.fillStyle = 'rgba(255,50,0,0.18)';
        ctx.fillRect(p100x, by, bx + bw - p100x, bh);

        // 100% marker
        ctx.strokeStyle = 'rgba(255,80,80,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p100x, by - 3); ctx.lineTo(p100x, by + bh + 3); ctx.stroke();

        // Bar fill
        const fillW = Math.min(pressure / MAX_P, 1.0) * bw;
        const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        if (pressure < 0.6) {
            grad.addColorStop(0, '#2dca72'); grad.addColorStop(1, '#2ab8e0');
        } else if (pressure < 1.0) {
            grad.addColorStop(0, '#f5a623'); grad.addColorStop(1, '#e87c20');
        } else {
            grad.addColorStop(0, '#e84040'); grad.addColorStop(1, '#ff2020');
        }
        ctx.fillStyle = grad;
        _roundRect(ctx, bx, by, fillW, bh, 6); ctx.fill();

        // Scale labels
        ctx.fillStyle = 'rgba(150,200,180,0.6)';
        ctx.font = "9px 'Outfit', sans-serif";
        for (const [pct, label] of [[0, '0%'], [0.5, '50%'], [1.0, '100%'], [1.2, '120%']]) {
            ctx.fillText(label, bx + (pct / MAX_P) * bw - 4, by + bh + 12);
        }

        // Overpressure countdown strip
        if (overpressureTime > 0 && overpressThreshold > 0) {
            const ty = by + bh + 18, th = 7;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            _roundRect(ctx, bx, ty, bw, th, 3); ctx.fill();
            const frac = Math.min(overpressureTime / overpressThreshold, 1.0);
            ctx.fillStyle = `hsl(${20 - frac * 20},100%,55%)`;
            _roundRect(ctx, bx, ty, bw * frac, th, 3); ctx.fill();
            ctx.fillStyle = 'rgba(255,160,80,0.9)';
            ctx.font = "bold 10px 'Outfit', sans-serif";
            const remaining = (overpressThreshold - overpressureTime).toFixed(1);
            ctx.fillText(`⚠ OVERLOAD  CAVITATION IN ${remaining}s`, bx + 4, ty + th + 12);
        }

        ctx.restore();
    }

    _drawDepthIndicator(x, y, depth) {
        const ctx = this.ctx;
        const W = 118, H = 62;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        _roundRect(ctx, x, y, W, H, 10); ctx.fill();
        ctx.strokeStyle = '#2dca72'; ctx.lineWidth = 2;
        _roundRect(ctx, x, y, W, H, 10); ctx.stroke();

        ctx.fillStyle = '#a8f0c8';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText('CUTTER DEPTH', x + 10, y + 16);

        // Horizontal depth bar
        const bx = x + 10, by = y + 26, bw = W - 20, bh = 14;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        _roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();

        // Green zone marker (optimal: 0.45–0.75)
        const optL = bw * 0.45, optW = bw * 0.30;
        ctx.fillStyle = 'rgba(45,202,114,0.25)';
        ctx.fillRect(bx + optL, by, optW, bh);

        // Depth pointer
        const px = bx + depth * bw;
        ctx.fillStyle = depth > 0.85 ? '#e84040' : depth < 0.3 ? '#f5a623' : '#2dca72';
        ctx.fillRect(px - 2, by - 2, 4, bh + 4);

        ctx.fillStyle = 'rgba(180,220,255,0.7)';
        ctx.font = "10px 'Outfit', sans-serif";
        ctx.fillText('SHALLOW', bx, y + H - 6);
        ctx.textAlign = 'right';
        ctx.fillText('DEEP', bx + bw, y + H - 6);
        ctx.restore();
    }

    _drawScore(x, y) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        _roundRect(ctx, x, y, 180, 44, 10); ctx.fill();
        ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 2;
        _roundRect(ctx, x, y, 180, 44, 10); ctx.stroke();
        ctx.fillStyle = '#f5a623';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText('SCORE', x + 12, y + 16);
        ctx.fillStyle = '#fff';
        ctx.font = "bold 18px 'Outfit', sans-serif";
        ctx.fillText(this.game.score.toLocaleString(), x + 12, y + 36);
        ctx.restore();
    }

    _drawRound(x, y) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        _roundRect(ctx, x, y, 130, 44, 10); ctx.fill();
        ctx.strokeStyle = '#2dca72'; ctx.lineWidth = 2;
        _roundRect(ctx, x, y, 130, 44, 10); ctx.stroke();
        ctx.fillStyle = '#a8f0c8';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.fillText('ROUND', x + 12, y + 16);
        ctx.fillStyle = '#fff';
        ctx.font = "bold 18px 'Outfit', sans-serif";
        ctx.fillText(this.game.round, x + 12, y + 36);
        ctx.restore();
    }

    _drawCavitationCounter(cx, y, cavitations, maxCav) {
        const ctx = this.ctx;
        const boxW = 200, boxH = 44;
        const x = cx - boxW / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.82)';
        _roundRect(ctx, x, y, boxW, boxH, 10); ctx.fill();
        ctx.strokeStyle = cavitations > 0 ? '#e84040' : '#2dca72';
        ctx.lineWidth = 2;
        _roundRect(ctx, x, y, boxW, boxH, 10); ctx.stroke();

        ctx.fillStyle = '#a8f0c8';
        ctx.font = "bold 11px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('PUMP LIVES', cx, y + 15);

        // Draw cavitation indicators (hearts / pump icons)
        const iconSpacing = 32;
        const startX = cx - ((maxCav - 1) * iconSpacing) / 2;
        for (let i = 0; i < maxCav; i++) {
            ctx.fillStyle = i < (maxCav - cavitations) ? '#2dca72' : 'rgba(100,100,100,0.4)';
            ctx.font = "18px 'Outfit', sans-serif";
            ctx.fillText('⚙', startX + i * iconSpacing, y + 36);
        }
        ctx.restore();
    }

    _drawControls(H) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(5,20,40,0.7)';
        _roundRect(ctx, HUD_PAD, H - 118, 272, 104, 10); ctx.fill();
        ctx.fillStyle = '#a8f0c8';
        ctx.font = "13px 'Outfit', sans-serif";
        ctx.textAlign = 'left';
        ctx.fillText('←  →  Drive swing left / right', HUD_PAD + 14, H - 94);
        ctx.fillText('↑  Raise cutter  /  ↓  Lower cutter', HUD_PAD + 14, H - 76);
        ctx.fillText('W  Step forward   /  S  Step back', HUD_PAD + 14, H - 58);
        ctx.fillStyle = 'rgba(245,166,35,0.85)';
        ctx.font = "11px 'Outfit', sans-serif";
        ctx.fillText('Stay in the green depth zone. Watch pressure!', HUD_PAD + 14, H - 40);
        ctx.fillStyle = 'rgba(180,220,255,0.55)';
        ctx.fillText('Hold pump above 100% for 5 s = cavitation.', HUD_PAD + 14, H - 24);
        ctx.restore();
    }

    _drawFlash() {
        if (this.flashTimer <= 0) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.flashTimer);
        ctx.font = "bold 28px 'Outfit', sans-serif";
        ctx.fillStyle = this.flashColor;
        ctx.textAlign = 'center';
        ctx.shadowColor = this.flashColor;
        ctx.shadowBlur = 16;
        ctx.fillText(this.flashText, this.game.width / 2, this.game.height / 2 - 60);
        ctx.restore();
    }

    _drawPenaltyFlash() {
        if (this.penaltyFlash <= 0) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = Math.min(0.35, this.penaltyFlash * 0.25);
        ctx.fillStyle = '#ff2020';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
        ctx.restore();
    }
}

function _roundRect(ctx, x, y, w, h, r) {
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
