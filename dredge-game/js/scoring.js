// js/scoring.js — Score tracking and calculation

export class Scoring {
    constructor(game) {
        this.game = game;
        this.loadingStartTime = null;
        this.disposalStartTime = null;
        this.materialLoadedThisRound = 0;
    }

    startLoading() {
        this.loadingStartTime = performance.now() / 1000;
        this.materialLoadedThisRound = 0;
    }

    // Called continuously during loading — accumulate material delta
    onMaterialLoaded(delta) {
        this.materialLoadedThisRound += delta;
    }

    finishLoading() {
        if (!this.loadingStartTime) return 0;
        const elapsed = performance.now() / 1000 - this.loadingStartTime;
        // Loading rate score: more material per second = higher pts
        // Base: 1000 pts per full load + bonus for speed
        const rate = this.materialLoadedThisRound / Math.max(elapsed, 1);
        const rateBonus = Math.floor(rate * 2000);
        const pts = 1000 + rateBonus;
        this.game.score += pts;
        this.loadingStartTime = null;
        return pts;
    }

    startDisposal() {
        this.disposalStartTime = performance.now() / 1000;
    }

    finishDisposal() {
        if (!this.disposalStartTime) return 0;
        const elapsed = performance.now() / 1000 - this.disposalStartTime;
        // Disposal time bonus: faster = better. Max 1500 pts at 30s, scales down
        const timeBonus = Math.max(0, Math.floor(1500 - elapsed * 12));
        const pts = 500 + timeBonus;
        this.game.score += pts;
        this.disposalStartTime = null;
        return pts;
    }

    applyTurtlePenalty() {
        const penalty = 300;
        this.game.score = Math.max(0, this.game.score - penalty);
        this.game.turtlePenalties++;
        return penalty;
    }
}
