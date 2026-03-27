/**
 * ui-tabs.js
 * Manages tabbed navigation and metadata form data-binding.
 * Ensures the UI state stays in sync with the global appState.
 */

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const nextBtns = document.querySelectorAll('.next-tab-btn');

    // 1. Navigation Event Listeners
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            switchTab(targetId);
        });
    });

    // Support for sequential "Next" flow within panels
    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-next');
            switchTab(targetId);
        });
    });

    /**
     * Cycles visibility of tab buttons and content panes.
     * Triggers render logic for dynamic tabs (Editor & Preview).
     * @param {string} targetId - The ID of the tab pane to activate.
     */
    function switchTab(targetId) {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        const targetBtn = document.querySelector(`.tab-btn[data-tab="${targetId}"]`);
        const targetPane = document.getElementById(targetId);

        if (targetBtn) targetBtn.classList.add('active');
        if (targetPane) targetPane.classList.add('active');

        // Dynamic State Synchronization:
        // Ensure the visual state is refreshed when moving to core logic tabs.
        if (targetId === 'edit-tab') {
            if (typeof renderEditor === 'function') renderEditor();
        } else if (targetId === 'data-check-tab') {
            if (typeof renderDataCheck === 'function') renderDataCheck();
        } else if (targetId === 'preview-tab') {
            if (typeof renderReport === 'function') renderReport();
        }
    }
}

/**
 * Binds DOM input elements in the Report Info tab to appState.meta.
 * Implements two-way data-binding (Load-to-Form and Input-to-State).
 */
function initMetaForm() {
    const fields = [
        'reportDate', 'preparedBy', 'qaTeam', 'district', 'operator',
        'location', 'weather', 'discrepancies', 'methods'
    ];

    fields.forEach(field => {
        const input = document.getElementById(`meta-${field.toLowerCase()}`);
        if (input) {
            // Rehydrate form from global state (e.g. after draft restoration)
            input.value = window.appState.meta[field] || '';

            // Update state on every keystroke/change and persist to LocalStorage.
            input.addEventListener('input', (e) => {
                window.appState.meta[field] = e.target.value;
                if (typeof saveDraft === 'function') saveDraft();
            });
        }
    });

    /**
     * Methodology Templates Handler.
     * Allows users to quickly populate standard methodology text
     * based on vessel types defined in config.js.
     */
    document.querySelectorAll('[id^=btn-template-]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.id.replace('btn-template-', '');
            // Pull templates mapped in global window scope by config.js
            const templates = window.methodTemplates || {};

            if (templates[type]) {
                const input = document.getElementById('meta-methods');
                input.value = templates[type];
                window.appState.meta.methods = templates[type];

                // Immediate save to prevent data loss before manual save click.
                if (typeof window.saveDraft === 'function') {
                    window.saveDraft();
                }
            }
        });
    });
}
