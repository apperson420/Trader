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

function setCardClass(id, baseClass, statusClass) {
    const node = document.getElementById(id);
    if (node) {
        node.className = `${baseClass} ${statusClass || 'unknown'}`;
    }
}

function getGuidance(strategyAck, heartbeat) {
    if (!heartbeat.healthy) {
        return {
            level: 'warning',
            title: 'Start or check the bot runtime',
            detail: 'The dashboard can save strategy requests, but the bot must be running and healthy before it can apply them. Run python run.py all and check logs if needed.'
        };
    }

    if (!strategyAck.acknowledged) {
        return {
            level: 'pending',
            title: 'Wait for bot acknowledgment',
            detail: 'A paper strategy change is saved. Keep the bot running and wait for Strategy Sync to change to Applied by bot before relying on the new strategy.'
        };
    }

    return {
        level: 'ok',
        title: 'System is synchronized',
        detail: 'The bot has applied the requested paper strategy and heartbeat is healthy. You can continue monitoring or choose another paper strategy.'
    };
}

function renderGuidance(strategyAck, heartbeat) {
    const guidance = getGuidance(strategyAck, heartbeat);
    setText('operatorGuidanceTitle', guidance.title);
    setText('operatorGuidanceDetail', guidance.detail);
    setCardClass('operatorGuidance', 'guidance-card', `guidance-${guidance.level}`);
}

function renderStatus(payload) {
    const state = payload.state || {};
    const runtime = payload.runtime || state.runtime || {};
    const risk = payload.risk || {};
    const strategy = payload.strategy || state.strategy || 'auto';
    const heartbeat = payload.heartbeat || {
        healthy: false,
        label: 'No heartbeat yet',
        detail: 'Start the runtime with python run.py all.',
        status: 'not_started',
        age_seconds: null
    };
    const strategyAck = payload.strategy_ack || {
        acknowledged: false,
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
    setText('botRunning', yesNo(runtime.bot_running));
    setText('botStrategy', titleCaseStrategy(runtime.bot_strategy || 'auto'));
    setText('botHeartbeat', runtime.last_heartbeat_at || 'not started');
    setText('heartbeatStatus', heartbeat.label || 'Unknown');
    setText('heartbeatLabel', heartbeat.label || 'Unknown');
    setText('heartbeatDetail', heartbeat.detail || 'Heartbeat status is unavailable.');
    setText('heartbeatAge', formatAge(heartbeat.age_seconds));
    setText('maxRisk', `${risk.max_risk_per_trade_percent || 1}%`);
    setText('maxRiskInline', `${risk.max_risk_per_trade_percent || 1}%`);
    setText('strategyAckStatus', strategyAck.label || 'Unknown');
    setText('strategyAckLabel', strategyAck.label || 'Unknown');
    setText('strategyAckDetail', strategyAck.detail || 'Strategy acknowledgement status is unavailable.');
    setText('requestedStrategy', titleCaseStrategy(strategyAck.requested_strategy || strategy));
    setText('appliedStrategy', titleCaseStrategy(strategyAck.applied_strategy || 'none'));

    setCardClass('strategyAckCard', 'status-chip', strategyAck.status || 'unknown');
    setCardClass('heartbeatCard', 'status-chip', `heartbeat-${heartbeat.status || 'unknown'}`);
    setCardClass('riskCard', 'status-chip', 'risk-paper');
    renderGuidance(strategyAck, heartbeat);

    document.querySelectorAll('[data-strategy]').forEach(button => {
        const isActive = button.dataset.strategy === strategy;
        button.classList.toggle('active', isActive);
        button.disabled = false;
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        const stateNode = button.querySelector('.strategy-button-state');
        if (stateNode) {
            stateNode.textContent = isActive ? 'Active' : 'Switch';
        }
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

async function askAssistant(message) {
    const responseNode = document.getElementById('assistantResponse');
    const sendButton = document.getElementById('assistantSend');
    if (!responseNode || !sendButton) return;

    responseNode.textContent = 'Thinking through the safe dashboard context...';
    responseNode.className = 'assistant-response pending';
    sendButton.disabled = true;

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const result = await response.json();
        responseNode.textContent = result.response || 'No assistant response returned.';
        responseNode.className = result.blocked ? 'assistant-response blocked' : 'assistant-response success';
    } catch (error) {
        responseNode.textContent = `Assistant error: ${error.message}`;
        responseNode.className = 'assistant-response error';
    } finally {
        sendButton.disabled = false;
    }
}

function connectAssistantChat() {
    const form = document.getElementById('assistantForm');
    const input = document.getElementById('assistantInput');
    if (!form || !input) return;

    form.addEventListener('submit', event => {
        event.preventDefault();
        const message = input.value.trim();
        if (!message) {
            setText('assistantResponse', 'Type a question about dashboard status, strategy sync, heartbeat, or Paper Safe mode.');
            return;
        }
        askAssistant(message);
        input.value = '';
    });
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

connectAssistantChat();
connectEvents();
