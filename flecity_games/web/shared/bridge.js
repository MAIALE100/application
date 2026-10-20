window.FlecityBridge = {
    async call(action, payload) {
        const request = {action: action, payload: payload || {}};

        // LB Phone custom apps run inside the phone's app iframe. LB Phone injects
        // fetchNui and automatically routes it to the resource that registered
        // the custom app.
        if (typeof globalThis.fetchNui === 'function') {
            try {
                const response = await globalThis.fetchNui('flecityGames:callback', request);
                return response || {ok:false,error:'EMPTY_RESPONSE'};
            } catch (error) {
                return {ok:false,error:'NUI_REQUEST_FAILED'};
            }
        }

        // Development / direct-NUI fallback.
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
