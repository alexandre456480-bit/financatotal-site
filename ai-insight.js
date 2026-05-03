// ═══════════════════════════════════════════════════════════
// ai-insight.js — Agente IA Flutuante (v2)
// Botão mascote → Chat drawer lateral premium
// Cadastro automático por linguagem natural
// ═══════════════════════════════════════════════════════════
(function () {

    // ── DETECTAR CONTEXTO DA PÁGINA ──
    function detectPageContext() {
        const path = window.location.pathname;
        if (path.includes('investimentos')) return 'investimentos';
        if (path.includes('metas')) return 'metas';
        if (path.includes('cartoes')) return 'cartoes';
        if (path.includes('cadastro')) return 'cadastro';
        if (path.includes('dados')) return 'dados';
        return 'financeiro'; // index.html
    }

    const PAGE_INFO = {
        financeiro: { label: 'Financeiro', greeting: 'Posso analisar seu saldo, receitas e despesas. Como posso ajudar?' },
        investimentos: { label: 'Investimentos', greeting: 'Posso analisar sua carteira, rentabilidade e diversificação. O que precisa?' },
        metas: { label: 'Metas', greeting: 'Posso analisar o progresso das suas metas e projetar datas. Pergunte!' },
        cartoes: { label: 'Cartões', greeting: 'Posso analisar seus gastos com cartão, limites e parcelamentos. Pergunte!' },
        cadastro: { label: 'Cadastro', greeting: 'Posso cadastrar dados automaticamente para você! Diga algo como:\n\n• "Adicione uma despesa de R$50 de alimentação de hoje"\n• "Cadastre uma receita de R$3.000 de salário"\n• "Crie uma meta de R$10.000 para viagem"' },
        dados: { label: 'Dados', greeting: 'Posso ajudar a entender seus registros e encontrar informações. Pergunte!' }
    };

    // ── ESTADO ──
    let currentContext = detectPageContext();
    let chatHistory = [];
    let isLoading = false;
    let isOpen = false;

    // ── COLETAR DADOS POR CONTEXTO ──
    function getUserData() {
        const ctx = currentContext;
        if (ctx === 'financeiro' || ctx === 'dados') return {
            fluxo: JSON.parse(localStorage.getItem('db_fluxo') || '[]'),
            cartao: JSON.parse(localStorage.getItem('db_cartao') || '[]'),
            invest: JSON.parse(localStorage.getItem('db_invest') || '[]'),
            metas: JSON.parse(localStorage.getItem('db_metas') || '[]')
        };
        if (ctx === 'investimentos') return { invest: JSON.parse(localStorage.getItem('db_invest') || '[]') };
        if (ctx === 'metas') return { metas: JSON.parse(localStorage.getItem('db_metas') || '[]') };
        if (ctx === 'cartoes') return {
            cartao: JSON.parse(localStorage.getItem('db_cartao') || '[]'),
            config: JSON.parse(localStorage.getItem('db_cartoes_config') || '[]')
        };
        if (ctx === 'cadastro') return {
            fluxo: JSON.parse(localStorage.getItem('db_fluxo') || '[]'),
            cartao: JSON.parse(localStorage.getItem('db_cartao') || '[]'),
            invest: JSON.parse(localStorage.getItem('db_invest') || '[]'),
            metas: JSON.parse(localStorage.getItem('db_metas') || '[]')
        };
        return {};
    }

    // ── INJETAR HTML ──
    function injectUI() {
        // Botão flutuante do mascote
        const fab = document.createElement('div');
        fab.id = 'ai-fab';
        fab.innerHTML = `<img src="ia.webp" alt="Assistente IA" draggable="false"><div class="ai-fab-pulse"></div>`;
        fab.addEventListener('click', toggleChat);
        document.body.appendChild(fab);

        // Chat drawer
        const drawer = document.createElement('div');
        drawer.id = 'ai-drawer';
        drawer.innerHTML = `
            <div class="ai-drawer-inner">
                <div class="ai-drawer-header">
                    <div class="ai-drawer-header-left">
                        <div class="ai-drawer-avatar">
                            <img src="ia.webp" alt="IA">
                            <span class="ai-status-dot"></span>
                        </div>
                        <div>
                            <h3 class="ai-drawer-name">Assistente IA</h3>
                            <span class="ai-drawer-ctx" id="ai-ctx-label">Contexto: ${PAGE_INFO[currentContext].label}</span>
                        </div>
                    </div>
                    <button class="ai-drawer-close" id="ai-drawer-close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                    </button>
                </div>
                <div class="ai-drawer-messages" id="ai-messages"></div>
                <div class="ai-drawer-input-area">
                    <div class="ai-drawer-input-row">
                        <input type="text" id="ai-chat-input" placeholder="Digite sua mensagem..." autocomplete="off">
                        <button class="ai-drawer-send" id="ai-send-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.629a.498.498 0 0 0 .682.627l18.168-8.215a.498.498 0 0 0 0-.916L3.714 3.048z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(drawer);

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'ai-backdrop';
        backdrop.addEventListener('click', toggleChat);
        document.body.appendChild(backdrop);

        // Events
        document.getElementById('ai-drawer-close').addEventListener('click', toggleChat);
        document.getElementById('ai-send-btn').addEventListener('click', handleSend);
        document.getElementById('ai-chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) toggleChat(); });
    }

    // ── TOGGLE DRAWER ──
    function toggleChat() {
        isOpen = !isOpen;
        document.getElementById('ai-drawer').classList.toggle('open', isOpen);
        document.getElementById('ai-backdrop').classList.toggle('open', isOpen);
        document.getElementById('ai-fab').classList.toggle('hidden', isOpen);

        if (isOpen) {
            setTimeout(() => document.getElementById('ai-chat-input').focus(), 350);
            // Greeting na primeira abertura
            if (chatHistory.length === 0) {
                addMessage('ai', PAGE_INFO[currentContext].greeting);
            }
        }
    }

    // ── ENVIAR MENSAGEM ──
    async function handleSend() {
        if (isLoading) return;
        const input = document.getElementById('ai-chat-input');
        const msg = input.value.trim();
        if (!msg) return;

        input.value = '';
        addMessage('user', msg);
        chatHistory.push({ role: 'user', content: msg });

        isLoading = true;
        document.getElementById('ai-send-btn').disabled = true;
        addTyping();

        try {
            // No contexto de CADASTRO, verificar se é uma ação
            if (currentContext === 'cadastro') {
                const actionResult = await tryAutoRegister(msg);
                if (actionResult) {
                    removeTyping();
                    isLoading = false;
                    document.getElementById('ai-send-btn').disabled = false;
                    return;
                }
            }

            // Chat normal com IA
            const userData = getUserData();
            const reply = await callAI(currentContext, userData, msg, chatHistory);
            removeTyping();
            addMessage('ai', reply);
            chatHistory.push({ role: 'assistant', content: reply });

        } catch (err) {
            removeTyping();
            addMessage('ai', '⚠️ Erro ao conectar com o servidor. Verifique se o backend está rodando.');
        } finally {
            isLoading = false;
            document.getElementById('ai-send-btn').disabled = false;
            document.getElementById('ai-chat-input').focus();
        }
    }

    // ── CADASTRO AUTOMÁTICO E CSV (APENAS NA PÁGINA) ──
    async function tryAutoRegister(msg) {
        if (currentContext !== 'cadastro') return false; // Safety lock
        
        const actionKeywords = ['adicione', 'cadastre', 'registre', 'crie', 'lance', 'coloque', 'inclua', 'adicionar', 'cadastrar', 'registrar', 'criar', 'lançar', 'colocar', 'incluir', 'export', 'import', 'exportar', 'importar', 'csv'];
        const hasAction = actionKeywords.some(k => msg.toLowerCase().includes(k));
        if (!hasAction) return false;

        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('http://localhost:3001/api/ai-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ message: msg })
            });

            const result = await res.json();

            // Compatibilidade com servidor antigo ou novo (Lida com Array de actions)
            const actionsArray = result.actions || [result];

            if (actionsArray.length === 0 || actionsArray[0]?.action === 'error') {
                addMessage('ai', actionsArray[0]?.message || 'Desculpe, não consegui entender os dados do arquivo ou frase. Pode reformular?');
                return true;
            }

            const DB = {
                get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
                save: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
                add: (key, item) => { const data = DB.get(key); item.id = Date.now().toString() + Math.random().toString(36).substr(2, 5); data.push(item); DB.save(key, data); }
            };

            const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

            let successMessages = [];
            let addedCount = 0;

            for (const ac of actionsArray) {
                if (ac.action === 'export_csv') {
                    // Exportar Backup Completo Cirúrgico gerado pelo LLM via Chat
                    let csvContent = "";
                    const headers = ['dbType','id','data','tipo','categoria','subcategoria','valor','desc','cartao','parcelas','valorParcela','valorFatura','nome','valorObjetivo','valorAtual','dataLimite','ativo','qtd','precoMedio','aporte','inst'];
                    csvContent += headers.join(',') + "\n";

                    const processRow = (dbType, obj) => {
                        return headers.map(h => {
                            if (h === 'dbType') return dbType;
                            let val = obj[h] || '';
                            if (typeof val === 'string') val = `"${val.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
                            return val;
                        }).join(',');
                    };

                    ['db_fluxo', 'db_cartao', 'db_metas', 'db_invest'].forEach(dbKey => {
                        DB.get(dbKey).forEach(i => csvContent += processRow(dbKey, i) + "\n");
                    });

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `meus_dados_ia_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    
                    successMessages.push(`✔️ Arquivo CSV gerado e baixado!`);
                    continue;
                }

                if (ac.action === 'import_csv') {
                    // Importar CSV Inteligente colado no chat
                    try {
                        const lines = ac.csv_text.split('\n').filter(l => l.trim() !== '');
                        if (lines.length <= 1) throw new Error("Dados insuficientes.");
                        
                        const parseCSVLine = (line) => {
                            const result = [];
                            let cur = '', inQuote = false;
                            for (let i = 0; i < line.length; i++) {
                                if (line[i] === '"') { inQuote = !inQuote; }
                                else if (line[i] === ',' && !inQuote) { result.push(cur); cur = ''; }
                                else { cur += line[i]; }
                            }
                            result.push(cur);
                            return result;
                        };
                        
                        const headers = parseCSVLine(lines[0]);
                        let imported = 0;
                        
                        for (let i = 1; i < lines.length; i++) {
                            const row = parseCSVLine(lines[i]);
                            let item = {};
                            headers.forEach((h, idx) => {
                                let v = row[idx];
                                if (v !== undefined && v !== '') {
                                    if (!isNaN(v) && h !== 'data' && h !== 'dataLimite' && h !== 'id') item[h] = parseFloat(v);
                                    else item[h] = v;
                                }
                            });
                            
                            const dbTypeMap = { 'fluxo': 'db_fluxo', 'cartao': 'db_cartao', 'invest': 'db_invest', 'metas': 'db_metas' };
                            const fallbackDb = dbTypeMap[ac.contexto] || 'db_fluxo';
                            const dbType = item.dbType || fallbackDb; 
                            if (item.dbType) delete item.dbType;
                            
                            let data = DB.get(dbType);
                            if (!item.id) item.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                            
                            const existIdx = data.findIndex(d => d.id === item.id);
                            if (existIdx > -1) data[existIdx] = { ...data[existIdx], ...item };
                            else data.push(item);
                            
                            DB.save(dbType, data);
                            imported++;
                            addedCount++;
                        }
                        successMessages.push(`✔️ Processamento concluído! **${imported}** itens lidos e salvos.`);
                    } catch (e) {
                        successMessages.push(`⚠️ Houve um problema ao ler as linhas: ${e.message}`);
                    }
                    continue;
                }

                if (ac.action === 'cadastro_fluxo') {
                    DB.add('db_fluxo', ac.data);
                    successMessages.push(`✔️ **${ac.data.tipo}**: ${ac.data.categoria} (${fmt(ac.data.valor)})`);
                    addedCount++;
                } else if (ac.action === 'cadastro_cartao') {
                    DB.add('db_cartao', ac.data);
                    const val = ac.data.tipo === 'Parcela' ? ac.data.valorParcela : ac.data.valorFatura;
                    successMessages.push(`✔️ **Cartão**: ${ac.data.cartao} - ${ac.data.categoria} (${fmt(val)})`);
                    addedCount++;
                } else if (ac.action === 'cadastro_meta') {
                    DB.add('db_metas', ac.data);
                    successMessages.push(`✔️ **Meta**: ${ac.data.nome} (Objetivo: ${fmt(ac.data.valorObjetivo)})`);
                    addedCount++;
                } else if (ac.action === 'cadastro_invest') {
                    DB.add('db_invest', ac.data);
                    successMessages.push(`✔️ **Investimento**: ${ac.data.ativo} (${fmt(ac.data.aporte)})`);
                    addedCount++;
                }
            }

            if (successMessages.length > 0) {
                let finalMsg = '';
                if (addedCount > 0) finalMsg += `✅ **Sucesso! Processamento concluído (${addedCount} atualizações)**\n\n`;
                finalMsg += successMessages.join('\n');
                
                addMessage('ai', finalMsg);
                chatHistory.push({ role: 'assistant', content: `Operação concluída com ${addedCount} modificações e exportações.` });
                
                // Emite evento para os gráficos reiniciarem as renderizações sozinhos
                document.dispatchEvent(new Event('AppReady'));
                return true;
            }

        } catch (err) {
            addMessage('ai', '⚠️ Erro de rede ou indisponibilidade do serviço: ' + err.message);
        }
        return true;
    }

    // ── CHAMAR BACKEND IA ──
    async function callAI(context, userData, message, history = []) {
        const token = localStorage.getItem('auth_token');
        if (!token) throw new Error('No auth token');

        const res = await fetch('http://localhost:3001/api/ai-insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ context, userData, message, history: history.slice(-6) })
        });

        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        return data.reply;
    }

    // ── ADICIONAR MENSAGEM ──
    function addMessage(role, content) {
        const container = document.getElementById('ai-messages');
        const msg = document.createElement('div');
        msg.className = `ai-chat-msg ${role}`;

        let html;
        if (role === 'ai') {
            html = `
                <div class="ai-chat-msg-avatar"><img src="ia.webp" alt="IA"></div>
                <div class="ai-chat-msg-content">${formatMarkdown(content)}</div>
            `;
        } else {
            html = `<div class="ai-chat-msg-content">${escapeHtml(content)}</div>`;
        }

        msg.innerHTML = html;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    // ── TYPING INDICATOR ──
    function addTyping() {
        const container = document.getElementById('ai-messages');
        const el = document.createElement('div');
        el.className = 'ai-chat-msg ai';
        el.id = 'ai-typing';
        el.innerHTML = `
            <div class="ai-chat-msg-avatar"><img src="ia.webp" alt="IA"></div>
            <div class="ai-chat-msg-content"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>
        `;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
    }

    function removeTyping() {
        const el = document.getElementById('ai-typing');
        if (el) el.remove();
    }

    // ── MARKDOWN SIMPLES ──
    function formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^### (.+)$/gm, '<strong style="display:block;margin:8px 0 4px;color:#fff;">$1</strong>')
            .replace(/^## (.+)$/gm, '<strong style="display:block;margin:10px 0 4px;font-size:1em;color:#fff;">$1</strong>')
            .replace(/^[\-\•] (.+)$/gm, '• $1')
            .replace(/\n/g, '<br>');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── REMOVER BOTÕES "!" ANTIGOS ──
    function removeOldInsightButtons() {
        document.querySelectorAll('.ai-insight-btn').forEach(el => el.remove());
    }

    // ── INIT ──
    function init() {
        injectUI();
        removeOldInsightButtons();
    }

    if (window._appReadyFired) {
        setTimeout(init, 100);
    } else {
        document.addEventListener('AppReady', () => setTimeout(init, 100));
    }

})();
