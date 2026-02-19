// js/engine.js — Unified Dredge Arcade orchestrator
// Handles: game selection, shared canvas/input/resize, per-game state machine

// ── Exports used by level modules ──────────────────────────────────────────
//   Hopper:   transitionToDisposal, transitionToLoading, showGameOver
//   Clamshell: transitionToTransport, transitionToDigging, showGameOver

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── State ──────────────────────────────────────────────────────────────────
export const STATE = {
    ARCADE_MENU: 'ARCADE_MENU',  // top-level game picker
    GAME_MENU: 'GAME_MENU',    // per-game start screen (handled by HTML overlay)
    PLAYING: 'PLAYING',      // active gameplay
    TRANSITION: 'TRANSITION',
};

export const game = {
    state: STATE.ARCADE_MENU,
    activeGame: null,   // 'hopper' | 'clamshell'

    // shared per-game fields
    width: 0, height: 0,
    score: 0, round: 1, penalties: 0,

    // hopper-specific
    hopperFill: 0, hopperMax: 1, turtlePenalties: 0,
    highScore_hopper: parseInt(localStorage.getItem('dredge_hs') || '0'),

    // clamshell-specific
    scowFill: 0,
    highScore_clamshell: parseInt(localStorage.getItem('clamshell_hs') || '0'),

    // per-game references (set at game init)
    scoring: null, hud: null,
    levelLoading: null, levelDisposal: null,    // hopper
    levelDigging: null, levelTransport: null,   // clamshell

    // transition
    fadeAlpha: 0, fadeDir: 0,
    transitionFrom: null, transitionTo: null,
    transitionNextLevel: null,   // state string of the next level
};

// ── Input ──────────────────────────────────────────────────────────────────
export const keys = {
    ArrowUp: false, ArrowDown: false,
    ArrowLeft: false, ArrowRight: false,
};
window.addEventListener('keydown', e => {
    if (Object.prototype.hasOwnProperty.call(keys, e.code)) {
        keys[e.code] = true; e.preventDefault();
    }
});
window.addEventListener('keyup', e => {
    if (Object.prototype.hasOwnProperty.call(keys, e.code)) keys[e.code] = false;
});

// ── Resize ─────────────────────────────────────────────────────────────────
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    game.width = canvas.width;
    game.height = canvas.height;
    if (game.levelLoading) game.levelLoading.onResize();
    if (game.levelDisposal) game.levelDisposal.onResize();
    if (game.levelDigging) game.levelDigging.onResize();
    if (game.levelTransport) game.levelTransport.onResize();
}
window.addEventListener('resize', resize);

// ── Game init ──────────────────────────────────────────────────────────────
async function initGame(which) {
    game.activeGame = which;
    game.score = 0;
    game.round = 1;
    game.penalties = 0;

    // Clear the other game's refs so resize doesn't call stale objects
    game.levelLoading = null; game.levelDisposal = null;
    game.levelDigging = null; game.levelTransport = null;

    if (which === 'hopper') {
        game.hopperFill = 0;
        game.turtlePenalties = 0;

        const { Scoring } = await import('./hopper/scoring.js');
        const { HUD } = await import('./hopper/hud.js');
        const { LevelLoading } = await import('./hopper/level-loading.js');
        const { LevelDisposal } = await import('./hopper/level-disposal.js');

        game.scoring = new Scoring(game);
        game.hud = new HUD(ctx, game);
        game.levelLoading = new LevelLoading(ctx, canvas, game, keys);
        game.levelDisposal = new LevelDisposal(ctx, canvas, game, keys);

        // First level key — fade in from black immediately
        game.transitionNextLevel = 'LOADING';
        game.transitionFrom = null;
        game.fadeAlpha = 1;   // start fully black, fade in
        game.fadeDir = -1;
        game.state = STATE.TRANSITION;
    } else {
        game.scowFill = 0;

        const { Scoring } = await import('./clamshell/scoring.js');
        const { HUD } = await import('./clamshell/hud.js');
        const { LevelDigging } = await import('./clamshell/level-digging.js');
        const { LevelTransport } = await import('./clamshell/level-transport.js');

        game.scoring = new Scoring(game);
        game.hud = new HUD(ctx, game);
        game.levelDigging = new LevelDigging(ctx, canvas, game, keys);
        game.levelTransport = new LevelTransport(ctx, canvas, game, keys);

        // First level key — start playing immediately (fade in from black)
        game.transitionNextLevel = 'DIGGING';
        game.transitionFrom = null;
        game.fadeAlpha = 1;   // start fully black, fade in
        game.fadeDir = -1;
        game.state = STATE.TRANSITION;
    }
}

// ── Fade transition ─────────────────────────────────────────────────────────
function startFade(nextLevelKey) {
    game.fadeAlpha = 0;
    game.fadeDir = 1;
    game.transitionFrom = game.transitionNextLevel || null;
    game.transitionNextLevel = nextLevelKey;
    game.state = STATE.TRANSITION;
}

// ── Exported level-transition hooks (called by level modules) ───────────────
export function transitionToDisposal() { startFade('DISPOSING'); }
export function transitionToLoading() { game.round++; startFade('LOADING'); }
export function transitionToTransport() { startFade('TRANSPORTING'); }
export function transitionToDigging() { game.round++; startFade('DIGGING'); }

// ── Show game-over overlay ──────────────────────────────────────────────────
export function showGameOver() {
    const isHopper = game.activeGame === 'hopper';
    const hsKey = isHopper ? 'dredge_hs' : 'clamshell_hs';
    const hsField = isHopper ? 'highScore_hopper' : 'highScore_clamshell';
    const penLabel = isHopper ? 'Turtle penalties' : 'Piling penalties';

    if (game.score > game[hsField]) {
        game[hsField] = game.score;
        localStorage.setItem(hsKey, game[hsField]);
    }

    const hs = game[hsField];
    document.getElementById('goStats').innerHTML = `
        <div>Score: <strong>${game.score.toLocaleString()}</strong></div>
        <div>Rounds: <strong>${game.round - 1}</strong></div>
        <div>${penLabel}: <strong>${game.penalties + game.turtlePenalties}</strong></div>
        ${game.score >= hs && hs > 0
            ? '<div style="color:#f5a623;font-weight:700;">🏆 New High Score!</div>'
            : `<div>Best: ${hs.toLocaleString()}</div>`}
    `;
    updateHighScoreDisplay();
    document.getElementById('gameOverOverlay').classList.remove('hidden');
    game.state = STATE.ARCADE_MENU;
}

// ── Main loop ──────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    ctx.clearRect(0, 0, game.width, game.height);

    const ag = game.activeGame;

    switch (game.state) {
        case STATE.ARCADE_MENU:
            drawArcadeMenu(dt);
            break;

        case STATE.PLAYING:
        case STATE.TRANSITION:
            drawActiveGame(dt, ag);
            break;

        default:
            drawArcadeMenu(dt);
    }

    requestAnimationFrame(loop);
}

function drawActiveGame(dt, ag) {
    if (game.state === STATE.TRANSITION) {
        // Draw the outgoing or incoming level
        const key = game.fadeDir === 1 ? game.transitionFrom : game.transitionNextLevel;
        drawLevel(key, ag, 0);   // 0 = no dt update during transition
        game.fadeAlpha += game.fadeDir * dt * 2.5;

        if (game.fadeDir === 1 && game.fadeAlpha >= 1) {
            game.fadeAlpha = 1;
            game.fadeDir = -1;
            resetLevel(game.transitionNextLevel, ag);
        }
        if (game.fadeDir === -1 && game.fadeAlpha <= 0) {
            game.fadeAlpha = 0;
            game.state = STATE.PLAYING;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, game.fadeAlpha));
        ctx.fillStyle = '#041020';
        ctx.fillRect(0, 0, game.width, game.height);
        ctx.restore();
    } else {
        // Normal play
        drawLevel(game.transitionNextLevel, ag, dt);
    }
}

function drawLevel(key, ag, dt) {
    if (ag === 'hopper') {
        if (key === 'LOADING' && game.levelLoading) {
            if (dt > 0) game.levelLoading.update(dt);
            game.levelLoading.draw();
            game.hud.drawLoadingHUD();
        } else if (key === 'DISPOSING' && game.levelDisposal) {
            if (dt > 0) game.levelDisposal.update(dt);
            game.levelDisposal.draw();
            game.hud.drawDisposalHUD();
        }
    } else {
        if (key === 'DIGGING' && game.levelDigging) {
            if (dt > 0) game.levelDigging.update(dt);
            game.levelDigging.draw();
            game.hud.drawDiggingHUD();
        } else if (key === 'TRANSPORTING' && game.levelTransport) {
            if (dt > 0) game.levelTransport.update(dt);
            game.levelTransport.draw();
            game.hud.drawTransportHUD();
        }
    }
}

function resetLevel(key, ag) {
    if (ag === 'hopper') {
        if (key === 'LOADING' && game.levelLoading) game.levelLoading.reset();
        if (key === 'DISPOSING' && game.levelDisposal) game.levelDisposal.reset();
    } else {
        if (key === 'DIGGING' && game.levelDigging) game.levelDigging.reset();
        if (key === 'TRANSPORTING' && game.levelTransport) game.levelTransport.reset();
    }
}

// ── Arcade menu canvas background ──────────────────────────────────────────
let menuWave = 0;
function drawArcadeMenu(dt) {
    menuWave += dt * 60;
    const W = game.width, H = game.height;
    const skyG = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    skyG.addColorStop(0, '#0a1628'); skyG.addColorStop(1, '#0d3060');
    ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H);
    const seaG = ctx.createLinearGradient(0, H * 0.45, 0, H);
    seaG.addColorStop(0, '#0b4d8a'); seaG.addColorStop(1, '#041a36');
    ctx.fillStyle = seaG; ctx.fillRect(0, H * 0.45, W, H * 0.55);
    ctx.strokeStyle = 'rgba(42,184,224,0.3)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const y = H * 0.45 + i * 40;
        for (let x = 0; x <= W; x += 4) {
            const off = Math.sin((x / W) * Math.PI * 6 + menuWave * 0.05 + i) * 6;
            x === 0 ? ctx.moveTo(x, y + off) : ctx.lineTo(x, y + off);
        }
        ctx.stroke();
    }
}

// ── HUD high-score display ─────────────────────────────────────────────────
function updateHighScoreDisplay() {
    const el = document.getElementById('highScoreDisplay');
    if (!el) return;
    const hs = game.activeGame === 'hopper'
        ? game.highScore_hopper
        : game.highScore_clamshell;
    el.textContent = hs > 0 ? `Best: ${hs.toLocaleString()} pts` : '';
}

// ── HTML button wiring ─────────────────────────────────────────────────────
function showArcadeMenu() {
    document.getElementById('arcadeMenu').classList.add('arcade-visible');
    document.getElementById('hopperMenu').classList.add('hidden');
    document.getElementById('clamshellMenu').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    document.getElementById('menuBtn').classList.add('hidden');
    game.state = STATE.ARCADE_MENU;
    game.activeGame = null;
}

function showGameMenu(which) {
    document.getElementById('arcadeMenu').classList.remove('arcade-visible');
    document.getElementById(which === 'hopper' ? 'hopperMenu' : 'clamshellMenu').classList.remove('hidden');
    document.getElementById('menuBtn').classList.remove('hidden');
    game.activeGame = which;
    updateHighScoreDisplay();
}

document.getElementById('selectHopper').addEventListener('click', () => showGameMenu('hopper'));
document.getElementById('selectClamshell').addEventListener('click', () => showGameMenu('clamshell'));

document.getElementById('startHopper').addEventListener('click', () => {
    document.getElementById('hopperMenu').classList.add('hidden');
    initGame('hopper');
});
document.getElementById('startClamshell').addEventListener('click', () => {
    document.getElementById('clamshellMenu').classList.add('hidden');
    initGame('clamshell');
});

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOverOverlay').classList.add('hidden');
    initGame(game.activeGame);
});

document.getElementById('menuBtn').addEventListener('click', () => {
    showArcadeMenu();
});

// Start
resize();
updateHighScoreDisplay();
requestAnimationFrame(loop);
