// js/engine.js — Main game loop, state machine, input handling

import { LevelLoading } from './level-loading.js';
import { LevelDisposal } from './level-disposal.js';
import { HUD } from './hud.js';
import { Scoring } from './scoring.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── State ──────────────────────────────────────────────────────────────────
export const STATE = {
  MENU: 'MENU',
  LOADING: 'LOADING',      // Level 1: side-scroll dredging
  DISPOSING: 'DISPOSING',  // Level 2: top-down disposal
  TRANSITION: 'TRANSITION',
};

export const game = {
  state: STATE.MENU,
  prevState: null,
  width: 0,
  height: 0,
  hopperFill: 0,        // 0–1  (fraction of hopper capacity)
  hopperMax: 1,
  score: 0,
  round: 1,
  turtlePenalties: 0,
  highScore: parseInt(localStorage.getItem('dredge_hs') || '0'),

  // transition fade
  fadeAlpha: 0,
  fadeDir: 0,           // 1 = fade out, -1 = fade in
  fadeCallback: null,

  // shared references
  scoring: null,
  hud: null,
  levelLoading: null,
  levelDisposal: null,
};

// ── Input ──────────────────────────────────────────────────────────────────
export const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

window.addEventListener('keydown', e => {
  if (keys.hasOwnProperty(e.code)) { keys[e.code] = true; e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  if (keys.hasOwnProperty(e.code)) { keys[e.code] = false; }
});

// ── Resize ─────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.width = canvas.width;
  game.height = canvas.height;
  if (game.levelLoading) game.levelLoading.onResize();
  if (game.levelDisposal) game.levelDisposal.onResize();
}
window.addEventListener('resize', resize);

// ── Game Init ──────────────────────────────────────────────────────────────
function initGame() {
  game.score = 0;
  game.round = 1;
  game.hopperFill = 0;
  game.turtlePenalties = 0;

  game.scoring = new Scoring(game);
  game.hud = new HUD(ctx, game);
  game.levelLoading = new LevelLoading(ctx, canvas, game, keys);
  game.levelDisposal = new LevelDisposal(ctx, canvas, game, keys);

  startFade(STATE.LOADING);
}

// ── Fade transition ─────────────────────────────────────────────────────────
function startFade(nextState) {
  game.fadeAlpha = 0;
  game.fadeDir = 1;           // 1 = fade to black, -1 = fade in
  game.transitionFrom = game.state;  // level to draw during fade-out
  game.transitionTo = nextState;     // level to draw during fade-in
  game.state = STATE.TRANSITION;
}

export function transitionToDisposal() { startFade(STATE.DISPOSING); }
export function transitionToLoading() {
  game.round++;
  startFade(STATE.LOADING);
}


// ── Main Loop ──────────────────────────────────────────────────────────────
let lastTime = 0;

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // seconds, capped at 50ms
  lastTime = timestamp;

  ctx.clearRect(0, 0, game.width, game.height);

  switch (game.state) {
    case STATE.LOADING:
      game.levelLoading.update(dt);
      game.levelLoading.draw();
      game.hud.drawLoadingHUD();
      break;

    case STATE.DISPOSING:
      game.levelDisposal.update(dt);
      game.levelDisposal.draw();
      game.hud.drawDisposalHUD();
      break;

    case STATE.TRANSITION:
      // Draw the correct level underneath based on fade direction
      {
        const drawState = game.fadeDir === 1 ? game.transitionFrom : game.transitionTo;
        if (drawState === STATE.LOADING && game.levelLoading) { game.levelLoading.draw(); game.hud.drawLoadingHUD(); }
        else if (drawState === STATE.DISPOSING && game.levelDisposal) { game.levelDisposal.draw(); game.hud.drawDisposalHUD(); }
      }
      // Advance fade
      game.fadeAlpha += game.fadeDir * dt * 2.5;
      if (game.fadeDir === 1 && game.fadeAlpha >= 1) {
        // Fully black — swap levels
        game.fadeAlpha = 1;
        game.fadeDir = -1;
        if (game.transitionTo === STATE.LOADING) game.levelLoading.reset();
        if (game.transitionTo === STATE.DISPOSING) game.levelDisposal.reset();
      }
      if (game.fadeDir === -1 && game.fadeAlpha <= 0) {
        // Fully revealed — exit transition
        game.fadeAlpha = 0;
        game.state = game.transitionTo;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, game.fadeAlpha));
      ctx.fillStyle = '#041020';
      ctx.fillRect(0, 0, game.width, game.height);
      ctx.restore();
      break;

    case STATE.MENU:
    default:
      drawMenuBackground(dt);
      break;
  }

  requestAnimationFrame(loop);
}

// ── Menu background animation ───────────────────────────────────────────────
let menuWaveOffset = 0;
function drawMenuBackground(dt) {
  menuWaveOffset += dt * 60;
  const W = game.width, H = game.height;
  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  skyGrad.addColorStop(0, '#0a1628');
  skyGrad.addColorStop(1, '#0d3060');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);
  // Ocean
  const seaGrad = ctx.createLinearGradient(0, H * 0.45, 0, H);
  seaGrad.addColorStop(0, '#0b4d8a');
  seaGrad.addColorStop(1, '#041a36');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);
  // Wave lines
  ctx.strokeStyle = 'rgba(42,184,224,0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const y = H * 0.45 + i * 40;
    for (let x = 0; x <= W; x += 4) {
      const offset = Math.sin((x / W) * Math.PI * 6 + menuWaveOffset * 0.05 + i) * 6;
      if (x === 0) ctx.moveTo(x, y + offset);
      else ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }
}

// ── Startup ─────────────────────────────────────────────────────────────────
resize();

// Update high score display
function updateHighScoreDisplay() {
  const el = document.getElementById('highScoreDisplay');
  if (el) el.textContent = game.highScore > 0 ? `Best: ${game.highScore.toLocaleString()} pts` : '';
}

// Button handlers
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('menuOverlay').classList.add('hidden');
  initGame();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOverOverlay').classList.add('hidden');
  initGame();
});

export function showGameOver() {
  if (game.score > game.highScore) {
    game.highScore = game.score;
    localStorage.setItem('dredge_hs', game.highScore);
  }
  const stats = document.getElementById('goStats');
  stats.innerHTML = `
    <div>Score: <strong>${game.score.toLocaleString()}</strong></div>
    <div>Rounds completed: <strong>${game.round - 1}</strong></div>
    <div>Turtle penalties: <strong>${game.turtlePenalties}</strong></div>
    ${game.score >= game.highScore ? '<div style="color:#f5a623;font-weight:700;">🏆 New High Score!</div>' : `<div>Best: ${game.highScore.toLocaleString()}</div>`}
  `;
  updateHighScoreDisplay();
  document.getElementById('gameOverOverlay').classList.remove('hidden');
  game.state = STATE.MENU;
}

updateHighScoreDisplay();
requestAnimationFrame(loop);
