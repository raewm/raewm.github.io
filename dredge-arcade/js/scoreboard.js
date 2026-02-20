// js/scoreboard.js
// Handles online high score fetching and submission using the Dreamlo API

// To isolate the 3 games on a single Dreamlo instance, we will use a prefix
// for the player's initials (e.g. "H_AAA" for Hopper, "C_AAA" for Clamshell, "S_AAA" for Cutter/Suction).

const DREAMLO_PUBLIC_KEY = '699880fa8f40bb1a147ab3cd';
const DREAMLO_PRIVATE_KEY = 'eYp6syOVbU2uvUkKMJLUFwg_4Drtlhlk-sxOd6PRElaQ';
const BASE_URL = 'http://dreamlo.com/lb/';

/**
 * Prefix map to differentiate games on the same Dreamlo board
 */
const GAME_PREFIXES = {
    'hopper': 'H_',
    'clamshell': 'C_',
    'cutter': 'S_'
};

/**
 * Submits a new score to Dreamlo
 * @param {string} game - 'hopper', 'clamshell', or 'cutter'
 * @param {string} initials - User initials (e.g., 'AAA')
 * @param {number} score - The score achieved
 */
export async function submitScore(game, initials, score) {
    if (!initials) initials = "---";
    initials = initials.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3);
    if (initials === "") initials = "---";

    const prefix = GAME_PREFIXES[game] || 'X_';
    const playerName = `${prefix}${initials}`;

    // We append a random salt to the name to allow the same player to have multiple 
    // scores if they tie or just to ensure uniqueness on Dreamlo's name-based keying,
    // actually dreamlo uses the name as the primary key. If we want the same initials to 
    // occupy multiple slots, we'd need a random suffix. But normally arcade boards keep your *best* score.
    // Dreamlo natively keeps the highest score for a given name. This is perfect for an arcade!

    const targetUrl = `${BASE_URL}${DREAMLO_PRIVATE_KEY}/add/${playerName}/${score}`;
    const url = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        await fetch(url);
    } catch (err) {
        console.error("Failed to submit score to Dreamlo", err);
    }
}

/**
 * Fetches the top scores for a specific game
 * @param {string} game - 'hopper', 'clamshell', or 'cutter'
 * @param {number} limit - Number of top scores to return
 * @returns {Promise<Array<{initials: string, score: number}>>}
 */
export async function getTopScores(game, limit = 5) {
    const prefix = GAME_PREFIXES[game] || 'X_';
    const targetUrl = `${BASE_URL}${DREAMLO_PUBLIC_KEY}/json`;
    const url = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        let scores = [];
        // Dreamlo returns an object or array depending on count
        if (data && data.dreamlo && data.dreamlo.leaderboard && data.dreamlo.leaderboard.entry) {
            let entries = data.dreamlo.leaderboard.entry;
            if (!Array.isArray(entries)) {
                entries = [entries];
            }

            scores = entries
                .filter(entry => entry.name.startsWith(prefix))
                .map(entry => ({
                    initials: entry.name.replace(prefix, ''),
                    score: parseInt(entry.score, 10)
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        }

        // Fill empty spots
        while (scores.length < limit) {
            scores.push({ initials: '---', score: 0 });
        }

        return scores;

    } catch (err) {
        console.error("Failed to fetch scores from Dreamlo", err);
        // Return blank array on failure
        return Array(limit).fill({ initials: '---', score: 0 });
    }
}
