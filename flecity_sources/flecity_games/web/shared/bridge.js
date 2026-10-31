function nuiDeadline(invoke, cancel) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            const error = new Error('NUI_REQUEST_TIMEOUT');
            error.code = 'NUI_REQUEST_TIMEOUT';
            reject(error);
            if (cancel) cancel();
        }, 12000);
        Promise.resolve().then(invoke).then(resolve, reject).finally(() => clearTimeout(timer));
    });
}

// Bounded, local-only diagnostics. Never retain request payloads, room codes or player IDs.
const flecityDiagnostics = [];
function noteDiagnostic(event, fields = {}) {
    flecityDiagnostics.push({at:new Date().toISOString(),event,...fields});
    if (flecityDiagnostics.length > 64) flecityDiagnostics.shift();
}
window.FlecityDiagnostics = {note:noteDiagnostic,snapshot:()=>flecityDiagnostics.map(row=>({...row}))};

function hasPhoneFetchNui() {
    return typeof fetchNui === 'function' || typeof globalThis.fetchNui === 'function';
}

async function invokePhoneFetchNui(eventName, data) {
    if (typeof fetchNui === 'function') return await fetchNui(eventName, data);
    if (typeof globalThis.fetchNui === 'function') return await globalThis.fetchNui(eventName, data);
    throw new Error('fetchNui unavailable');
}

async function waitForPhoneBridge(timeoutMs = 5000) {
    if (hasPhoneFetchNui()) return true;

    const started = performance.now();
    return await new Promise((resolve) => {
        let finished = false;

        const finish = (value) => {
            if (finished) return;
            finished = true;
            window.removeEventListener('message', onMessage);
            resolve(value);
        };

        const onMessage = (event) => {
            if (event.data === 'componentsLoaded' || hasPhoneFetchNui()) {
                if (hasPhoneFetchNui()) return finish(true);
            }
        };

        window.addEventListener('message', onMessage);

        const poll = () => {
            if (hasPhoneFetchNui()) return finish(true);
            if (performance.now() - started >= timeoutMs) return finish(false);
            setTimeout(poll, 50);
        };

        poll();
    });
}

async function callPhoneNui(request) {
    const ready = await waitForPhoneBridge();
    if (!ready || !hasPhoneFetchNui()) {
        return {ok:false,error:'NUI_UNAVAILABLE'};
    }

    // A failed acknowledgement does not prove that a mutation was rejected.
    // Never replay it automatically: the server may already have accepted it.
    try {
        const response = await nuiDeadline(() => invokePhoneFetchNui('flecityGames:callback', request));
        return response || {ok:false,error:'EMPTY_RESPONSE'};
    } catch (error) {
        return {ok:false,error:error.code === 'NUI_REQUEST_TIMEOUT' ? error.code : 'NUI_REQUEST_FAILED'};
    }
}

window.FlecityBridge = {
    async call(action, payload) {
        const screen=window.FlecityScreen,control=/^(screen|localDiagnostics)/.test(action);
        if(screen?.parked&&!control)return {ok:false,error:'APP_SUSPENDED'};
        if(screen&&!control)screen.begin();
        try { return await this.invoke(action,payload); }
        finally { if(screen&&!control)screen.end(); }
    },
    async invoke(action, payload) {
        const screen=window.FlecityScreen;
        const request = {action: action, payload: payload || {},surface:screen?.surface||'phone',lease:screen?.lease||''};
        const started = performance.now();
        const finish = response => {
            if (!response?.ok) {
                const safeAction = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(String(action)) ? String(action) : 'UNCLASSIFIED_ACTION';
                const code = String(response?.error || 'EMPTY_RESPONSE');
                const safeError = /^[A-Z][A-Z0-9_]{0,47}$/.test(code) ? code : 'UNCLASSIFIED_ERROR';
                noteDiagnostic('callback', {action:safeAction,error:safeError,elapsedMs:Math.max(0,Math.round(performance.now()-started))});
            }
            return response;
        };

        // LB Phone injects fetchNui into the custom-app iframe. Wait briefly for
        // the componentsLoaded handshake so resource restarts do not require the
        // user to close/reopen the phone.
        if (screen?.surface!=='expanded' && (hasPhoneFetchNui() || typeof window.invokeNative !== 'undefined')) {
            const response = await callPhoneNui(request);
            if (response.error !== 'NUI_UNAVAILABLE') return finish(response);
        }

        // Direct NUI / browser-development fallback.
        const directResource=typeof GetParentResourceName==='function'?GetParentResourceName():
            screen?.expanded&&location.hostname.startsWith('cfx-nui-')?location.hostname.slice(8):null;
        if (directResource) {
            try {
                const controller = new AbortController();
                return finish(await nuiDeadline(async () => {
                    const response = await fetch('https://' + directResource + '/flecityGames:callback', {
                        method: 'POST',
                        headers: {'Content-Type':'application/json; charset=UTF-8'},
                        body: JSON.stringify(request),
                        signal: controller.signal
                    });
                    return await response.json();
                }, () => controller.abort()));
            } catch (error) {
                return finish({ok:false,error:error.code === 'NUI_REQUEST_TIMEOUT' ? error.code : 'NUI_REQUEST_FAILED'});
            }
        }

        return finish({ok:false,error:'NUI_UNAVAILABLE'});
    }
};
