// js/scoring.js — Scoring logic for clamshell dredge game

export class Scoring {
    constructor(game) {
        this.game = game;
        this._loadStart = 0;
        this._bites = 0;
    }

    startDigging() {
        this._loadStart = performance.now() / 1000;
        this._bites = 0;
    }

    // Called each time a full bite is grabbed and dumped
    onBite() {
        this._bites++;
        const pts = 40;
        this.game.score += pts;
        return pts;
    }

    finishDigging() {
        const elapsed = performance.now() / 1000 - this._loadStart;
        // Time bonus: faster fill → more points (max 500 for ≤45s, scaling down)
        const bonus = Math.max(0, Math.round(500 - elapsed * 5));
        this.game.score += bonus;
        return bonus;
    }

    startTransport() {
        this._transportStart = performance.now() / 1000;
    }

    // Called when dump is complete
    finishTransport() {
        const elapsed = performance.now() / 1000 - this._transportStart;
        const bonus = Math.max(0, Math.round(300 - elapsed * 4));
        this.game.score += bonus;
        return bonus;
    }

    applyPilingPenalty() {
        const penalty = 150;
        this.game.score = Math.max(0, this.game.score - penalty);
        this.game.penalties++;
        return penalty;
    }
}
