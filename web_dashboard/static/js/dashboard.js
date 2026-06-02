function titleCaseStrategy(strategy) {
    return String(strategy || 'auto')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
        node.textContent = value;
    }
}

function yesNo(value) {
    return value ? 'Yes' : 'No';
}

function renderStatus(payload) {
    const state = payload.state || {};
    const runtime = payload.runtime || state.runtime || {};
    const risk = payload.risk || {};
    const strategy = payload.strategy || state.strategy || 'auto';

    setText('activeStrategy', titleCaseStrategy(strategy));
    setText('runtimeStatus', payload.status || state.status || 'ready');
    setText('runtimeMessage', payload.message || state.message || 'Dashboard ready.');
    setText('stateVersion', state.version ?? '1');
    setText('lastUpdated', state.updated_at || 'not switched yet');
    setText('updatedBy', state.updated_by || 'system');
    setText('previousStrategy', titleCaseStrategy(state.previous_strategy || 'none'));
    setText('paperMode', risk.mode || state.mode || 'paper');
    setText('botRunning', yesNo(runtime.bot_running));
    setText('botStrategy', titleCaseStrategy(runtime.bot_strategy || 'auto'));
    setText('botHeartbeat', runtime.last_heartbeat_at || 'not started');
    setText('maxRisk', `${risk.max_risk_per_trade_percent || 1}%`);

    document.querySelectorAll('[data-strategy]').forEach(button => {
        button.classList.toggle('active', button.dataset.strategy === strategy);
        button.disabled = false;
    });
}

async function switchStrategy(strategy) {
    const resultBox = document.getElementById('switchResult');
    document.querySelectorAll('[data-strategy]').forEach(button => {
        button.disabled = true;
    });

    if (resultBox) {
        resultBox.textContent = `Requesting strategy switch to ${titleCaseStrategy(strategy)}...`;
        resultBox.className = 'result-box pending';
    }

    try {
        const response = await fetch('/api/switch-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strategy })
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
            throw new Error(result.error || 'Unknown strategy switch failure');
        }

        renderStatus({
            strategy: result.new_strategy,
            state: result.state,
            runtime: result.runtime,
            status: result.state.status,
            message: result.message,
            risk: { mode: result.state.mode || 'paper', max_risk_per_trade_percent: 1 }
        });

        if (resultBox) {
            resultBox.textContent = result.message;
            resultBox.className = 'result-box success';
        }
    } catch (error) {
        if (resultBox) {
            resultBox.textContent = `Failed to switch strategy: ${error.message}`;
            resultBox.className = 'result-box error';
        }
        document.querySelectorAll('[data-strategy]').forEach(button => {
            button.disabled = false;
        });
    }
}

function connectEvents() {
    const statusNode = document.getElementById('sseStatus');

    if (!window.EventSource) {
        if (statusNode) statusNode.textContent = 'unsupported';
        return;
    }

    const source = new EventSource('/events');

    source.addEventListener('open', () => {
        if (statusNode) statusNode.textContent = 'connected';
    });

    source.addEventListener('status', event => {
        try {
            renderStatus(JSON.parse(event.data));
        } catch (error) {
            if (statusNode) statusNode.textContent = 'bad update';
        }
    });

    source.addEventListener('error', () => {
        if (statusNode) statusNode.textContent = 'reconnecting';
    });
}

connectEvents();
