// ui-tabs.js
// Handles tab navigation and form binding to state

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const nextBtns = document.querySelectorAll('.next-tab-btn');

    // Tab clicks
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            switchTab(targetId);
        });
    });

    // Next buttons inside panels
    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-next');
            switchTab(targetId);
        });
    });

    function switchTab(targetId) {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        const targetBtn = document.querySelector(`.tab-btn[data-tab="${targetId}"]`);
        const targetPane = document.getElementById(targetId);

        if (targetBtn) targetBtn.classList.add('active');
        if (targetPane) targetPane.classList.add('active');

        // On specific tab activations, run logic
        if (targetId === 'edit-tab') {
            if (typeof renderEditor === 'function') renderEditor();
        } else if (targetId === 'preview-tab') {
            if (typeof renderReport === 'function') renderReport();
        }
    }
}

// Bind metadata form fields to state
function initMetaForm() {
    const fields = [
        'reportDate', 'preparedBy', 'district', 'operator',
        'location', 'weather', 'discrepancies', 'methods'
    ];

    fields.forEach(field => {
        const input = document.getElementById(`meta-${field.toLowerCase()}`);
        if (input) {
            // Populate form from state
            input.value = window.appState.meta[field] || '';

            // Listen for changes
            input.addEventListener('input', (e) => {
                window.appState.meta[field] = e.target.value;
                if (typeof saveDraft === 'function') saveDraft();
            });
        }
    });

    document.querySelectorAll('[id^=btn-template-]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.id.replace('btn-template-', '');
            // Load templates from the user-editable config.js
            const templates = window.methodTemplates || {};

            if (templates[type]) {
                const input = document.getElementById('meta-methods');
                input.value = templates[type];
                window.appState.meta.methods = templates[type];

                if (typeof window.saveDraft === 'function') {
                    window.saveDraft();
                }
            }
        });
    });
}
