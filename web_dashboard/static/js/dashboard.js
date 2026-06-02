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

function formatAge(seconds) {
    if (seconds === null || seconds === undefined) return 'not started';
    return `${seconds}s`;
}

function updateAckBanner(strategyAck) {
    const banner = document.getElementById('strategyAckBanner');
    if (!banner) return;
    banner.className = `ack-banner ${strategyAck.status || 'unknown'}`;
}

function updateHeartbeatBanner(heartbeat) {
    const banner = document.getElementById('heartbeatBanner');
    if (!banner) return;
    banner.className = `ack-banner heartbeat-${heartbeat.status || 'unknown'}`;
}

function renderStatus(payload) {
    const state = payload.state || {};
    const runtime = payload.runtime || state.runtime || {};
    const risk = payload.risk || {};
    const strategy = payload.strategy || state.strategy || 'auto';
    const heartbeat = payload.heartbeat || {
        label: 'No heartbeat yet',
        detail: 'Start the runtime with python run.py all.',
        status: 'not_started',
        age_seconds: null
    };
    const strategyAck = payload.strategy_ack || {
        label: 'Unknown',
        detail: 'Strategy acknowledgement status is unavailable.',
        status: 'unknown',
        requested_strategy: strategy,
        applied_strategy: runtime.bot_strategy || 'none'
    };

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
    setText('heartbeatStatus', heartbeat.label || 'Unknown');
    setText('heartbeatLabel', heartbeat.label || 'Unknown');
    setText('heartbeatDetail', heartbeat.detail || 'Heartbeat status is unavailable.');
    setText('heartbeatAge', formatAge(heartbeat.age_seconds));
    setText('maxRisk', `${risk.max_risk_per_trade_percent || 1}%`);
    setText('strategyAckStatus', strategyAck.label || 'Unknown');
    setText('strategyAckLabel', strategyAck.label || 'Unknown');
    setText('strategyAckDetail', strategyAck.detail || 'Strategy acknowledgement status is unavailable.');
    setText('requestedStrategy', titleCaseStrategy(strategyAck.requested_strategy || strategy));
    setText('appliedStrategy', titleCaseStrategy(strategyAck.applied_strategy || 'none'));
    updateAckBanner(strategyAck);
    updateHeartbeatBanner(heartbeat);

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
            strategy_ack: result.strategy_ack,
            heartbeat: result.heartbeat,
            status: result.state.status,
            message: result.message,
            risk: { mode: result.state.mode || 'paper', max_risk_per_trade_percent: 1 }
        });

        if (resultBox) {
            resultBox.textContent = result.strategy_ack?.detail || result.message;
            resultBox.className = result.pending_bot_ack ? 'result-box pending' : 'result-box success';
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
