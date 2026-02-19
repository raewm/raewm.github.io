// js/cutter/scoring.js — Scoring for the Cutter Suction Dredge game

const SCORE_PER_CELL = { 1: 10, 2: 15, 3: 25, 4: 60 }; // by cell type (SILT/SAND/CLAY/ROCK)
const CAVITATION_PENALTY = 350;
const STEP_BONUS_MAX = 600;
const ROUND_COMPLETION_BONUS = 1200;

export class Scoring {
    constructor(game) {
        this.game = game;
    }

    startCutting() {
        this._cellsCut = 0;
    }

    onCellCut(cellType) {
        const pts = SCORE_PER_CELL[cellType] ?? 10;
        this.game.score += pts;
        this._cellsCut++;
        return pts;
    }

    onStep(coverage) {
        // coverage = 0..1 fraction of reachable cells that were fully cut
        const bonus = Math.floor(STEP_BONUS_MAX * coverage * coverage);
        this.game.score += bonus;
        return bonus;
    }

    applyCavitationPenalty() {
        this.game.score = Math.max(0, this.game.score - CAVITATION_PENALTY);
        this.game.penalties++;
        return CAVITATION_PENALTY;
    }

    finishRound() {
        const bonus = ROUND_COMPLETION_BONUS + this._cellsCut * 3;
        this.game.score += bonus;
        return bonus;
    }
}
