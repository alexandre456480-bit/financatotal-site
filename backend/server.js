require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('..')); // Serve frontend files

// Manual users configuration
const users = {
    'alexandre_mesquita': { password: 'sapatolandia' },
    'rodrigo_mesquita': { password: '221147' },
    'alexandre': { password: '221147' }
};

// Default initial data for testing, to be populated when a user calls /init
const defaultData = {
    'db_fluxo': [
        { id: "1", data: "2026-04-09", tipo: "Receita", categoria: "Salário", subcategoria: "Pagamento Fixo", valor: 8500, desc: "Referente ao mês passado" },
        { id: "2", data: "2026-04-07", tipo: "Receita", categoria: "Rendimentos", subcategoria: "Dividendos FII", valor: 450, desc: "MXRF11 e HGLG11" },
        { id: "3", data: "2026-04-04", tipo: "Receita", categoria: "Freelance", subcategoria: "Projeto Design", valor: 2300, desc: "Logo da Empresa X" },
        { id: "4", data: "2026-04-08", tipo: "Despesa", categoria: "Alimentação", subcategoria: "Supermercado", valor: 850, desc: "Compras do Mês" },
        { id: "5", data: "2026-04-07", tipo: "Despesa", categoria: "Alimentação", subcategoria: "Ifood / Delivery", valor: 140, desc: "Pizzaria no final de semana" },
        { id: "6", data: "2026-04-08", tipo: "Despesa", categoria: "Moradia", subcategoria: "Aluguel e Condomínio", valor: 2500, desc: "Mensalidade" },
        { id: "7", data: "2026-04-02", tipo: "Despesa", categoria: "Moradia", subcategoria: "Luz e Água", valor: 320, desc: "Contas residenciais" },
        { id: "8", data: "2026-04-05", tipo: "Despesa", categoria: "Transporte", subcategoria: "Gasolina", valor: 300, desc: "Posto Shell" }
    ],
    'db_cartao': [
        { id: "10", data: "2026-04-09", tipo: "Parcela", cartao: "Cartão 1", parcelas: 12, valorParcela: 450, desc: "Celular Novo (iPhone)" },
        { id: "13", data: "2026-04-04", tipo: "Fatura", cartao: "Cartão 1", valorFatura: 2850, desc: "Fatura de Janeiro" }
    ],
    'db_metas': [
        { id: "15", nome: "Trocar de Carro (SUV)", valorObjetivo: 85000, valorAtual: 22000, dataLimite: "2026-12-01" },
        { id: "16", nome: "Reserva de Emergência", valorObjetivo: 30000, valorAtual: 28500, dataLimite: "2025-06-01" }
    ],
    'db_invest': [
        { id: "18", data: "2026-03-20", tipo: "Renda Variável", ativo: "FIIs (Fundos Imobiliários)", nome: "MXRF11", inst: "XP Investimentos", aporte: 15000, acumulado: 15000, ticker: "MXRF11", buy_price: 10.50, quantity: 1428 },
        { id: "19", data: "2026-03-10", tipo: "Renda Fixa", ativo: "Tesouro IPCA+ 2035", nome: "Tesouro IPCA+ 2035", inst: "Rico Corretora", aporte: 25000, acumulado: 28400 },
        { id: "20", data: "2026-02-28", tipo: "Renda Variável", ativo: "Ações", nome: "Petrobras ON", inst: "Clear Corretora", aporte: 8000, acumulado: 8000, ticker: "PETR3", buy_price: 40.00, quantity: 200 },
        { id: "21", data: "2026-03-30", tipo: "Renda Fixa", ativo: "CDB Liquidez Diária", nome: "CDB Inter 100% CDI", inst: "Banco Inter", aporte: 35000, acumulado: 36500 },
        { id: "22", data: "2026-04-01", tipo: "Renda Variável", ativo: "Criptomoedas", nome: "Bitcoin", inst: "Binance", aporte: 5000, acumulado: 5000, ticker: "bitcoin", buy_price: 500000, quantity: 0.01 },
        { id: "23", data: "2026-04-05", tipo: "Renda Variável", ativo: "Ações", nome: "Vale ON", inst: "XP Investimentos", aporte: 12000, acumulado: 12000, ticker: "VALE3", buy_price: 60.00, quantity: 200 }
    ],
    'db_cartoes_config': [
        { slot: "Cartão 1", banco: "nubank", limite: 8000, final: "1234", apelido: "Nubank Principal" },
        { slot: "Cartão 2", banco: "itau", limite: 15000, final: "9876", apelido: "Itaú Click" }
    ]
};

// Auth middleware
const authMiddleware = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'Token missing' });
    const token = header.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token invalid' });
    }
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (user && user.password === password) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Load all data
app.get('/api/data', authMiddleware, async (req, res) => {
    const { username } = req.user;

    // Auto populate defaults if user has no data yet
    const { data: countData, error: countError } = await supabase
        .from('app_data')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', username);

    if (!countError && countData && countData.count === 0 && username === 'alexandre_mesquita') {
        const insertPayload = Object.keys(defaultData).map(k => ({
            user_id: username,
            key: k,
            value: defaultData[k]
        }));
        await supabase.from('app_data').insert(insertPayload);
    }

    const { data, error } = await supabase
        .from('app_data')
        .select('key, value')
        .eq('user_id', username);

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ error: error.message });
    }

    const result = {};
    if (data) {
        data.forEach(row => {
            result[row.key] = row.value;
        });
    }

    res.json(result);
});

// Save specific key
app.post('/api/data/:key', authMiddleware, async (req, res) => {
    const { username } = req.user;
    const { key } = req.params;
    const value = req.body;

    const { data, error } = await supabase
        .from('app_data')
        .upsert(
            { user_id: username, key, value, updated_at: new Date().toISOString() },
            { onConflict: 'user_id, key' }
        )
        .select();

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
});

// ============================================================
// AGENTE DE IA — INSIGHTS FINANCEIROS (Groq API)
// ============================================================
const AI_SYSTEM_PROMPTS = {
    financeiro: `Consultor financeiro. Analise saldo/receitas/despesas. Use bullets, BRL. Seja direto, máx 200 palavras. PT-BR.`,

    investimentos: `Analista de investimentos. Analise carteira: diversificação, rentabilidade, risco. Bullets, BRL. Máx 200 palavras. PT-BR.`,

    metas: `Planejador financeiro de metas. Analise progresso, projeções, prioridades. Motivador mas realista. Máx 200 palavras. PT-BR.`,

    cartoes: `Consultor de crédito/cartões. Analise limites, parcelamentos, endividamento. BRL. Máx 200 palavras. PT-BR.`,

    cadastro: `Assistente de cadastro financeiro. Confirme dados a serem registrados. Conciso, simpático. PT-BR.`,

    dados: `Assistente de dados financeiros. Analise registros, resuma, filtre. Direto e organizado. PT-BR.`
};

app.post('/api/ai-insight', authMiddleware, async (req, res) => {
    const { context, userData, message, history } = req.body;
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    if (!context || !message) return res.status(400).json({ error: 'Context and message required' });

    const systemPrompt = AI_SYSTEM_PROMPTS[context] || AI_SYSTEM_PROMPTS.financeiro;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `D:${JSON.stringify(userData)}\nQ:${message}` }
    ];

    if (history && Array.isArray(history)) {
        const trimmed = history.slice(-4);
        messages.splice(1, 0, ...trimmed);
    }

    try {
        console.log(`[AI] Requisição: context=${context}, msg="${message.substring(0, 50)}..."`);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages,
                temperature: 0.6,
                max_tokens: 512,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('[AI] Groq API error:', response.status, errData);
            return res.status(502).json({ error: 'AI service error', details: errData });
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 'Não foi possível gerar uma análise no momento.';

        console.log(`[AI] ✅ Resposta gerada (${reply.length} chars)`);
        res.json({ reply, model: data.model, usage: data.usage });

    } catch (err) {
        console.error('[AI] Error:', err.message);
        res.status(500).json({ error: 'Failed to generate insight', details: err.message });
    }
});

// ============================================================
// AGENTE DE IA — AÇÃO: CADASTRO AUTOMÁTICO POR VOZ/TEXTO
// ============================================================
const AI_ACTION_PROMPT = `Você é um parser de intenção financeira. O usuário vai te mandar uma mensagem pedindo para cadastrar múltiplos dados, ou exportar/importar um CSV.

Você DEVE retornar APENAS um JSON válido (sem markdown, sem \`\`\`, sem texto extra) com a seguinte estrutura raiz:
{
  "actions": [
    // Lista de ações detectadas
  ]
}

Ações disponíveis de CADASTRO (o usuário pode pedir várias de uma vez):
{"action":"cadastro_fluxo","data":{"tipo":"Receita|Despesa","categoria":"...","subcategoria":"...","valor":0.00,"data":"YYYY-MM-DD","desc":"..."}}
{"action":"cadastro_cartao","data":{"tipo":"Fatura|Parcela","cartao":"Cartão 1","categoria":"...","subcategoria":"...","valorParcela":0.00,"valorFatura":0.00,"parcelas":1,"data":"YYYY-MM-DD","desc":"..."}}
{"action":"cadastro_meta","data":{"nome":"...","valorObjetivo":0.00,"valorAtual":0.00,"dataLimite":"YYYY-MM-DD"}}
{"action":"cadastro_invest","data":{"tipo":"Renda Fixa|Renda Variável","ativo":"...","ticker":"...","qtd":0,"precoMedio":0.00,"aporte":0.00,"data":"YYYY-MM-DD"}}

Ações de MANIPULAÇÃO DE CSV:
Para EXPORTAR dados: {"action":"export_csv", "contexto":"fluxo|cartao|invest|metas"}
Para IMPORTAR dados de um texto colar: {"action":"import_csv", "contexto":"fluxo|cartao|invest|metas", "csv_text":"..."}

Se o usuário colar um texto longo parecido com CSV, detecte e use import_csv.
Se não conseguir entender nada, retorne: {"actions": [{"action":"error","message":"Não entendi. Pode reformular?"}]}

Categorias Receita: Salário, Freelance, Investimentos, Vendas, Outros
Categorias Despesa: Alimentação, Moradia, Transporte, Saúde, Educação, Lazer, Vestuário, Tecnologia, Assinaturas, Outros

Data de HOJE: ${new Date().toISOString().split('T')[0]}

REGRA ABSOLUTA: Retorne SOMENTE o JSON válido contendo a raiz "actions" como um array. Oculte conversas e textos extra. Processe TODOS os itens citados pelo usuário individualmente. Se ele disse 4 itens, a array DEVE ter 4 objetos.`;

app.post('/api/ai-action', authMiddleware, async (req, res) => {
    const { message } = req.body;
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    if (!message) return res.status(400).json({ error: 'Message required' });

    try {
        console.log(`[AI-Action] Parsing: "${message.substring(0, 80)}..."`);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: AI_ACTION_PROMPT },
                    { role: 'user', content: message }
                ],
                temperature: 0.1,
                max_tokens: 1024,
                top_p: 0.9,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.status(502).json({ error: 'AI action parse error', details: errData });
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content || '';

        // Extrair JSON da resposta
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            try {
                parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
            } catch (e2) {
                parsed = { actions: [{ action: 'error', message: 'Não consegui interpretar. Pode reformular o pedido?' }] };
            }
        }

        console.log(`[AI-Action] ✅ Parsed action success!`);
        res.json(parsed);

    } catch (err) {
        console.error('[AI-Action] Error:', err.message);
        res.status(500).json({ error: 'Failed to parse action', details: err.message });
    }
});

// ============================================================
// ATUALIZAÇÃO DE PREÇOS SERVER-SIDE (one-shot, econômico)
// ============================================================
app.get('/api/update-prices', authMiddleware, async (req, res) => {
    const { username } = req.user;
    console.log(`[Price Update] Iniciando para ${username}`);

    const { data: rows, error: readErr } = await supabase
        .from('app_data').select('value')
        .eq('user_id', username).eq('key', 'db_invest').single();

    if (readErr || !rows) return res.json({ updated: false, investments: [] });

    let investments = rows.value || [];
    const brapiTickers = [], cryptoIds = [];
    investments.forEach(i => {
        if (i.ticker && i.quantity) {
            if (i.ativo === 'Criptomoedas') cryptoIds.push(i.ticker.toLowerCase());
            else brapiTickers.push(i.ticker.toUpperCase());
        }
    });
    const brapiSet = [...new Set(brapiTickers)];
    const cryptoSet = [...new Set(cryptoIds)];

    if (brapiSet.length === 0 && cryptoSet.length === 0) {
        return res.json({ updated: false, investments });
    }

    let hasChanges = false;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const now = Date.now();

    // BRAPI (1 ticker/request — plano free)
    for (const ticker of brapiSet) {
        if (priceCache.brapi.data[ticker] && priceCache.brapi.perTicker[ticker] &&
            (now - priceCache.brapi.perTicker[ticker]) < CACHE_TTL) {
            const p = priceCache.brapi.data[ticker];
            investments.forEach(i => {
                if (i.ticker && i.ticker.toUpperCase() === ticker && i.quantity && i.ativo !== 'Criptomoedas') {
                    const nv = p * i.quantity;
                    if (i.acumulado !== nv) { i.acumulado = nv; hasChanges = true; console.log(`[PU] ${ticker} cache → R$${nv}`); }
                }
            });
            continue;
        }
        try {
            const r = await fetch(`https://brapi.dev/api/quote/${ticker}?token=${process.env.BRAPI_TOKEN}`);
            const d = await r.json();
            if (d.results && d.results[0]) {
                const p = d.results[0].regularMarketPrice;
                priceCache.brapi.data[ticker] = p;
                priceCache.brapi.perTicker[ticker] = now;
                investments.forEach(i => {
                    if (i.ticker && i.ticker.toUpperCase() === ticker && i.quantity && i.ativo !== 'Criptomoedas') {
                        const nv = p * i.quantity;
                        if (i.acumulado !== nv) { i.acumulado = nv; hasChanges = true; console.log(`[PU] ${ticker} live R$${p} → acum R$${nv}`); }
                    }
                });
            }
            if (brapiSet.indexOf(ticker) < brapiSet.length - 1) await wait(300);
        } catch (e) { console.error(`[PU] BRAPI ${ticker} err:`, e.message); }
    }

    // CoinGecko
    if (cryptoSet.length > 0) {
        const missing = cryptoSet.filter(id => !priceCache.coingecko.data[id] || (now - priceCache.coingecko.timestamp) >= CACHE_TTL);
        if (missing.length > 0) {
            try {
                const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${missing.join(',')}&vs_currencies=brl&x_cg_demo_api_key=${process.env.COINGECKO_KEY}`);
                const d = await r.json();
                Object.keys(d).forEach(k => { priceCache.coingecko.data[k.toLowerCase()] = d[k]; });
                priceCache.coingecko.timestamp = now;
            } catch (e) { console.error('[PU] CoinGecko err:', e.message); }
        }
        investments.forEach(i => {
            if (i.ticker && i.quantity && i.ativo === 'Criptomoedas') {
                const cd = priceCache.coingecko.data[i.ticker.toLowerCase()];
                if (cd && cd.brl) {
                    const nv = cd.brl * i.quantity;
                    if (i.acumulado !== nv) { i.acumulado = nv; hasChanges = true; console.log(`[PU] ${i.ticker} R$${cd.brl} → acum R$${nv}`); }
                }
            }
        });
    }

    // Salvar no Supabase
    if (hasChanges) {
        await supabase.from('app_data').upsert(
            { user_id: username, key: 'db_invest', value: investments, updated_at: new Date().toISOString() },
            { onConflict: 'user_id, key' }
        );
        console.log('[Price Update] ✅ Preços salvos no Supabase!');
    }

    res.json({ updated: hasChanges, investments });
});

// ============================================================
// CACHE SERVER-SIDE (1 HORA) — Econômico para APIs externas
// ============================================================
const priceCache = {
    brapi: { data: {}, perTicker: {}, timestamp: 0 },
    coingecko: { data: {}, timestamp: 0 }
};
const CACHE_TTL = 60 * 60 * 1000; // 1 hora em ms

// Proxy for BRAPI (com cache de 1h + 1 ticker por request — limitação plano free)
app.get('/api/proxy/brapi', authMiddleware, async (req, res) => {
    const { tickers } = req.query;
    if (!tickers) return res.status(400).json({ error: 'Tickers missing' });

    const tickerList = tickers.split(',').map(t => t.trim().toUpperCase());
    const now = Date.now();

    // Verifica quais tickers já estão no cache válido
    const missing = [];
    tickerList.forEach(t => {
        if (priceCache.brapi.data[t] && (now - (priceCache.brapi.perTicker[t] || 0)) < CACHE_TTL) {
            // Cache válido, não precisa buscar
        } else {
            missing.push(t);
        }
    });

    // Se todos estão em cache, retorna direto sem chamar a API
    if (missing.length === 0) {
        console.log('[BRAPI Cache HIT] Retornando preços do cache para:', tickerList.join(', '));
        const results = tickerList.map(t => ({ symbol: t, regularMarketPrice: priceCache.brapi.data[t] }));
        return res.json({ results });
    }

    // Plano free da BRAPI: máx 1 ativo por requisição
    // Fazemos chamadas individuais com delay de 300ms entre elas
    const brapiToken = process.env.BRAPI_TOKEN;
    console.log('[BRAPI] Buscando preços individuais para:', missing.join(', '));

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    for (const ticker of missing) {
        try {
            const url = `https://brapi.dev/api/quote/${ticker}?token=${brapiToken}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const price = data.results[0].regularMarketPrice;
                priceCache.brapi.data[ticker] = price;
                if (!priceCache.brapi.perTicker) priceCache.brapi.perTicker = {};
                priceCache.brapi.perTicker[ticker] = now;
                console.log(`[BRAPI] ${ticker} = R$ ${price}`);
            } else {
                console.warn(`[BRAPI] Sem resultado para ${ticker}:`, data.message || 'unknown');
            }

            // Delay de 300ms entre requisições para não tomar rate limit
            if (missing.indexOf(ticker) < missing.length - 1) await delay(300);
        } catch (e) {
            console.error(`[BRAPI] Erro ao buscar ${ticker}:`, e.message);
        }
    }

    // Retorna todos os tickers (cache + novos)
    const allResults = tickerList.map(t => ({
        symbol: t,
        regularMarketPrice: priceCache.brapi.data[t] || null
    })).filter(r => r.regularMarketPrice !== null);

    res.json({ results: allResults });
});

// Proxy for CoinGecko (com cache de 1h)
app.get('/api/proxy/coingecko', authMiddleware, async (req, res) => {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ error: 'Ids missing' });

    const idList = ids.split(',').map(i => i.trim().toLowerCase());
    const now = Date.now();

    // Verifica cache
    const missing = [];
    const cached = {};
    idList.forEach(id => {
        if (priceCache.coingecko.data[id] && (now - priceCache.coingecko.timestamp) < CACHE_TTL) {
            cached[id] = priceCache.coingecko.data[id];
        } else {
            missing.push(id);
        }
    });

    if (missing.length === 0) {
        console.log('[CoinGecko Cache HIT] Retornando preços do cache para:', idList.join(', '));
        return res.json(cached);
    }

    const token = process.env.COINGECKO_KEY;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${missing.join(',')}&vs_currencies=brl&x_cg_demo_api_key=${token}`;
    console.log('[CoinGecko] Buscando preços da API externa para:', missing.join(', '));

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Salva no cache
        Object.keys(data).forEach(key => {
            priceCache.coingecko.data[key.toLowerCase()] = data[key];
        });
        priceCache.coingecko.timestamp = now;

        // Combina cache + novos
        const combined = {};
        idList.forEach(id => {
            if (priceCache.coingecko.data[id]) combined[id] = priceCache.coingecko.data[id];
        });
        res.json(combined);
    } catch (e) {
        console.error('[CoinGecko] Erro:', e.message);
        // Fallback: retorna cache expirado se existir
        const fallback = {};
        idList.forEach(id => {
            if (priceCache.coingecko.data[id]) fallback[id] = priceCache.coingecko.data[id];
        });
        res.json(fallback);
    }
});

// ============================================================
// IMPORTAÇÃO INTELIGENTE DE EXTRATO BANCÁRIO CSV
// Parser Determinístico + IA (GROQ_API_KEY_CSV) como fallback
// ============================================================

// Mapeamento determinístico de palavras-chave para categorias (evita uso de IA)
const KEYWORD_CATEGORY_MAP = {
    receita: {
        'salario': { categoria: 'Salário', subcategoria: 'Pagamento Fixo' },
        'salário': { categoria: 'Salário', subcategoria: 'Pagamento Fixo' },
        'pagamento': { categoria: 'Salário', subcategoria: 'Pagamento Fixo' },
        'pix recebido': { categoria: 'Outras Receitas', subcategoria: 'Pix Recebido' },
        'ted recebida': { categoria: 'Outras Receitas', subcategoria: 'TED Recebida' },
        'doc recebido': { categoria: 'Outras Receitas', subcategoria: 'DOC Recebido' },
        'transferencia recebida': { categoria: 'Outras Receitas', subcategoria: 'Transferência Recebida' },
        'transferência recebida': { categoria: 'Outras Receitas', subcategoria: 'Transferência Recebida' },
        'deposito': { categoria: 'Outras Receitas', subcategoria: 'Depósito' },
        'depósito': { categoria: 'Outras Receitas', subcategoria: 'Depósito' },
        'rendimento': { categoria: 'Rendimentos', subcategoria: 'Rendimento Aplicação' },
        'dividendo': { categoria: 'Rendimentos', subcategoria: 'Dividendos' },
        'juros': { categoria: 'Rendimentos', subcategoria: 'Juros' },
        'resgate': { categoria: 'Rendimentos', subcategoria: 'Resgate Investimento' },
        'estorno': { categoria: 'Outras Receitas', subcategoria: 'Estorno' },
        'devolucao': { categoria: 'Outras Receitas', subcategoria: 'Devolução' },
        'devolvido': { categoria: 'Outras Receitas', subcategoria: 'Pix Devolvido' },
        'cashback': { categoria: 'Outras Receitas', subcategoria: 'Cashback' },
        'venda': { categoria: 'Vendas', subcategoria: 'Venda' },
        'freelance': { categoria: 'Freelance', subcategoria: 'Serviço Prestado' },
        'comissao': { categoria: 'Vendas', subcategoria: 'Comissão' },
        'comissão': { categoria: 'Vendas', subcategoria: 'Comissão' },
        'bonus': { categoria: 'Bônus', subcategoria: 'Bônus' },
        'bônus': { categoria: 'Bônus', subcategoria: 'Bônus' },
    },
    despesa: {
        'pix enviado': { categoria: 'Outras Despesas', subcategoria: 'Pix Enviado' },
        'pix': { categoria: 'Outras Despesas', subcategoria: 'Pix Enviado' },
        'ted enviada': { categoria: 'Outras Despesas', subcategoria: 'TED Enviada' },
        'doc enviado': { categoria: 'Outras Despesas', subcategoria: 'DOC Enviado' },
        'transferencia': { categoria: 'Outras Despesas', subcategoria: 'Transferência' },
        'transferência': { categoria: 'Outras Despesas', subcategoria: 'Transferência' },
        'boleto': { categoria: 'Outras Despesas', subcategoria: 'Boleto' },
        'debito automatico': { categoria: 'Outras Despesas', subcategoria: 'Débito Automático' },
        'débito automático': { categoria: 'Outras Despesas', subcategoria: 'Débito Automático' },
        'tarifa': { categoria: 'Outras Despesas', subcategoria: 'Tarifa Bancária' },
        'taxa': { categoria: 'Outras Despesas', subcategoria: 'Taxa' },
        'iof': { categoria: 'Outras Despesas', subcategoria: 'IOF' },
        'supermercado': { categoria: 'Alimentação', subcategoria: 'Supermercado' },
        'mercado': { categoria: 'Alimentação', subcategoria: 'Supermercado' },
        'padaria': { categoria: 'Alimentação', subcategoria: 'Padaria' },
        'restaurante': { categoria: 'Alimentação', subcategoria: 'Restaurante' },
        'lanchonete': { categoria: 'Alimentação', subcategoria: 'Lanchonete' },
        'ifood': { categoria: 'Alimentação', subcategoria: 'Ifood / Delivery' },
        'food': { categoria: 'Alimentação', subcategoria: 'Delivery' },
        'delivery': { categoria: 'Alimentação', subcategoria: 'Delivery' },
        'uber eats': { categoria: 'Alimentação', subcategoria: 'Delivery' },
        'rappi': { categoria: 'Alimentação', subcategoria: 'Delivery' },
        'aluguel': { categoria: 'Moradia', subcategoria: 'Aluguel' },
        'condominio': { categoria: 'Moradia', subcategoria: 'Condomínio' },
        'condomínio': { categoria: 'Moradia', subcategoria: 'Condomínio' },
        'luz': { categoria: 'Moradia', subcategoria: 'Luz' },
        'energia': { categoria: 'Moradia', subcategoria: 'Energia' },
        'agua': { categoria: 'Moradia', subcategoria: 'Água' },
        'água': { categoria: 'Moradia', subcategoria: 'Água' },
        'gas': { categoria: 'Moradia', subcategoria: 'Gás' },
        'gás': { categoria: 'Moradia', subcategoria: 'Gás' },
        'internet': { categoria: 'Moradia', subcategoria: 'Internet' },
        'gasolina': { categoria: 'Transporte', subcategoria: 'Gasolina' },
        'combustivel': { categoria: 'Transporte', subcategoria: 'Combustível' },
        'combustível': { categoria: 'Transporte', subcategoria: 'Combustível' },
        'posto': { categoria: 'Transporte', subcategoria: 'Combustível' },
        'uber': { categoria: 'Transporte', subcategoria: 'Uber / 99' },
        '99': { categoria: 'Transporte', subcategoria: 'Uber / 99' },
        'estacionamento': { categoria: 'Transporte', subcategoria: 'Estacionamento' },
        'farmacia': { categoria: 'Saúde', subcategoria: 'Farmácia' },
        'farmácia': { categoria: 'Saúde', subcategoria: 'Farmácia' },
        'drogaria': { categoria: 'Saúde', subcategoria: 'Farmácia' },
        'hospital': { categoria: 'Saúde', subcategoria: 'Hospital' },
        'medico': { categoria: 'Saúde', subcategoria: 'Médico' },
        'médico': { categoria: 'Saúde', subcategoria: 'Médico' },
        'dentista': { categoria: 'Saúde', subcategoria: 'Dentista' },
        'academia': { categoria: 'Saúde', subcategoria: 'Academia' },
        'faculdade': { categoria: 'Educação', subcategoria: 'Faculdade' },
        'curso': { categoria: 'Educação', subcategoria: 'Curso' },
        'escola': { categoria: 'Educação', subcategoria: 'Escola' },
        'livro': { categoria: 'Educação', subcategoria: 'Livros' },
        'netflix': { categoria: 'Lazer', subcategoria: 'Streaming' },
        'spotify': { categoria: 'Lazer', subcategoria: 'Streaming' },
        'disney': { categoria: 'Lazer', subcategoria: 'Streaming' },
        'hbo': { categoria: 'Lazer', subcategoria: 'Streaming' },
        'cinema': { categoria: 'Lazer', subcategoria: 'Cinema' },
        'viagem': { categoria: 'Lazer', subcategoria: 'Viagem' },
        'hotel': { categoria: 'Lazer', subcategoria: 'Hotel' },
        'roupa': { categoria: 'Vestuário', subcategoria: 'Roupas' },
        'vestuario': { categoria: 'Vestuário', subcategoria: 'Roupas' },
        'vestuário': { categoria: 'Vestuário', subcategoria: 'Roupas' },
        'calcado': { categoria: 'Vestuário', subcategoria: 'Calçados' },
        'calçado': { categoria: 'Vestuário', subcategoria: 'Calçados' },
        'celular': { categoria: 'Tecnologia', subcategoria: 'Celular' },
        'aplicacao': { categoria: 'Outras Despesas', subcategoria: 'Aplicação Investimento' },
        'aplicação': { categoria: 'Outras Despesas', subcategoria: 'Aplicação Investimento' },
    }
};

/**
 * Determina se um lançamento é receita ou despesa baseado em sinais determinísticos
 */
function detectTipoFromRow(historico, descricao, valor) {
    const h = (historico || '').toLowerCase().trim();
    const d = (descricao || '').toLowerCase().trim();
    const combined = `${h} ${d}`;

    // Sinal mais forte: valor numérico negativo = despesa, positivo = receita
    if (typeof valor === 'number' && !isNaN(valor)) {
        if (valor < 0) return 'Despesa';
        if (valor > 0) return 'Receita';
    }

    // Sinais textuais
    const receitaSignals = ['recebido', 'recebida', 'credito', 'crédito', 'resgate', 'rendimento',
        'dividendo', 'estorno', 'devolvido', 'devolução', 'cashback', 'deposito', 'depósito'];
    const despesaSignals = ['enviado', 'enviada', 'debito', 'débito', 'pagamento de', 'boleto',
        'tarifa', 'taxa', 'compra', 'saque', 'aplicação', 'aplicacao'];

    for (const signal of receitaSignals) {
        if (combined.includes(signal)) return 'Receita';
    }
    for (const signal of despesaSignals) {
        if (combined.includes(signal)) return 'Despesa';
    }

    return valor >= 0 ? 'Receita' : 'Despesa';
}

/**
 * Keywords que representam operações bancárias GENÉRICAS.
 * Quando o histórico contém uma dessas, a DESCRIÇÃO precisa ser analisada
 * por IA para categorização inteligente (ex: "Pix enviado" + "99 Food" → Alimentação).
 */
const GENERIC_OPS = [
    'pix enviado', 'pix recebido', 'pix enviado devolvido', 'pix',
    'ted enviada', 'ted recebida', 'doc enviado', 'doc recebido',
    'transferencia', 'transferência', 'transferencia recebida', 'transferência recebida',
    'boleto', 'debito automatico', 'débito automático',
    'deposito', 'depósito', 'pagamento',
    'devolvido', 'devolucao', 'estorno',
    'resgate', 'aplicação', 'aplicacao', 'aplicação', 'aplicacao'
];

/**
 * Categoriza deterministicamente usando keywords.
 * ESTRATÉGIA: Prioriza keywords ESPECÍFICAS de negócio/categoria (ifood, supermercado, farmacia..)
 * sobre keywords genéricas de operação bancária (pix enviado, ted, etc).
 * Se a transação é uma operação genérica e a descrição não bate com nenhum negócio conhecido → IA.
 */
function categorizeDeterministic(tipo, historico, descricao) {
    const hist = (historico || '').toLowerCase().trim();
    const desc = (descricao || '').toLowerCase().trim();
    const combined = `${hist} ${desc}`;
    const map = tipo === 'Receita' ? KEYWORD_CATEGORY_MAP.receita : KEYWORD_CATEGORY_MAP.despesa;

    // Ordenar keywords por tamanho (mais específico primeiro)
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);

    // PASSO 1: Tentar match apenas com keywords ESPECÍFICAS (não-genéricas)
    // Isso garante que "Pix enviado + 99 Food" encontre "food" → Alimentação
    for (const keyword of sortedKeys) {
        if (GENERIC_OPS.includes(keyword)) continue; // Pular ops genéricas
        if (combined.includes(keyword)) {
            return map[keyword];
        }
    }

    // PASSO 2: Se o histórico é uma operação genérica (pix, ted, boleto...),
    // a descrição contém um nome de pessoa/empresa que precisa de IA para categorizar.
    const isGenericOp = GENERIC_OPS.some(op => hist.includes(op));
    if (isGenericOp) {
        return null; // → Enviar para IA categorizar pela descrição
    }

    // PASSO 3: Último recurso — tentar match com keywords genéricas
    for (const keyword of sortedKeys) {
        if (combined.includes(keyword)) {
            return map[keyword];
        }
    }

    return null; // Não conseguiu categorizar — precisará de IA
}

/**
 * Parseia valor monetário no formato brasileiro (1.234,56 ou -1234.56)
 */
function parseMonetaryValue(rawValue) {
    if (typeof rawValue === 'number') return rawValue;
    if (!rawValue || typeof rawValue !== 'string') return 0;

    let cleaned = rawValue.trim().replace(/\s/g, '');

    // Detectar sinal negativo em qualquer formato
    const isNegative = cleaned.startsWith('-') || cleaned.includes('(') || cleaned.endsWith('-');
    cleaned = cleaned.replace(/[-()]/g, '');

    // Formato BR: 1.234,56 ou formato US: 1,234.56
    // Se tem vírgula depois do ponto → BR (1.234,56)
    // Se tem ponto depois da vírgula → US (1,234.56)
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma > lastDot) {
        // BR: ponto é milhar, vírgula é decimal
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
        // US ou sem milhar: vírgula é milhar, ponto é decimal
        cleaned = cleaned.replace(/,/g, '');
    } else {
        // Só tem um ou nenhum — remove tudo exceto números e ponto
        cleaned = cleaned.replace(/,/g, '.');
    }

    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return isNegative ? -Math.abs(num) : num;
}

/**
 * Parseia data em múltiplos formatos (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc)
 */
function parseDate(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw.trim();

    // DD/MM/YYYY ou DD-MM-YYYY
    let m = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
        const [, d, mo, y] = m;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // YYYY-MM-DD ou YYYY/MM/DD
    m = cleaned.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) {
        const [, y, mo, d] = m;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // DD/MM/YY
    m = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (m) {
        const [, d, mo, yy] = m;
        const y = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    return null;
}

/**
 * Detecta automaticamente as colunas do CSV (data, histórico, descrição, valor, saldo)
 */
function detectColumns(headers, sampleRows) {
    const norm = headers.map(h => h.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ''));

    const mapping = { data: -1, historico: -1, descricao: -1, valor: -1, saldo: -1 };

    // Data
    const dateKeys = ['data', 'data lancamento', 'data lançamento', 'date', 'dt', 'data mov', 'data movimentacao', 'data transacao'];
    for (let i = 0; i < norm.length; i++) {
        if (dateKeys.some(k => norm[i].includes(k))) { mapping.data = i; break; }
    }

    // Histórico / Tipo
    const histKeys = ['historico', 'histórico', 'tipo', 'tipo lancamento', 'natureza', 'operacao', 'operação', 'category'];
    for (let i = 0; i < norm.length; i++) {
        if (i === mapping.data) continue;
        if (histKeys.some(k => norm[i].includes(k))) { mapping.historico = i; break; }
    }

    // Descrição
    const descKeys = ['descricao', 'descrição', 'description', 'detalhe', 'favorecido', 'nome', 'destino', 'origem'];
    for (let i = 0; i < norm.length; i++) {
        if (i === mapping.data || i === mapping.historico) continue;
        if (descKeys.some(k => norm[i].includes(k))) { mapping.descricao = i; break; }
    }

    // Valor
    const valKeys = ['valor', 'value', 'amount', 'quantia', 'vlr'];
    for (let i = 0; i < norm.length; i++) {
        if (i === mapping.data || i === mapping.historico || i === mapping.descricao) continue;
        if (valKeys.some(k => norm[i].includes(k))) { mapping.valor = i; break; }
    }

    // Saldo
    const saldoKeys = ['saldo', 'balance', 'saldo final'];
    for (let i = 0; i < norm.length; i++) {
        if (i === mapping.valor) continue;
        if (saldoKeys.some(k => norm[i].includes(k))) { mapping.saldo = i; break; }
    }

    // Fallback: se não achou data, tenta pelo conteúdo
    if (mapping.data === -1 && sampleRows.length > 0) {
        for (let i = 0; i < sampleRows[0].length; i++) {
            if (parseDate(sampleRows[0][i])) { mapping.data = i; break; }
        }
    }

    // Fallback: se não achou valor, tenta pelo conteúdo numérico
    if (mapping.valor === -1 && sampleRows.length > 0) {
        for (let i = 0; i < sampleRows[0].length; i++) {
            if (i === mapping.data || i === mapping.saldo) continue;
            const testVal = parseMonetaryValue(sampleRows[0][i]);
            if (testVal !== 0) { mapping.valor = i; break; }
        }
    }

    return mapping;
}

/**
 * Parseia CSV com suporte a diferentes delimitadores e caracteres de quoting
 */
function parseCSVContent(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');

    // Detectar delimitador (;  ,  \t)
    const firstDataLines = lines.slice(0, 10).join('\n');
    const semicolonCount = (firstDataLines.match(/;/g) || []).length;
    const commaCount = (firstDataLines.match(/,/g) || []).length;
    const tabCount = (firstDataLines.match(/\t/g) || []).length;

    let delimiter = ';'; // default para bancos BR
    if (commaCount > semicolonCount && commaCount > tabCount) delimiter = ',';
    if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';

    const parseLine = (line) => {
        const result = [];
        let cur = '', inQuote = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') { inQuote = !inQuote; }
            else if (line[i] === delimiter && !inQuote) { result.push(cur.trim()); cur = ''; }
            else { cur += line[i]; }
        }
        result.push(cur.trim());
        return result;
    };

    return { lines, parseLine, delimiter };
}

/**
 * Detecta e pula linhas de cabeçalho/metadados do extrato bancário
 * (Ex: "Extrato Conta Corrente", "Conta: 123456", "Período: ...", linhas em branco)
 */
function findDataStart(lines, parseLine) {
    // Procura a linha de cabeçalho real dos dados
    const headerKeywords = ['data', 'historico', 'histórico', 'descricao', 'descrição', 'valor', 'saldo', 'lancamento', 'lançamento'];

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const cols = parseLine(lines[i]);
        const normalized = cols.map(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        const matches = normalized.filter(c => headerKeywords.some(k => c.includes(k)));

        if (matches.length >= 2) {
            return { headerLine: i, headers: cols };
        }
    }

    // Fallback: assume que a primeira linha com 3+ colunas é o header
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const cols = parseLine(lines[i]);
        if (cols.length >= 3) {
            return { headerLine: i, headers: cols };
        }
    }

    return { headerLine: 0, headers: parseLine(lines[0]) };
}

// Rota principal de importação
app.post('/api/csv-import', authMiddleware, async (req, res) => {
    const { csvContent, skipApplications } = req.body;
    const groqKey = process.env.GROQ_API_KEY_CSV;

    if (!csvContent) return res.status(400).json({ error: 'CSV content is required' });

    console.log(`[CSV-Import] Iniciando processamento...`);

    try {
        // FASE 1: Parse do CSV
        const { lines, parseLine, delimiter } = parseCSVContent(csvContent);
        console.log(`[CSV-Import] Delimiter detectado: "${delimiter}" | ${lines.length} linhas`);

        // FASE 2: Encontrar início dos dados e headers
        const { headerLine, headers } = findDataStart(lines, parseLine);
        console.log(`[CSV-Import] Header na linha ${headerLine}: ${headers.join(' | ')}`);

        // FASE 3: Parsear linhas de dados
        const dataLines = [];
        for (let i = headerLine + 1; i < lines.length; i++) {
            const cols = parseLine(lines[i]);
            if (cols.length >= 3 && cols.some(c => c.trim() !== '')) {
                dataLines.push(cols);
            }
        }
        console.log(`[CSV-Import] ${dataLines.length} linhas de dados encontradas`);

        if (dataLines.length === 0) {
            return res.status(400).json({ error: 'Nenhuma transação encontrada no CSV' });
        }

        // FASE 4: Detectar colunas
        const colMap = detectColumns(headers, dataLines.slice(0, 5));
        console.log(`[CSV-Import] Mapeamento: data=${colMap.data}, hist=${colMap.historico}, desc=${colMap.descricao}, val=${colMap.valor}, saldo=${colMap.saldo}`);

        if (colMap.data === -1 || colMap.valor === -1) {
            return res.status(400).json({
                error: 'Não foi possível detectar as colunas de data ou valor no CSV. Verifique o formato.',
                headers: headers
            });
        }

        // FASE 5: Processar todas as linhas deterministicamente
        const transactions = [];
        const needsAICategorization = [];

        for (let idx = 0; idx < dataLines.length; idx++) {
            const row = dataLines[idx];
            const rawDate = colMap.data >= 0 ? row[colMap.data] : '';
            const rawHist = colMap.historico >= 0 ? row[colMap.historico] : '';
            const rawDesc = colMap.descricao >= 0 ? row[colMap.descricao] : '';
            const rawValor = colMap.valor >= 0 ? row[colMap.valor] : '0';

            const parsedDate = parseDate(rawDate);
            const parsedValor = parseMonetaryValue(rawValor);

            if (!parsedDate) continue; // Pula linhas sem data válida

            // Filtrar aplicações/resgates de investimento se solicitado
            const combinedText = `${rawHist} ${rawDesc}`.toLowerCase();
            if (skipApplications) {
                if (combinedText.includes('aplicação') || combinedText.includes('aplicacao') ||
                    combinedText.includes('resgate') || combinedText.includes('cdb') ||
                    combinedText.includes('tesouro') || combinedText.includes('lci') ||
                    combinedText.includes('lca') || combinedText.includes('fundo')) {
                    continue;
                }
            }

            const tipo = detectTipoFromRow(rawHist, rawDesc, parsedValor);
            const descFull = rawDesc || rawHist || 'Sem descrição';
            const cat = categorizeDeterministic(tipo, rawHist, rawDesc);

            const tx = {
                idx,
                data: parsedDate,
                tipo,
                valor: Math.abs(parsedValor),
                desc: descFull,
                historico: rawHist,
                categoria: cat ? cat.categoria : null,
                subcategoria: cat ? cat.subcategoria : null,
            };

            transactions.push(tx);

            // Se não categorizou deterministicamente, marca para IA
            if (!cat) {
                needsAICategorization.push(tx);
            }
        }

        console.log(`[CSV-Import] ${transactions.length} transações parseadas | ${needsAICategorization.length} precisam de IA para categorização`);

        // FASE 6: Usar IA APENAS para os itens que não foram categorizados
        if (needsAICategorization.length > 0 && groqKey) {
            // Agrupa em batches de 30 para otimizar tokens
            const batchSize = 30;
            const batches = [];
            for (let i = 0; i < needsAICategorization.length; i += batchSize) {
                batches.push(needsAICategorization.slice(i, i + batchSize));
            }

            for (const batch of batches) {
                const itemsForAI = batch.map((tx, i) => `${i}|${tx.tipo}|${tx.historico}|${tx.desc}`).join('\n');

                const aiPrompt = `Você é um classificador financeiro inteligente. Categorize cada transação bancária abaixo pela DESCRIÇÃO (nome da pessoa, empresa ou estabelecimento).

REGRAS IMPORTANTES:
- A coluna "descricao" contém o NOME do destinatário/remetente do Pix, ou o nome do estabelecimento
- Use o nome para inferir a categoria. Exemplos:
  • Nomes de pessoas (ex: "João Silva", "Maria Santos") → provavelmente Outras Despesas/Transferência Pessoal ou Outras Receitas/Transferência Pessoal
  • Restaurantes, padarias, bares, mercados, "food", "sabor", "gourmet" → Alimentação
  • Farmácias, drogarias, hospitais → Saúde
  • Postos de combustível, uber, 99 → Transporte
  • Lojas de roupa, calçados → Vestuário
  • Netflix, Spotify, cinema, games → Lazer
  • Empresas/CNPJ comercial genérico → Outras Despesas/Compra

Formato: index|tipo|historico|descricao

Categorias Receita: Salário, Freelance, Rendimentos, Vendas, Restituição, Bônus, Outras Receitas
Categorias Despesa: Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Vestuário, Tecnologia, Assinaturas, Outras Despesas

Retorne APENAS JSON: {"items":[{"i":0,"c":"Categoria","s":"Subcategoria curta"},...]}

Dados:
${itemsForAI}`;

                try {
                    const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${groqKey}`
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                { role: 'system', content: 'Classificador financeiro brasileiro expert. Analise o NOME do estabelecimento/pessoa na descrição para inferir a categoria correta. Retorne APENAS JSON válido.' },
                                { role: 'user', content: aiPrompt }
                            ],
                            temperature: 0.15,
                            max_tokens: 1024,
                            response_format: { type: "json_object" }
                        })
                    });

                    if (aiRes.ok) {
                        const aiData = await aiRes.json();
                        const raw = aiData.choices?.[0]?.message?.content || '';

                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed.items && Array.isArray(parsed.items)) {
                                parsed.items.forEach(item => {
                                    const tx = batch[item.i];
                                    if (tx) {
                                        tx.categoria = item.c || (tx.tipo === 'Receita' ? 'Outras Receitas' : 'Outras Despesas');
                                        tx.subcategoria = item.s || tx.desc;
                                    }
                                });
                            }
                            console.log(`[CSV-Import] IA categorizou ${parsed.items?.length || 0} itens | Tokens: ${aiData.usage?.total_tokens || '?'}`);
                        } catch (parseErr) {
                            console.warn('[CSV-Import] IA retornou JSON inválido, usando fallback');
                        }
                    }
                } catch (aiErr) {
                    console.error('[CSV-Import] Erro na IA:', aiErr.message);
                }
            }

            // Fallback final: itens que ainda não categorizaram recebem categoria genérica
            needsAICategorization.forEach(tx => {
                if (!tx.categoria) {
                    tx.categoria = tx.tipo === 'Receita' ? 'Outras Receitas' : 'Outras Despesas';
                    tx.subcategoria = tx.desc;
                }
            });
        } else if (needsAICategorization.length > 0) {
            // Sem chave de IA: fallback genérico
            needsAICategorization.forEach(tx => {
                tx.categoria = tx.tipo === 'Receita' ? 'Outras Receitas' : 'Outras Despesas';
                tx.subcategoria = tx.desc;
            });
        }

        // FASE 7: Formatar para o schema do sistema (db_fluxo)
        const result = transactions.map(tx => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
            data: tx.data,
            tipo: tx.tipo,
            categoria: tx.categoria,
            subcategoria: tx.subcategoria,
            valor: tx.valor,
            desc: tx.desc
        }));

        console.log(`[CSV-Import] ✅ ${result.length} transações prontas para importação`);

        res.json({
            success: true,
            totalLinhas: dataLines.length,
            totalProcessadas: result.length,
            totalIA: needsAICategorization.length,
            totalDeterministic: transactions.length - needsAICategorization.length,
            transactions: result,
            summary: {
                receitas: result.filter(t => t.tipo === 'Receita').length,
                despesas: result.filter(t => t.tipo === 'Despesa').length,
                totalReceita: result.filter(t => t.tipo === 'Receita').reduce((s, t) => s + t.valor, 0),
                totalDespesa: result.filter(t => t.tipo === 'Despesa').reduce((s, t) => s + t.valor, 0),
            }
        });

    } catch (err) {
        console.error('[CSV-Import] Erro geral:', err);
        res.status(500).json({ error: 'Falha ao processar CSV', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
