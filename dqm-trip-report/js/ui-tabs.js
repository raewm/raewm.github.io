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

    // Template buttons
    const templates = {
        'hopper': "RPS Evans-Hamilton personnel met Great Lakes Personnel in [Location] on the morning of [Date]. The team boarded a crew boat and proceeded to the hopper dredge [Dredge Name] to conduct the QA check in order to renew the annual DQM certification. Once onboard the dredge the loaded draft check was completed by comparing the readings within the OBS to a visual observation of the water level at the physical draft markings on the hull at the forward and aft ends of the dredge...",
        'scow': "Personnel proceeded to the tug/scow to conduct the annual QA check. The positional checks were performed by comparing a handheld GPS against the onboard system. Dynamic tracking checks were performed during transit to the disposal area. Drafts and ullages were recorded when light and loaded.",
        'pipeline': "Personnel proceeded to the pipeline dredge to conduct the annual QA check. Position was verified with a handheld GPS. Suction mouth depth was verified across a range of depths covering the operating parameters. Velocity was checked by injecting water or running a clear water test line.",
        'mechanical': "Personnel proceeded to the mechanical dredge to conduct the annual QA check. Position was verified with a handheld GPS. The bucket depth and bucket position were checked at multiple locations across the typical digging radius."
    };

    document.querySelectorAll('[id^=btn-template-]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.id.replace('btn-template-', '');
            if (templates[type]) {
                const input = document.getElementById('meta-methods');
                input.value = templates[type];
                window.appState.meta.methods = templates[type];
                saveDraft();
            }
        });
    });
}
