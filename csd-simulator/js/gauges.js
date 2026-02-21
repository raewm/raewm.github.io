// js/gauges.js — Reusable analog/digital gauge renderers (imperial, legibility-first)

const FACE_COLOR = '#1a1a1a';
const BEZEL_COLOR = '#333';
const BEZEL_LIGHT = '#555';
const TICK_COLOR = '#ccc';
const TICK_MINOR = '#555';
const NEEDLE_COLOR = '#ff6600';
const LABEL_COLOR = '#999';
const VALUE_COLOR = '#fff';

function px(cx, r, deg) { return cx + r * Math.cos((deg - 90) * Math.PI / 180); }
function py(cy, r, deg) { return cy + r * Math.sin((deg - 90) * Math.PI / 180); }

// ── Analog Gauge ─────────────────────────────────────────────────────────────
export function drawAnalogGauge(ctx, cx, cy, r, value, min, max, label, unit, opts = {}) {
    const {
        startDeg = 135,
        endDeg = 405,
        majorTicks = 5,
        redZone = null,   // { from, to } fractions of [0,1]
        warnZone = null,
    } = opts;

    const span = endDeg - startDeg;
    const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const ndlDeg = startDeg + frac * span;

    ctx.save();

    // ── Bezel ring
    const bz = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r + 7);
    bz.addColorStop(0, BEZEL_LIGHT); bz.addColorStop(1, '#222');
    ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = bz; ctx.fill();

    // ── Face
    const fg = ctx.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r);
    fg.addColorStop(0, '#2a2a2a'); fg.addColorStop(1, '#111');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fg; ctx.fill();

    // ── Coloured arcs (red/warn zones) — thin strip near rim
    if (warnZone) {
        ctx.beginPath();
        ctx.arc(cx, cy, r - 5,
            (startDeg + warnZone.from * span - 90) * Math.PI / 180,
            (startDeg + warnZone.to * span - 90) * Math.PI / 180);
        ctx.strokeStyle = 'rgba(255,165,0,0.7)'; ctx.lineWidth = 5; ctx.stroke();
    }
    if (redZone) {
        ctx.beginPath();
        ctx.arc(cx, cy, r - 5,
            (startDeg + redZone.from * span - 90) * Math.PI / 180,
            (startDeg + redZone.to * span - 90) * Math.PI / 180);
        ctx.strokeStyle = 'rgba(220,40,40,0.8)'; ctx.lineWidth = 5; ctx.stroke();
    }

    // ── Major ticks + labels
    const tickOuter = r - 5;
    const tickInner = r - 14;
    const lblR = r - 22;
    // Decide how many label chars we can fit at this radius
    const lblSz = Math.max(7, Math.min(11, r * 0.13));
    ctx.font = `${lblSz}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (let i = 0; i <= majorTicks; i++) {
        const t = i / majorTicks;
        const deg = startDeg + t * span;
        ctx.strokeStyle = TICK_COLOR; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px(cx, tickOuter, deg), py(cy, tickOuter, deg));
        ctx.lineTo(px(cx, tickInner, deg), py(cy, tickInner, deg));
        ctx.stroke();
        // Only label first, last, and midpoint(s) to avoid crowding
        const lval = min + t * (max - min);
        const lx = px(cx, lblR, deg);
        const ly = py(cy, lblR, deg);
        ctx.fillStyle = TICK_COLOR;
        // Abbreviate large numbers
        const txt = Math.abs(lval) >= 1000 ? `${Math.round(lval / 1000)}k` : Math.round(lval).toString();
        ctx.fillText(txt, lx, ly);
    }

    // ── Minor ticks (shorter, no label)
    const minorCount = 4;
    for (let i = 0; i < majorTicks; i++) {
        for (let j = 1; j <= minorCount; j++) {
            const t = (i + j / (minorCount + 1)) / majorTicks;
            const deg = startDeg + t * span;
            ctx.strokeStyle = TICK_MINOR; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px(cx, tickOuter, deg), py(cy, tickOuter, deg));
            ctx.lineTo(px(cx, r - 9, deg), py(cy, r - 9, deg));
            ctx.stroke();
        }
    }

    // ── Needle
    ctx.save();
    ctx.shadowColor = 'rgba(255,102,0,0.5)'; ctx.shadowBlur = 5;
    ctx.strokeStyle = NEEDLE_COLOR; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px(cx, -r * 0.14, ndlDeg), py(cy, -r * 0.14, ndlDeg));
    ctx.lineTo(px(cx, r * 0.74, ndlDeg), py(cy, r * 0.74, ndlDeg));
    ctx.stroke();
    ctx.restore();

    // ── Center cap
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, r * 0.07), 0, Math.PI * 2);
    ctx.fillStyle = '#777'; ctx.fill();

    // ── Digital value — inside face, centered vertically
    const valSz = Math.max(9, Math.min(14, r * 0.20));
    const valStr = (Math.abs(value) < 10 ? value.toFixed(2) :
        Math.abs(value) < 100 ? value.toFixed(1) : value.toFixed(0));
    ctx.font = `bold ${valSz}px monospace`;
    ctx.fillStyle = VALUE_COLOR; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(valStr, cx, cy + r * 0.28);

    // ── Unit — small, just below value
    const unitSz = Math.max(7, Math.min(10, r * 0.13));
    ctx.font = `${unitSz}px sans-serif`;
    ctx.fillStyle = '#666'; ctx.textAlign = 'center';
    ctx.fillText(unit, cx, cy + r * 0.44);

    // ── Label — at bottom of gauge face
    const lblFaceSz = Math.max(7, Math.min(10, r * 0.12));
    ctx.font = `bold ${lblFaceSz}px sans-serif`;
    ctx.fillStyle = LABEL_COLOR; ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r * 0.62);

    ctx.restore();
}

// ── Vertical Depth Bar ────────────────────────────────────────────────────
// 0 ft = top, maxFt = bottom. Ticks + current value on right side, tiny text.
export function drawDepthBar(ctx, x, y, w, h, valueFt, maxFt) {
    ctx.save();

    // Bezel
    ctx.fillStyle = '#1e1e1e'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    // Track
    ctx.fillStyle = '#080808'; ctx.fillRect(x, y, w, h);

    // Fill from top down (surface at top)
    const frac = Math.max(0, Math.min(1, valueFt / maxFt));
    const fillH = h * frac;
    const gr = ctx.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0.0, '#27ae60');
    gr.addColorStop(0.4, '#f39c12');
    gr.addColorStop(1.0, '#c0392b');
    ctx.fillStyle = gr; ctx.fillRect(x, y, w, fillH);

    // Indicator line
    const vy = y + fillH;
    ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(x, vy); ctx.lineTo(x + w, vy); ctx.stroke();
    ctx.setLineDash([]);

    // Tick labels on right — 3 ticks only, HIGH CONTRAST white
    const tSz = Math.max(7, Math.min(10, w * 0.65));
    ctx.font = `bold ${tSz}px monospace`; ctx.textAlign = 'left';
    [[0, '0'], [0.5, (maxFt / 2).toFixed(0)], [1, maxFt.toFixed(0)]].forEach(([f, lbl]) => {
        const ty = y + f * h;
        ctx.fillStyle = '#888'; ctx.fillRect(x + w, ty - 0.5, 4, 1);  // tick mark
        ctx.fillStyle = '#ddd'; ctx.fillText(lbl, x + w + 5, ty + tSz * 0.4);
    });

    // 'ft' unit at top-right in cyan
    ctx.font = `bold ${tSz}px sans-serif`; ctx.fillStyle = '#5af';
    ctx.fillText('ft', x + w + 5, y - 2);

    // Current value next to indicator — bright orange, large enough to read
    const valSz = Math.max(8, Math.min(11, w * 0.72));
    ctx.font = `bold ${valSz}px monospace`; ctx.fillStyle = '#ff8800'; ctx.textAlign = 'center';
    const valY = vy < y + valSz + 5 ? vy + valSz + 4 : vy - 2;
    ctx.fillText(valueFt.toFixed(1), x + w / 2, valY);

    ctx.restore();
}


// ── Swing Width Horizontal Bar ────────────────────────────────────────────────
export function drawSwingBar(ctx, x, y, w, h, valueFt, maxFt) {
    ctx.save();
    const CX = x + w / 2;

    // Bezel
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);

    // Track
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(x, y, w, h);

    // Centre mark
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(CX, y); ctx.lineTo(CX, y + h); ctx.stroke();

    // Active fill
    const frac = Math.max(-1, Math.min(1, valueFt / maxFt));
    const barW = Math.abs(frac) * (w / 2);
    const barX = frac >= 0 ? CX : CX - barW;
    const bg = ctx.createLinearGradient(barX, y, barX + barW, y);
    if (frac >= 0) {
        bg.addColorStop(0, '#1a5a80'); bg.addColorStop(1, '#2ab8e0');
    } else {
        bg.addColorStop(0, '#e07a2a'); bg.addColorStop(1, '#803010');
    }
    ctx.fillStyle = bg; ctx.fillRect(barX, y + 2, barW, h - 4);

    // Port / SB labels
    const sz = Math.max(8, h * 0.50);
    ctx.font = `bold ${sz}px sans-serif`; ctx.fillStyle = '#666';
    ctx.textAlign = 'left'; ctx.fillText('PS', x + 5, y + h * 0.68);
    ctx.textAlign = 'right'; ctx.fillText('SB', x + w - 5, y + h * 0.68);

    // Centre value
    ctx.fillStyle = VALUE_COLOR; ctx.textAlign = 'center';
    ctx.fillText(`Swing: ${valueFt >= 0 ? '+' : ''}${valueFt.toFixed(1)} ft`, CX, y + h * 0.68);

    ctx.restore();
}

// ── Digital Production Readout ────────────────────────────────────────────────
export function drawProductionPanel(ctx, x, y, w, h, cyh, tonh, totalCY, totalTons) {
    ctx.save();

    ctx.fillStyle = '#0c1018'; ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);

    const FS = (frac) => Math.max(8, h * frac);

    // Title
    ctx.font = `bold ${FS(0.09)}px sans-serif`;
    ctx.fillStyle = '#555'; ctx.textAlign = 'center';
    ctx.fillText('PRODUCTION', x + w / 2, y + FS(0.10));

    ctx.strokeStyle = '#222';
    ctx.beginPath(); ctx.moveTo(x + 6, y + h * 0.18); ctx.lineTo(x + w - 6, y + h * 0.18); ctx.stroke();

    const row = (label, value, unit, ry) => {
        ctx.font = `${FS(0.08)}px sans-serif`;
        ctx.fillStyle = '#555'; ctx.textAlign = 'left';
        ctx.fillText(label, x + 7, ry);

        ctx.font = `bold ${FS(0.13)}px monospace`;
        ctx.fillStyle = '#00e87a'; ctx.textAlign = 'right';
        ctx.fillText(value, x + w - 32, ry);

        ctx.font = `${FS(0.07)}px sans-serif`;
        ctx.fillStyle = '#444'; ctx.textAlign = 'left';
        ctx.fillText(unit, x + w - 28, ry);
    };

    ctx.font = `bold ${FS(0.07)}px sans-serif`;
    ctx.fillStyle = '#444'; ctx.textAlign = 'left';
    ctx.fillText('MOMENTARY', x + 7, y + h * 0.28);

    row('Flow', cyh.toFixed(0), 'cy/h', y + h * 0.41);
    row('Mass', tonh.toFixed(0), 't/h', y + h * 0.54);

    ctx.strokeStyle = '#222';
    ctx.beginPath(); ctx.moveTo(x + 6, y + h * 0.62); ctx.lineTo(x + w - 6, y + h * 0.62); ctx.stroke();

    ctx.font = `bold ${FS(0.07)}px sans-serif`;
    ctx.fillStyle = '#444'; ctx.textAlign = 'left';
    ctx.fillText('TOTAL RUN', x + 7, y + h * 0.70);

    row('Volume', totalCY.toFixed(1), 'cy', y + h * 0.82);
    row('Weight', totalTons.toFixed(1), 'tons', y + h * 0.94);

    ctx.restore();
}

// ── Pump RPM Gauge (digital bar style) ───────────────────────────────────────
export function drawPumpRPMGauge(ctx, x, y, w, h, rpm, rpmMax, effort) {
    ctx.save();

    ctx.fillStyle = '#0c1018'; ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);

    const FS = frac => Math.max(8, h * frac);

    // Title
    ctx.font = `bold ${FS(0.09)}px sans-serif`;
    ctx.fillStyle = '#555'; ctx.textAlign = 'center';
    ctx.fillText('PUMP RPM', x + w / 2, y + FS(0.10));

    // RPM value
    ctx.font = `bold ${FS(0.22)}px monospace`;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(rpm.toFixed(0), x + w / 2, y + h * 0.42);

    ctx.font = `${FS(0.08)}px sans-serif`;
    ctx.fillStyle = '#555';
    ctx.fillText(`/ ${rpmMax} RPM`, x + w / 2, y + h * 0.52);

    // Load bar
    const barY = y + h * 0.60;
    const barH = h * 0.10;
    const barW = w - 16;
    const barX = x + 8;
    ctx.fillStyle = '#111'; ctx.fillRect(barX, barY, barW, barH);
    const effortColor = effort > 0.8 ? '#e74c3c' : effort > 0.5 ? '#f39c12' : '#2dca72';
    const fillW = barW * Math.min(1, effort);
    const bg = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    bg.addColorStop(0, '#1a5a1a'); bg.addColorStop(1, effortColor);
    ctx.fillStyle = bg; ctx.fillRect(barX, barY, fillW, barH);
    ctx.strokeStyle = '#333'; ctx.strokeRect(barX, barY, barW, barH);

    // "LOAD" label
    ctx.font = `bold ${FS(0.07)}px sans-serif`;
    ctx.fillStyle = '#444'; ctx.textAlign = 'center';
    ctx.fillText(`LOAD: ${(effort * 100).toFixed(0)}%`, x + w / 2, barY + barH + FS(0.09));

    // Sag warning
    if (rpm < rpmMax * 0.75 && rpm > 10) {
        ctx.font = `bold ${FS(0.08)}px sans-serif`;
        ctx.fillStyle = '#f39c12'; ctx.textAlign = 'center';
        ctx.fillText('⚠ SAG', x + w / 2, y + h * 0.90);
    } else {
        ctx.font = `${FS(0.07)}px sans-serif`;
        ctx.fillStyle = '#2dca72'; ctx.textAlign = 'center';
        ctx.fillText('NOMINAL', x + w / 2, y + h * 0.90);
    }

    ctx.restore();
}
