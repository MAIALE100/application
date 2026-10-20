async function waitForPhoneBridge(timeoutMs = 3000) {
    if (typeof globalThis.fetchNui === 'function') return true;

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
            if (event.data === 'componentsLoaded' || typeof globalThis.fetchNui === 'function') {
                finish(typeof globalThis.fetchNui === 'function');
            }
        };

        window.addEventListener('message', onMessage);

        const poll = () => {
            if (typeof globalThis.fetchNui === 'function') return finish(true);
            if (performance.now() - started >= timeoutMs) return finish(false);
            setTimeout(poll, 50);
        };

        poll();
    });
}

async function callPhoneNui(request) {
    const ready = await waitForPhoneBridge();
    if (!ready || typeof globalThis.fetchNui !== 'function') {
        return {ok:false,error:'NUI_UNAVAILABLE'};
    }

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await globalThis.fetchNui('flecityGames:callback', request);
            return response || {ok:false,error:'EMPTY_RESPONSE'};
        } catch (error) {
            lastError = error;
            if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    return {ok:false,error:'NUI_REQUEST_FAILED',detail:String(lastError && lastError.message || '')};
}

window.FlecityBridge = {
    async call(action, payload) {
        const request = {action: action, payload: payload || {}};

        // LB Phone injects fetchNui into the custom-app iframe. Wait briefly for
        // the componentsLoaded handshake so resource restarts do not require the
        // user to close/reopen the phone.
        if (typeof globalThis.fetchNui === 'function' || typeof window.invokeNative !== 'undefined') {
            const response = await callPhoneNui(request);
            if (response.error !== 'NUI_UNAVAILABLE') return response;
        }

        // Direct NUI / browser-development fallback.
        if (typeof GetParentResourceName === 'function') {
            try {
                const response = await fetch('https://' + GetParentResourceName() + '/flecityGames:callback', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json; charset=UTF-8'},
                    body: JSON.stringify(request)
                });
                return await response.json();
            } catch (error) {
                return {ok:false,error:'NUI_REQUEST_FAILED'};
            }
        }

        return {ok:false,error:'NUI_UNAVAILABLE'};
    }
};
