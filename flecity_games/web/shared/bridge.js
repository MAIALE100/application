window.FlecityBridge = {
    async call(action, payload) {
        if (typeof GetParentResourceName !== 'function') {
            return {ok:false,error:'NUI_UNAVAILABLE'};
        }
        try {
            const response = await fetch('https://' + GetParentResourceName() + '/flecityGames:callback', {
                method: 'POST',
                headers: {'Content-Type':'application/json; charset=UTF-8'},
                body: JSON.stringify({action:action,payload:payload || {}})
            });
            return await response.json();
        } catch (error) {
            return {ok:false,error:'NUI_REQUEST_FAILED'};
        }
    }
};
