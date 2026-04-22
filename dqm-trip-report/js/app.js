/**
 * app.js
 * Main Orchestration Layer for the DQM Trip Report Generator.
 * Coordinates between UI tabs, file loading, and state persistence.
 */

/**
 * Displays a non-blocking toast notification in the top-right corner.
 * @param {string} message - Text to show.
 * @param {string} type    - 'success' | 'error' | 'warning'
 * @param {number} duration - Auto-dismiss after this many ms (default 3500).
 */
function showToast(message, type = 'success', duration = 3500) {
    // Reuse an existing container or create one
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = [
            'position:fixed', 'top:1rem', 'right:1rem', 'z-index:9999',
            'display:flex', 'flex-direction:column', 'gap:0.5rem',
            'pointer-events:none'
        ].join(';');
        document.body.appendChild(container);
    }

    const colors = {
        success: { bg: '#1a7a4a', border: '#22c55e' },
        error:   { bg: '#7a1a1a', border: '#ef4444' },
        warning: { bg: '#7a5a1a', border: '#f59e0b' }
    };
    const c = colors[type] || colors.success;

    const toast = document.createElement('div');
    toast.style.cssText = [
        `background:${c.bg}`,
        `border-left:4px solid ${c.border}`,
        'color:#fff', 'padding:0.65rem 1rem',
        'border-radius:6px', 'font-size:0.9rem',
        'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
        'opacity:0', 'transform:translateX(20px)',
        'transition:opacity 0.2s ease, transform 0.2s ease',
        'pointer-events:auto'
    ].join(';');
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });
    });

    // Auto-dismiss
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Component Initialization
    if (typeof initTabs === 'function') initTabs();
    if (typeof initFileLoader === 'function') initFileLoader();
    if (typeof initMetaForm === 'function') initMetaForm();

    // Inject version
    const versionEl = document.getElementById('app-version');
    if (versionEl && typeof APP_VERSION !== 'undefined') versionEl.textContent = `v${APP_VERSION}`;

    // 2. Global Tool-bar Event Listeners

    /**
     * Save & Download Draft.
     * Writes to localStorage (silent auto-save) AND downloads a portable .json file.
     */
    const saveBtn = document.getElementById('save-draft-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (!window.appState.sourceJson) {
                showToast('Nothing to save — load a QA file first.', 'warning');
                return;
            }
            if (typeof saveDraft     === 'function') saveDraft();
            if (typeof downloadDraft === 'function') downloadDraft();
            showToast('Draft saved & downloaded!', 'success');
        });
    }

    /**
     * Handle Session Reset.
     */
    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data and start over?')) {
                if (typeof clearState === 'function') clearState();
                location.reload();
            }
        });
    }

    /**
     * Handle Report Generation / Printing.
     */
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (typeof renderReport === 'function') renderReport();
            window.print();
        });
    }

    // 3. Automated State Restoration from localStorage
    if (typeof loadDraft === 'function') {
        const restored = loadDraft();
        if (restored && window.appState.sourceJson) {
            console.log("Found existing draft, populating UI...");
            if (typeof updateLoadSummaryUI === 'function') updateLoadSummaryUI();
            if (typeof initMetaForm        === 'function') initMetaForm();
            if (typeof renderDataCheck     === 'function') renderDataCheck();
        }
    }
});

