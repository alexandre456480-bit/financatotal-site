window.APP_DATA = {};
window._appReadyFired = false;

const originalGetItem = localStorage.getItem.bind(localStorage);
const originalSetItem = localStorage.setItem.bind(localStorage);

// Carregamento inicial do Cache Local para evitar tela branca/vazia
Object.keys(localStorage).forEach(k => {
    if (k.startsWith('db_')) {
        try { window.APP_DATA[k] = JSON.parse(originalGetItem(k)); } catch(e) {}
    }
});

// Intercepta o getItem para sempre olhar primeiro para a memória viva (APP_DATA)
localStorage.getItem = function(key) {
    if (key.startsWith('db_')) {
        if (window.APP_DATA[key]) return JSON.stringify(window.APP_DATA[key]);
        const local = originalGetItem(key);
        return local ? local : "[]";
    }
    return originalGetItem(key);
};

// Intercepta o setItem para salvar local e na nuvem simultaneamente
localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    if (key.startsWith('db_')) {
        try { window.APP_DATA[key] = JSON.parse(value); } catch(e){}
        if (window.syncDataToBackend) window.syncDataToBackend(key, window.APP_DATA[key]);
    }
};

window.syncDataToBackend = function(key, data) {
    const token = originalGetItem('auth_token');
    if (!token) return;
    fetch(`http://localhost:3001/api/data/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
    }).catch(err => console.error("Sync error:", err));
};

(async function initAuth() {
    const token = originalGetItem('auth_token');
    const isLoginPage = window.location.pathname.endsWith('login.html');

    if (!token && !isLoginPage) {
        window.location.href = 'login.html';
        return;
    }

    if (token) {
        // Atualiza a Identidade Visual de forma segura (aguardando o DOM)
        const updateUI = () => {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const usernameRaw = payload.username || 'Usuário';
                const formattedName = usernameRaw.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                
                const nameNode = document.querySelector('.user-name');
                if (nameNode) nameNode.textContent = formattedName;
                
                const avatarImg = document.querySelector('.user-avatar img');
                if (avatarImg) {
                    const colors = ['7C6BFF', '00F0FF', 'FF5555', 'FFAA00', '10B981'];
                    const hexColor = colors[usernameRaw.length % colors.length];
                    avatarImg.src = `https://ui-avatars.com/api/?name=${formattedName}&background=${hexColor}&color=fff&rounded=true&bold=true`;
                }
            } catch (e) { console.error("UI Auth Error:", e); }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', updateUI);
        } else {
            updateUI();
        }

        try {
            const res = await fetch('http://localhost:3001/api/data', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
                return;
            }
            const data = await res.json();
            
            // 1. Limpa TOTALMENTE o cache das variáveis "db_" para evitar que um novo usuário herde dados locais do usuário anterior
            Object.keys(localStorage).forEach(k => {
                if(k.startsWith('db_')) localStorage.removeItem(k);
            });

            // 2. Sincroniza a memória com a base remota recém baixada
            window.APP_DATA = data;
            Object.keys(data).forEach(k => originalSetItem(k, JSON.stringify(data[k])));
            // Restante do código offline ou de erros segue...
        } catch (err) {
            console.warn("Trabalhando em modo Offline (Cache Local)");
        }
    }
    
    // Libera o Dashboard
    document.dispatchEvent(new Event('AppReady'));
    window._appReadyFired = true;
})();

const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'AppReady' && window._appReadyFired) {
        setTimeout(listener, 1);
    }
    return originalAddEventListener.call(this, type, listener, options);
};
