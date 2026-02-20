// js/engine.js — Unified Dredge Arcade orchestrator
// Handles: game selection, shared canvas/input/resize, per-game state machine

import { submitScore, getTopScores } from './scoreboard.js';

// ── Exports used by level modules ──────────────────────────────────────────
//   Hopper:    transitionToDisposal, transitionToLoading, showGameOver
//   Clamshell: transitionToTransport, transitionToDigging, showGameOver
//   Cutter:    transitionNextCutterRound, showGameOver

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
    activeGame: null,   // 'hopper' | 'clamshell' | 'cutter'

    // shared per-game fields
    width: 0, height: 0,
    score: 0, round: 1, penalties: 0,

    // hopper-specific
    hopperFill: 0, hopperMax: 1, turtlePenalties: 0,
    highScore_hopper: parseInt(localStorage.getItem('dredge_hs') || '0'),

    // clamshell-specific
    scowFill: 0,
    seabedState: null,   // persists deformed seabed across rounds; null = regenerate
    highScore_clamshell: parseInt(localStorage.getItem('clamshell_hs') || '0'),


    // cutter-specific
    highScore_cutter: parseInt(localStorage.getItem('cutter_hs') || '0'),

    // per-game references (set at game init)
    scoring: null, hud: null,
    levelLoading: null, levelDisposal: null,    // hopper
    levelDigging: null, levelTransport: null,   // clamshell
    levelCutting: null,                         // cutter

    // transition
    fadeAlpha: 0, fadeDir: 0,
    transitionFrom: null, transitionTo: null,
    transitionNextLevel: null,   // state string of the next level
};

// ── Input ──────────────────────────────────────────────────────────────────
export const keys = {
    ArrowUp: false, ArrowDown: false,
    ArrowLeft: false, ArrowRight: false,
    KeyW: false, KeyS: false,
};

window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (Object.prototype.hasOwnProperty.call(keys, e.code)) {
        keys[e.code] = true; e.preventDefault();
    }
});
window.addEventListener('keyup', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
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
    if (game.levelCutting) game.levelCutting.onResize();
}
window.addEventListener('resize', resize);

// ── Game init ──────────────────────────────────────────────────────────────
async function initGame(which) {
    game.activeGame = which;
    game.score = 0;
    game.round = 1;
    game.penalties = 0;

    // Clear all game refs so resize doesn't call stale objects
    game.levelLoading = null; game.levelDisposal = null;
    game.levelDigging = null; game.levelTransport = null;
    game.levelCutting = null;

    if (which === 'hopper') {
        game.hopperFill = 0;
        game.turtlePenalties = 0;
        game.hopperSeabedState = null;

        const { Scoring } = await import('./hopper/scoring.js');
        const { HUD } = await import('./hopper/hud.js');
        const { LevelLoading } = await import('./hopper/level-loading.js');
        const { LevelDisposal } = await import('./hopper/level-disposal.js');

        game.scoring = new Scoring(game);
        game.hud = new HUD(ctx, game);
        game.levelLoading = new LevelLoading(ctx, canvas, game, keys);
        game.levelDisposal = new LevelDisposal(ctx, canvas, game, keys);

        game.transitionNextLevel = 'LOADING';
        game.transitionFrom = null;
        game.fadeAlpha = 1; game.fadeDir = -1;
        game.state = STATE.TRANSITION;
    } else if (which === 'clamshell') {
        game.scowFill = 0;
        game.seabedState = null;   // fresh seabed on new game


        const { Scoring } = await import('./clamshell/scoring.js');
        const { HUD } = await import('./clamshell/hud.js');
        const { LevelDigging } = await import('./clamshell/level-digging.js');
        const { LevelTransport } = await import('./clamshell/level-transport.js');

        game.scoring = new Scoring(game);
        game.hud = new HUD(ctx, game);
        game.levelDigging = new LevelDigging(ctx, canvas, game, keys);
        game.levelTransport = new LevelTransport(ctx, canvas, game, keys);

        game.transitionNextLevel = 'DIGGING';
        game.transitionFrom = null;
        game.fadeAlpha = 1; game.fadeDir = -1;
        game.state = STATE.TRANSITION;
    } else {  // 'cutter'
        const { Scoring } = await import('./cutter/scoring.js');
        const { HUD } = await import('./cutter/hud.js');
        const { LevelCutting } = await import('./cutter/level-cutting.js');

        game.scoring = new Scoring(game);
        game.hud = new HUD(ctx, game);
        game.levelCutting = new LevelCutting(ctx, canvas, game, keys);

        game.transitionNextLevel = 'CUTTING';
        game.transitionFrom = null;
        game.fadeAlpha = 1; game.fadeDir = -1;
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
export function transitionNextCutterRound() {
    game.round++;
    if (game.levelCutting) { game.levelCutting.transitioned = false; game.levelCutting.reset(); }
    startFade('CUTTING');
}

// ── Show game-over overlay ──────────────────────────────────────────────────
export async function showGameOver() {
    const isHopper = game.activeGame === 'hopper';
    const isCutter = game.activeGame === 'cutter';
    const hsKey = isHopper ? 'dredge_hs' : isCutter ? 'cutter_hs' : 'clamshell_hs';
    const hsField = isHopper ? 'highScore_hopper' : isCutter ? 'highScore_cutter' : 'highScore_clamshell';
    const penLabel = isHopper ? 'Turtle penalties' : isCutter ? 'Cavitations' : 'Piling penalties';
    const penValue = isHopper ? (game.penalties + game.turtlePenalties) : game.penalties;

    if (game.score > game[hsField]) {
        game[hsField] = game.score;
        localStorage.setItem(hsKey, game[hsField]);
    }

    const hs = game[hsField];
    document.getElementById('goStats').innerHTML = `
        <div>Score: <strong>${game.score.toLocaleString()}</strong></div>
        <div>Rounds: <strong>${game.round - 1}</strong></div>
        <div>${penLabel}: <strong>${penValue}</strong></div>
        ${game.score >= hs && hs > 0
            ? '<div style="color:#f5a623;font-weight:700;">🏆 New High Score!</div>'
            : `<div>Best: ${hs.toLocaleString()}</div>`}
    `;
    document.getElementById('gameOverOverlay').classList.remove('hidden');
    game.state = STATE.ARCADE_MENU;

    // Submit score to global leaderboard
    const initialsInput = document.getElementById('playerInitials');
    let initials = initialsInput ? initialsInput.value.trim() : '';
    if (!initials) initials = localStorage.getItem('dredge_initials') || 'AAA';

    // Save initials for next time
    if (initialsInput) localStorage.setItem('dredge_initials', initials);

    await submitScore(game.activeGame, initials, game.score);
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
        if (key === 'LOADING' && game.levelLoading) { if (dt > 0) game.levelLoading.update(dt); game.levelLoading.draw(); game.hud.drawLoadingHUD(); }
        else if (key === 'DISPOSING' && game.levelDisposal) { if (dt > 0) game.levelDisposal.update(dt); game.levelDisposal.draw(); game.hud.drawDisposalHUD(); }
    } else if (ag === 'clamshell') {
        if (key === 'DIGGING' && game.levelDigging) { if (dt > 0) game.levelDigging.update(dt); game.levelDigging.draw(); game.hud.drawDiggingHUD(); }
        else if (key === 'TRANSPORTING' && game.levelTransport) { if (dt > 0) game.levelTransport.update(dt); game.levelTransport.draw(); game.hud.drawTransportHUD(); }
    } else if (ag === 'cutter') {
        if (key === 'CUTTING' && game.levelCutting) {
            if (dt > 0) game.levelCutting.update(dt);
            game.levelCutting.draw();
            game.hud.drawCuttingHUD(
                game.levelCutting.pumpPressure,
                game.levelCutting.ladderDepth,
                game.levelCutting.cavitations,
                3,
                game.levelCutting.overpressureTime,
                5.0,   // CAV_OVERPRESS_TIME — seconds above 100% before cavitation
            );
        }
    }
}

function resetLevel(key, ag) {
    if (ag === 'hopper') {
        if (key === 'LOADING' && game.levelLoading) game.levelLoading.reset();
        if (key === 'DISPOSING' && game.levelDisposal) game.levelDisposal.reset();
    } else if (ag === 'clamshell') {
        if (key === 'DIGGING' && game.levelDigging) game.levelDigging.reset();
        if (key === 'TRANSPORTING' && game.levelTransport) game.levelTransport.reset();
    } else if (ag === 'cutter') {
        if (key === 'CUTTING' && game.levelCutting) game.levelCutting.reset();
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
async function updateLeaderboardDisplay(whichGame) {
    if (!whichGame) return;
    const tbody = document.getElementById(`${whichGame}LeaderboardBody`);
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#2ab8e0;">Loading...</td></tr>';

    const scores = await getTopScores(whichGame, 5);

    let html = '';
    scores.forEach((entry, idx) => {
        html += `
            <tr>
                <td class="rank">#${idx + 1}</td>
                <td class="initials">${entry.initials}</td>
                <td class="score">${entry.score.toLocaleString()}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ── Mobile touch controls ────────────────────────────────────────────────────
// Wire pointer events on the D-pad buttons → mutate the shared keys object.
// Only shown on devices that support touch (phones, tablets, touch laptops).

const _mcEl = document.getElementById('mobileControls');
const _mcStepEl = document.getElementById('mcStepBtns');
const _isTouch = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

function showMobileControls(which) {
    if (!_mcEl || !_isTouch()) return;
    _mcEl.style.display = 'block';
    // Step pad is cutter-exclusive
    if (_mcStepEl) _mcStepEl.style.display = which === 'cutter' ? 'flex' : 'none';
}

function hideMobileControls() {
    if (_mcEl) _mcEl.style.display = 'none';
}

// Bind pointer events once for all buttons
if (_mcEl) {
    _mcEl.querySelectorAll('.mc-btn[data-key]').forEach(btn => {
        const code = btn.dataset.key;
        // Pointer down → key held
        btn.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (Object.prototype.hasOwnProperty.call(keys, code)) keys[code] = true;
            btn.classList.add('mc-active');
            btn.setPointerCapture(e.pointerId);  // keep receiving events even if finger slides off
        });
        // Pointer up / leave / cancel → key released
        const release = e => {
            if (Object.prototype.hasOwnProperty.call(keys, code)) keys[code] = false;
            btn.classList.remove('mc-active');
        };
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        // Prevent context menu on long-press (mobile)
        btn.addEventListener('contextmenu', e => e.preventDefault());
    });
}

// ── HTML button wiring ─────────────────────────────────────────────────────
function showArcadeMenu() {
    document.getElementById('arcadeMenu').classList.add('arcade-visible');
    document.getElementById('hopperMenu').classList.add('hidden');
    document.getElementById('clamshellMenu').classList.add('hidden');
    document.getElementById('cutterMenu').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    document.getElementById('menuBtn').classList.add('hidden');
    hideMobileControls();
    game.state = STATE.ARCADE_MENU;
    game.activeGame = null;
}

function showGameMenu(which) {
    document.getElementById('arcadeMenu').classList.remove('arcade-visible');
    const menuId = which === 'hopper' ? 'hopperMenu'
        : which === 'cutter' ? 'cutterMenu' : 'clamshellMenu';
    document.getElementById(menuId).classList.remove('hidden');
    document.getElementById('menuBtn').classList.remove('hidden');
    game.activeGame = which;
    updateLeaderboardDisplay(which);

    // Save initials if entered
    const initialsInput = document.getElementById('playerInitials');
    if (initialsInput && initialsInput.value.trim() !== '') {
        localStorage.setItem('dredge_initials', initialsInput.value.trim());
    }
}

document.getElementById('selectHopper').addEventListener('click', () => showGameMenu('hopper'));
document.getElementById('selectClamshell').addEventListener('click', () => showGameMenu('clamshell'));
document.getElementById('selectCutter').addEventListener('click', () => showGameMenu('cutter'));

document.getElementById('startHopper').addEventListener('click', () => {
    document.getElementById('hopperMenu').classList.add('hidden');
    showMobileControls('hopper');
    initGame('hopper');
});
document.getElementById('startClamshell').addEventListener('click', () => {
    document.getElementById('clamshellMenu').classList.add('hidden');
    showMobileControls('clamshell');
    initGame('clamshell');
});
document.getElementById('startCutter').addEventListener('click', () => {
    document.getElementById('cutterMenu').classList.add('hidden');
    showMobileControls('cutter');
    initGame('cutter');
});

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOverOverlay').classList.add('hidden');
    showMobileControls(game.activeGame);
    initGame(game.activeGame);
});

document.getElementById('menuBtn').addEventListener('click', () => {
    showArcadeMenu();
});

// Start
resize();
const savedInitials = localStorage.getItem('dredge_initials');
if (savedInitials && document.getElementById('playerInitials')) {
    document.getElementById('playerInitials').value = savedInitials;
}
requestAnimationFrame(loop);
