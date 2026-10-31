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
        const request = {action: action, payload: payload || {}};

        // LB Phone injects fetchNui into the custom-app iframe. Wait briefly for
        // the componentsLoaded handshake so resource restarts do not require the
        // user to close/reopen the phone.
        if (hasPhoneFetchNui() || typeof window.invokeNative !== 'undefined') {
            const response = await callPhoneNui(request);
            if (response.error !== 'NUI_UNAVAILABLE') return response;
        }

        // Direct NUI / browser-development fallback.
        if (typeof GetParentResourceName === 'function') {
            try {
                const controller = new AbortController();
                return await nuiDeadline(async () => {
                    const response = await fetch('https://' + GetParentResourceName() + '/flecityGames:callback', {
                        method: 'POST',
                        headers: {'Content-Type':'application/json; charset=UTF-8'},
                        body: JSON.stringify(request),
                        signal: controller.signal
                    });
                    return await response.json();
                }, () => controller.abort());
            } catch (error) {
                return {ok:false,error:error.code === 'NUI_REQUEST_TIMEOUT' ? error.code : 'NUI_REQUEST_FAILED'};
            }
        }

        return {ok:false,error:'NUI_UNAVAILABLE'};
    }
};
