document.addEventListener('AppReady', () => {
// Inicializa os ícones do Lucide
lucide.createIcons();

// INJETAR DADOS DE TESTE CASO ESTEJA VAZIO
// Removido para priorizar dados do Supabase/Backend


//---------------------------------------------------------
// Background Particles & Depth Effects - Premium UI
//---------------------------------------------------------
const canvas = document.getElementById('bg-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });

    function resizeCanvas() {
        let dpr = window.devicePixelRatio || 1;
        dpr = Math.min(dpr, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * window.innerWidth;
            this.y = Math.random() * window.innerHeight;
            this.size = Math.random() * 2 + 0.5;
            this.baseSpeedX = (Math.random() - 0.5) * 0.4;
            this.baseSpeedY = (Math.random() - 0.5) * 0.4;
            this.vx = this.baseSpeedX;
            this.vy = this.baseSpeedY;
            this.alpha = Math.random() * 0.5 + 0.1;
            this.pulseSpeed = Math.random() * 0.02 + 0.005;
            this.zOffset = Math.random();
        }
        update(mouseX, mouseY) {
            this.x += this.vx;
            this.y += this.vy;
            if (mouseX && mouseY) {
                const dx = (window.innerWidth / 2 - mouseX) * this.zOffset * 0.0005;
                const dy = (window.innerHeight / 2 - mouseY) * this.zOffset * 0.0005;
                this.x += dx;
                this.y += dy;
            }
            if (this.x < -10) this.x = window.innerWidth + 10;
            if (this.x > window.innerWidth + 10) this.x = -10;
            if (this.y < -10) this.y = window.innerHeight + 10;
            if (this.y > window.innerHeight + 10) this.y = -10;

            this.alpha += Math.sin(Date.now() * this.pulseSpeed) * 0.01;
            if (this.alpha > 0.8) this.alpha = 0.8;
            if (this.alpha < 0.1) this.alpha = 0.1;
        }
        draw(ctx) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 229, 255, ${this.alpha * 0.35})`;
            ctx.fill();
        }
    }

    const particleCount = Math.min(window.innerWidth / 20, 80);
    const particles = [];
    for (let i = 0; i < particleCount; i++) particles.push(new Particle());

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

    function animate() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        particles.forEach(p => { p.update(mouseX, mouseY); p.draw(ctx); });
        drawStaticAmbience(ctx);
        requestAnimationFrame(animate);
    }

    function drawStaticAmbience(ctx) {
        const grd1 = ctx.createRadialGradient(
            window.innerWidth * 0.1, window.innerHeight * 0.9, 0,
            window.innerWidth * 0.1, window.innerHeight * 0.9, 400
        );
        grd1.addColorStop(0, 'rgba(124, 107, 255, 0.06)');
        grd1.addColorStop(1, 'rgba(124, 107, 255, 0)');

        ctx.fillStyle = grd1;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        const grd2 = ctx.createRadialGradient(
            window.innerWidth * 0.8, window.innerHeight * 0.2, 0,
            window.innerWidth * 0.8, window.innerHeight * 0.2, 500
        );
        grd2.addColorStop(0, 'rgba(0, 229, 255, 0.04)');
        grd2.addColorStop(1, 'rgba(0, 229, 255, 0)');

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grd2;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.globalCompositeOperation = 'source-over';
    }

    animate();
}

//---------------------------------------------------------
// Tab Switching
//---------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabParent = btn.closest('.tabs-container');
        if (!tabParent) return;
        tabParent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Hide all tab contents
        const targetId = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(targetId).classList.add('active');
    });
});

//---------------------------------------------------------
// DB Utils (Local Storage)
//---------------------------------------------------------
const DB = {
    get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
    save: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    add: (key, item) => {
        const data = DB.get(key);
        item.id = Date.now().toString();
        data.push(item);
        DB.save(key, data);
        alert('Cadastrado com sucesso!');
    },
    remove: (key, id) => {
        let data = DB.get(key);
        data = data.filter(i => i.id !== id);
        DB.save(key, data);
    }
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

//---------------------------------------------------------
// Logic: Cadastro.html
//---------------------------------------------------------

if (document.getElementById('form-fluxo')) {

    // Toggle Receita/Despesa logic
    document.querySelectorAll('#fluxo .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#fluxo .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tipo = btn.getAttribute('data-type');
            document.getElementById('fluxo-tipo').value = tipo;
            updateFluxoCategorias(tipo);
        });
    });

    const catReceita = ["Salário", "Freelance", "Rendimentos", "Vendas", "Restituição", "Bônus", "Outras Receitas"];
    const catDespesa = ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Outras Despesas"];

    function updateFluxoCategorias(tipo) {
        const select = document.getElementById('fluxo-categoria');
        if (select) {
            select.innerHTML = '';
            const cats = tipo === 'Receita' ? catReceita : catDespesa;
            cats.forEach(c => {
                select.innerHTML += `<option value="${c}">${c}</option>`;
            });
        }

        // Também atualiza o select de cartão (que é sempre despesa)
        const selectCartao = document.getElementById('cartao-categoria');
        if (selectCartao) {
            selectCartao.innerHTML = '';
            catDespesa.forEach(c => {
                selectCartao.innerHTML += `<option value="${c}">${c}</option>`;
            });
        }
    }
    // Init
    updateFluxoCategorias('Receita');

    // Populate Datalist
    function populateSubs() {
        const dl = document.getElementById('subs-list');
        if (dl) {
            dl.innerHTML = '';
            const subs = [...new Set(DB.get('db_fluxo').map(d => d.subcategoria).filter(Boolean))];
            subs.forEach(s => dl.innerHTML += `<option value="${s}">`);
        }

        const dlCartao = document.getElementById('subs-list-cartao');
        if (dlCartao) {
            dlCartao.innerHTML = '';
            const subsCartao = [...new Set(DB.get('db_cartao').map(d => d.subcategoria).filter(Boolean))];
            subsCartao.forEach(s => dlCartao.innerHTML += `<option value="${s}">`);
        }
    }
    populateSubs();

    document.getElementById('form-fluxo').addEventListener('submit', (e) => {
        e.preventDefault();
        DB.add('db_fluxo', {
            data: document.getElementById('fluxo-data').value,
            tipo: document.getElementById('fluxo-tipo').value,
            categoria: document.getElementById('fluxo-categoria').value,
            subcategoria: document.getElementById('fluxo-subcategoria').value,
            valor: parseFloat(document.getElementById('fluxo-valor').value || 0),
            desc: document.getElementById('fluxo-desc').value
        });
        e.target.reset();
        updateFluxoCategorias('Receita');
        document.querySelector('#fluxo .toggle-btn.receita').click();
        populateSubs(); // update list
    });

    // =========================================================
    // IMPORTADOR DE EXTRATO BANCÁRIO CSV
    // =========================================================
    const btnCsvImport = document.getElementById('btn-csv-import');
    const csvFileInput = document.getElementById('csv-extrato-input');
    const csvOverlay = document.getElementById('csv-modal-overlay');
    const csvLoading = document.getElementById('csv-loading');
    const csvResult = document.getElementById('csv-result');
    const csvModalClose = document.getElementById('csv-modal-close');
    const csvBtnCancel = document.getElementById('csv-btn-cancel');
    const csvBtnConfirm = document.getElementById('csv-btn-confirm');
    const csvCheckAll = document.getElementById('csv-check-all');
    const csvSkipApps = document.getElementById('csv-skip-apps');

    let csvPendingTransactions = [];
    let csvRawContent = '';

    if (btnCsvImport) {
        // Abrir file picker ao clicar no botão
        btnCsvImport.addEventListener('click', () => {
            csvFileInput.click();
        });

        // Quando arquivo é selecionado
        csvFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.csv')) {
                alert('Por favor, selecione um arquivo CSV.');
                return;
            }

            // Ler conteúdo do arquivo
            const reader = new FileReader();
            reader.onload = async (evt) => {
                csvRawContent = evt.target.result;
                await processCSV(csvRawContent, csvSkipApps.checked);
            };
            reader.readAsText(file, 'UTF-8');
            e.target.value = ''; // Reset input
        });

        // Processar CSV via backend
        async function processCSV(content, skipApps) {
            // Abrir modal com loading
            csvOverlay.classList.add('active');
            csvLoading.style.display = 'flex';
            csvResult.style.display = 'none';

            const token = localStorage.getItem('auth_token') || '';

            try {
                const res = await fetch('http://localhost:3001/api/csv-import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        csvContent: content,
                        skipApplications: skipApps
                    })
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Falha ao processar CSV');
                }

                const data = await res.json();
                csvPendingTransactions = data.transactions || [];

                // Atualizar UI de resultados
                renderCSVPreview(data);

            } catch (err) {
                csvOverlay.classList.remove('active');
                alert(`Erro ao importar CSV: ${err.message}`);
            }
        }

        // Renderizar preview dos resultados
        function renderCSVPreview(data) {
            csvLoading.style.display = 'none';
            csvResult.style.display = 'block';

            const fmtCur = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            const fmtDate = (d) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };

            // Subtitle
            document.getElementById('csv-modal-subtitle').textContent =
                `${data.totalProcessadas} transações identificadas no extrato`;

            // Summary cards
            document.getElementById('csv-sum-total').textContent = data.totalProcessadas;
            document.getElementById('csv-sum-receita').textContent = fmtCur(data.summary.totalReceita);
            document.getElementById('csv-sum-receita-count').textContent = `${data.summary.receitas} itens`;
            document.getElementById('csv-sum-despesa').textContent = fmtCur(data.summary.totalDespesa);
            document.getElementById('csv-sum-despesa-count').textContent = `${data.summary.despesas} itens`;
            document.getElementById('csv-sum-ia').textContent = data.totalIA;
            document.getElementById('csv-sum-det').textContent = `${data.totalDeterministic} determinísticas`;

            // Table
            const tbody = document.getElementById('csv-preview-tbody');
            tbody.innerHTML = '';

            csvPendingTransactions.forEach((tx, idx) => {
                tbody.innerHTML += `
                    <tr>
                        <td style="text-align:center;">
                            <input type="checkbox" class="csv-row-check" data-idx="${idx}" checked>
                        </td>
                        <td>${fmtDate(tx.data)}</td>
                        <td>
                            <span class="${tx.tipo === 'Receita' ? 'badge-csv-receita' : 'badge-csv-despesa'}">
                                ${tx.tipo}
                            </span>
                        </td>
                        <td>
                            <b>${tx.categoria}</b><br>
                            <small style="color:var(--text-light)">${tx.subcategoria}</small>
                        </td>
                        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${tx.desc}">
                            ${tx.desc}
                        </td>
                        <td class="${tx.tipo === 'Receita' ? 'csv-valor-receita' : 'csv-valor-despesa'}">
                            ${fmtCur(tx.valor)}
                        </td>
                    </tr>
                `;
            });

            // Reset check all
            csvCheckAll.checked = true;
            lucide.createIcons();
        }

        // Check all toggle
        if (csvCheckAll) {
            csvCheckAll.addEventListener('change', (e) => {
                document.querySelectorAll('.csv-row-check').forEach(c => c.checked = e.target.checked);
            });
        }

        // Reprocessar quando muda opção de filtrar investimentos
        if (csvSkipApps) {
            csvSkipApps.addEventListener('change', async () => {
                if (csvRawContent) {
                    await processCSV(csvRawContent, csvSkipApps.checked);
                }
            });
        }

        // Fechar modal
        function closeCSVModal() {
            csvOverlay.classList.remove('active');
            csvPendingTransactions = [];
        }

        if (csvModalClose) csvModalClose.addEventListener('click', closeCSVModal);
        if (csvBtnCancel) csvBtnCancel.addEventListener('click', closeCSVModal);

        // Fechar ao clicar fora
        csvOverlay.addEventListener('click', (e) => {
            if (e.target === csvOverlay) closeCSVModal();
        });

        // Confirmar importação
        if (csvBtnConfirm) {
            csvBtnConfirm.addEventListener('click', () => {
                const selectedChecks = document.querySelectorAll('.csv-row-check:checked');
                if (selectedChecks.length === 0) {
                    alert('Selecione pelo menos uma transação para importar.');
                    return;
                }

                // Coletar índices selecionados
                const selectedIndexes = new Set();
                selectedChecks.forEach(c => selectedIndexes.add(parseInt(c.getAttribute('data-idx'))));

                // Inserir no db_fluxo
                const fluxoData = DB.get('db_fluxo');
                let imported = 0;

                csvPendingTransactions.forEach((tx, idx) => {
                    if (selectedIndexes.has(idx)) {
                        fluxoData.push({
                            id: tx.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            data: tx.data,
                            tipo: tx.tipo,
                            categoria: tx.categoria,
                            subcategoria: tx.subcategoria,
                            valor: tx.valor,
                            desc: tx.desc
                        });
                        imported++;
                    }
                });

                DB.save('db_fluxo', fluxoData);
                closeCSVModal();
                populateSubs();

                // Toast de sucesso
                showCSVToast(`✅ ${imported} transações importadas com sucesso!`);
            });
        }

        function showCSVToast(message) {
            // Remover toast anterior
            document.querySelectorAll('.csv-toast').forEach(t => t.remove());

            const toast = document.createElement('div');
            toast.className = 'csv-toast';
            toast.innerHTML = message;
            document.body.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 500);
            }, 4000);
        }
    }
    // =========== FIM IMPORTADOR CSV ===========

    // Cartao Logic
    document.querySelectorAll('#cartao .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#cartao .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tipo = btn.getAttribute('data-type');
            document.getElementById('cartao-tipo').value = tipo;

            if (tipo === 'Parcela') {
                document.getElementById('cartao-parcelas-container').style.display = 'flex';
                document.getElementById('cartao-fatura-container').style.display = 'none';
            } else {
                document.getElementById('cartao-parcelas-container').style.display = 'none';
                document.getElementById('cartao-fatura-container').style.display = 'flex';
            }
        });
    });

    document.getElementById('form-cartao').addEventListener('submit', (e) => {
        e.preventDefault();
        DB.add('db_cartao', {
            data: document.getElementById('cartao-data').value,
            tipo: document.getElementById('cartao-tipo').value,
            cartao: document.getElementById('cartao-nome').value,
            categoria: document.getElementById('cartao-categoria').value,
            subcategoria: document.getElementById('cartao-subcategoria').value,
            parcelas: document.getElementById('cartao-qtd-parcelas').value,
            valorParcela: parseFloat(document.getElementById('cartao-valor-parcela').value || 0),
            valorFatura: parseFloat(document.getElementById('cartao-valor-fatura').value || 0),
            desc: document.getElementById('cartao-desc').value
        });
        e.target.reset();
        populateSubs();
        updateFluxoCategorias('Receita');
    });

    // Metas Logic
    document.getElementById('form-metas').addEventListener('submit', (e) => {
        e.preventDefault();
        DB.add('db_metas', {
            nome: document.getElementById('meta-nome').value,
            valorObjetivo: parseFloat(document.getElementById('meta-valor').value || 0),
            valorAtual: parseFloat(document.getElementById('meta-valor-inicial').value || 0),
            dataLimite: document.getElementById('meta-datalimite').value
        });
        e.target.reset();
        loadMetasSelect();
    });

    function loadMetasSelect() {
        const select = document.getElementById('meta-update-select');
        const metas = DB.get('db_metas');
        select.innerHTML = '<option value="">Selecione a Meta</option>';
        metas.forEach(m => {
            select.innerHTML += `<option value="${m.id}">${m.nome} (Faltam ${formatCurrency(m.valorObjetivo - m.valorAtual)})</option>`;
        });
    }
    loadMetasSelect();

    document.getElementById('form-metas-update').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('meta-update-select').value;
        const valorAdd = parseFloat(document.getElementById('meta-update-valor').value || 0);
        if (!id) return alert('Selecione uma meta.');

        let metas = DB.get('db_metas');
        let meta = metas.find(m => m.id === id);
        if (meta) {
            meta.valorAtual += valorAdd;
            DB.save('db_metas', metas);
            alert('Meta atualizada!');
            e.target.reset();
            loadMetasSelect();
        }
    });

    // Investimentos Logic
    const investFixa = ["CDB", "Tesouro Direto", "LCI / LCA", "Debêntures", "Outros (Fixa)"];
    const investVariavel = ["Ações", "FIIs (Fundos Imobiliários)", "ETFs", "BDRs", "Criptomoedas", "Imóveis", "Outros (Variável)"];

    document.querySelectorAll('#invest .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#invest .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tipo = btn.getAttribute('data-type');
            document.getElementById('invest-tipo').value = tipo;
            updateInvestAtivos(tipo);
        });
    });

    function updateInvestFields() {
        const ativo = document.getElementById('invest-ativo').value;
        const divManual = document.getElementById('div-invest-manual');
        const divMercado = document.getElementById('div-invest-mercado');
        const divImovel = document.getElementById('div-invest-imovel');

        divManual.style.display = 'none';
        divMercado.style.display = 'none';
        divImovel.style.display = 'none';

        if (['Ações', 'FIIs (Fundos Imobiliários)', 'ETFs', 'BDRs', 'Criptomoedas'].includes(ativo)) {
            divMercado.style.display = 'flex';
        } else if (ativo === 'Imóveis') {
            divImovel.style.display = 'flex';
        } else {
            divManual.style.display = 'flex';
        }
    }

    function updateInvestAtivos(tipo) {
        const select = document.getElementById('invest-ativo');
        select.innerHTML = '';
        const ativos = tipo === 'Renda Fixa' ? investFixa : investVariavel;
        ativos.forEach(a => {
            select.innerHTML += `<option value="${a}">${a}</option>`;
        });
        updateInvestFields();
    }

    document.getElementById('invest-ativo').addEventListener('change', updateInvestFields);
    updateInvestAtivos('Renda Fixa');

    document.getElementById('form-invest').addEventListener('submit', (e) => {
        e.preventDefault();
        const ativo = document.getElementById('invest-ativo').value;

        let aporte = 0;
        let acumulado = 0;
        let objExtra = {};

        if (['Ações', 'FIIs (Fundos Imobiliários)', 'ETFs', 'BDRs', 'Criptomoedas'].includes(ativo)) {
            const preco = parseFloat(document.getElementById('invest-preco').value || 0);
            const qtd = parseFloat(document.getElementById('invest-quantidade').value || 0);
            aporte = preco * qtd;
            // Acumulado inicial igual ao aporte, deixaremos que a API atualize os preços deps
            acumulado = aporte;
            objExtra = {
                ticker: document.getElementById('invest-ticker').value.toUpperCase(),
                buy_price: preco,
                quantity: qtd
            };
        } else if (ativo === 'Imóveis') {
            const entrada = parseFloat(document.getElementById('invest-entrada').value || 0);
            const parcela = parseFloat(document.getElementById('invest-parcela').value || 0);
            const qtdParcelas = parseInt(document.getElementById('invest-qtd-parcelas').value || 0);
            aporte = entrada + (parcela * qtdParcelas);
            acumulado = aporte;
            objExtra = {
                entrada: entrada,
                vl_parcela: parcela,
                qtd_parcelas: qtdParcelas
            };
        } else {
            aporte = parseFloat(document.getElementById('invest-aporte').value || 0);
            acumulado = parseFloat(document.getElementById('invest-acumulado').value || 0);
            if (acumulado === 0) acumulado = aporte; // Fallback
        }

        DB.add('db_invest', {
            data: document.getElementById('invest-data').value,
            tipo: document.getElementById('invest-tipo').value,
            ativo: ativo,
            nome: document.getElementById('invest-nome').value,
            inst: document.getElementById('invest-inst').value,
            aporte: aporte,
            acumulado: acumulado,
            ...objExtra
        });
        e.target.reset();
        // Reset logic to default
        updateInvestAtivos(document.getElementById('invest-tipo').value);
    });

    // === LOGICA CONFIG CARTAO ===
    const formConfig = document.getElementById('form-config-cartao');
    if (formConfig) {
        const slotSelect = document.getElementById('config-cartao-slot');
        const loadSlotInfo = () => {
            const configs = DB.get('db_cartoes_config') || [];
            const cfg = configs.find(c => c.slot === slotSelect.value);
            if (cfg) {
                document.getElementById('config-cartao-banco').value = cfg.banco;
                document.getElementById('config-cartao-limite').value = cfg.limite;
                document.getElementById('config-cartao-final').value = cfg.final;
                document.getElementById('config-cartao-apelido').value = cfg.apelido;
            } else {
                document.getElementById('config-cartao-banco').value = 'nubank';
                document.getElementById('config-cartao-limite').value = '';
                document.getElementById('config-cartao-final').value = '';
                document.getElementById('config-cartao-apelido').value = '';
            }
        };
        slotSelect.addEventListener('change', loadSlotInfo);
        loadSlotInfo();

        formConfig.addEventListener('submit', (e) => {
            e.preventDefault();
            const configs = DB.get('db_cartoes_config') || [];
            const slot = slotSelect.value;
            const newCfg = {
                slot: slot,
                banco: document.getElementById('config-cartao-banco').value,
                limite: parseFloat(document.getElementById('config-cartao-limite').value) || 0,
                final: document.getElementById('config-cartao-final').value,
                apelido: document.getElementById('config-cartao-apelido').value
            };
            const idx = configs.findIndex(c => c.slot === slot);
            if (idx > -1) configs[idx] = newCfg;
            else configs.push(newCfg);

            DB.save('db_cartoes_config', configs);
            alert(`${slot} atualizado com sucesso! Acesse o dashboard 'Cartões' para ver as mudanças o/`);
        });
    }

}

//---------------------------------------------------------
// Logic: Dados.html
//---------------------------------------------------------
if (document.getElementById('tbody-fluxo')) {

    window.excluirDado = function (dbKey, id) {
        if (confirm('Deseja realmente excluir este lançamento?')) {
            DB.remove(dbKey, id);
            renderTables();
        }
    };

    window.editarDado = function (dbKey, id) {
        let data = DB.get(dbKey);
        let index = data.findIndex(i => i.id === id);
        if (index > -1) {
            let item = data[index];
            let currentValor = item.valor || item.valorObjetivo || item.aporte || item.valorParcela || item.valorFatura || '';
            let currentNome = item.desc || item.nome || item.ativo || item.categoria || '';

            // Construir modal rica direto pelo DOM para não usar prompt horrível do navegador
            let overlay = document.createElement('div');
            overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;";
            
            let modal = document.createElement('div');
            modal.className = "glass-panel";
            modal.style.cssText = "width: 400px; padding: 24px; border-radius: 20px; display: flex; flex-direction: column; gap: 16px;";
            
            modal.innerHTML = `
                <h3 style="margin:0; font-size:18px;">Editar Registro</h3>
                <label>Nome / Descrição:
                    <input type="text" id="edit-nome" class="form-input" value="${currentNome}">
                </label>
                <label>Valor:
                    <input type="number" id="edit-val" class="form-input" value="${currentValor}" step="0.01">
                </label>
                <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:10px;">
                    <button class="btn-outline" id="edit-cancel">Cancelar</button>
                    <button class="btn-primary" id="edit-save">Salvar</button>
                </div>
            `;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            document.getElementById('edit-cancel').onclick = () => overlay.remove();
            document.getElementById('edit-save').onclick = () => {
                let nNome = document.getElementById('edit-nome').value;
                let nValor = parseFloat(document.getElementById('edit-val').value.replace(',', '.'));
                
                if (!isNaN(nValor)) {
                    if (item.valor !== undefined) item.valor = nValor;
                    if (item.valorObjetivo !== undefined) item.valorObjetivo = nValor;
                    if (item.aporte !== undefined) item.aporte = nValor;
                    if (item.valorParcela !== undefined) item.valorParcela = nValor;
                    if (item.valorFatura !== undefined) item.valorFatura = nValor;
                }
                if (nNome) {
                    if (item.desc !== undefined) item.desc = nNome;
                    if (item.nome !== undefined) item.nome = nNome;
                    if (item.ativo !== undefined) item.ativo = nNome;
                }
                
                data[index] = item;
                DB.save(dbKey, data);
                renderTables();
                overlay.remove();
            };
        }
    };

    function renderTables() {
        // Fluxo
        const tFluxo = document.getElementById('tbody-fluxo');
        tFluxo.innerHTML = '';
        DB.get('db_fluxo').reverse().forEach(i => {
            tFluxo.innerHTML += `
                <tr>
                    <td style="text-align: center;"><input type="checkbox" class="check-row" value="${i.id}" data-target="db_fluxo"></td>
                    <td>${formatDate(i.data)}</td>
                    <td><b>${i.categoria}</b><br><small>${i.subcategoria || '-'}</small></td>
                    <td>${i.desc || '-'}</td>
                    <td><span class="badge ${i.tipo === 'Receita' ? 'receita' : 'despesa'}">${formatCurrency(i.valor)}</span></td>
                    <td class="action-btns" style="text-align: right;">
                        <button class="btn-icon edit" onclick="editarDado('db_fluxo', '${i.id}')" title="Editar"><i data-lucide="edit-3" style="width:18px"></i></button>
                        <button class="btn-icon delete" onclick="excluirDado('db_fluxo', '${i.id}')" title="Excluir"><i data-lucide="trash-2" style="width:18px"></i></button>
                    </td>
                </tr>
            `;
        });

        // Cartao
        const tCartao = document.getElementById('tbody-cartao');
        tCartao.innerHTML = '';
        DB.get('db_cartao').reverse().forEach(i => {
            let info = i.tipo === 'Parcela' ? `${i.parcelas}x Parcelado` : i.desc;
            let val = i.tipo === 'Parcela' ? i.valorParcela : i.valorFatura;
            tCartao.innerHTML += `
                <tr>
                    <td style="text-align: center;"><input type="checkbox" class="check-row" value="${i.id}" data-target="db_cartao"></td>
                    <td>${formatDate(i.data)}</td>
                    <td><b>${i.tipo}</b></td>
                    <td><span class="badge" style="background:rgba(124,107,255,0.12);color:#7C6BFF">${i.cartao || 'Cartão 1'}</span></td>
                    <td>${info}</td>
                    <td><span class="badge despesa">${formatCurrency(val)}</span></td>
                    <td class="action-btns" style="text-align: right;">
                        <button class="btn-icon edit" onclick="editarDado('db_cartao', '${i.id}')" title="Editar"><i data-lucide="edit-3" style="width:18px"></i></button>
                        <button class="btn-icon delete" onclick="excluirDado('db_cartao', '${i.id}')" title="Excluir"><i data-lucide="trash-2" style="width:18px"></i></button>
                    </td>
                </tr>
            `;
        });

        // Metas
        const tMetas = document.getElementById('tbody-metas');
        tMetas.innerHTML = '';
        DB.get('db_metas').reverse().forEach(i => {
            let percent = ((i.valorAtual / i.valorObjetivo) * 100).toFixed(1);
            tMetas.innerHTML += `
                <tr>
                    <td style="text-align: center;"><input type="checkbox" class="check-row" value="${i.id}" data-target="db_metas"></td>
                    <td><b>${i.nome}</b></td>
                    <td><div style="background:rgba(255,255,255,0.06);border-radius:10px;width:100%;height:8px;overflow:hidden"><div style="background:var(--primary);width:${percent}%;height:100%;"></div></div><small>${percent}%</small></td>
                    <td><span style="color:var(--highlight)">${formatCurrency(i.valorAtual)}</span></td>
                    <td>${formatCurrency(i.valorObjetivo)}</td>
                    <td>${formatDate(i.dataLimite)}</td>
                    <td class="action-btns" style="text-align: right;">
                        <button class="btn-icon edit" onclick="editarDado('db_metas', '${i.id}')" title="Editar"><i data-lucide="edit-3" style="width:18px"></i></button>
                        <button class="btn-icon delete" onclick="excluirDado('db_metas', '${i.id}')" title="Excluir"><i data-lucide="trash-2" style="width:18px"></i></button>
                    </td>
                </tr>
            `;
        });

        // Invest
        const tInvest = document.getElementById('tbody-invest');
        tInvest.innerHTML = '';
        DB.get('db_invest').reverse().forEach(i => {
            tInvest.innerHTML += `
                <tr>
                    <td style="text-align: center;"><input type="checkbox" class="check-row" value="${i.id}" data-target="db_invest"></td>
                    <td>${formatDate(i.data)}</td>
                    <td><b>${i.ativo}</b><br><small>${i.tipo}</small></td>
                    <td>${i.inst || '-'}</td>
                    <td>${formatCurrency(i.aporte)}</td>
                    <td><b>${formatCurrency(i.acumulado || i.aporte)}</b></td>
                    <td class="action-btns" style="text-align: right;">
                        <button class="btn-icon edit" onclick="editarDado('db_invest', '${i.id}')" title="Editar"><i data-lucide="edit-3" style="width:18px"></i></button>
                        <button class="btn-icon delete" onclick="excluirDado('db_invest', '${i.id}')" title="Excluir"><i data-lucide="trash-2" style="width:18px"></i></button>
                    </td>
                </tr>
            `;
        });

        lucide.createIcons(); // reload icons on new HTML
        updateBulkCount(); // reseta checkboxes logic
    }
    renderTables();

    // ── LÓGICA DE EXCLUSÃO EM MASSA (BULK) ──
    function updateBulkCount() {
        const checked = document.querySelectorAll('.check-row:checked');
        const count = checked.length;
        const btn = document.getElementById('btn-bulk-delete');
        if (btn) {
            btn.style.display = count > 0 ? 'inline-flex' : 'none';
            document.getElementById('bulk-count').innerText = count;
        }
    }

    // Toggle All em cada aba
    document.querySelectorAll('.check-all').forEach(checkAll => {
        checkAll.addEventListener('change', (e) => {
            const table = e.target.closest('table');
            const rowChecks = table.querySelectorAll('.check-row');
            rowChecks.forEach(c => c.checked = e.target.checked);
            updateBulkCount();
        });
    });

    // Toggle indíviduo
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('check-row')) {
            updateBulkCount();
            
            // Check Se o check-all deve desmarcar ou marcar
            const table = e.target.closest('table');
            const allChecks = table.querySelectorAll('.check-row');
            const checkAll = table.querySelector('.check-all');
            const everyChecked = Array.from(allChecks).every(c => c.checked);
            if (checkAll) checkAll.checked = everyChecked;
        }
    });

    // Excluir em Lote
    const btnBulk = document.getElementById('btn-bulk-delete');
    if (btnBulk) {
        btnBulk.addEventListener('click', () => {
            const checked = document.querySelectorAll('.check-row:checked');
            if (checked.length === 0) return;
            if (confirm(`Atenção: Deseja excluir definitivamente os ${checked.length} itens selecionados?`)) {
                checked.forEach(box => {
                    const dbKey = box.getAttribute('data-target');
                    const id = box.value;
                    DB.remove(dbKey, id);
                });
                
                // Desmarcar todos os header checkbox
                document.querySelectorAll('.check-all').forEach(c => c.checked = false);
                
                renderTables();
            }
        });
    }

    // Export Full Schema CSV
    document.getElementById('btn-export').addEventListener('click', () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ['dbType','id','data','tipo','categoria','subcategoria','valor','desc','cartao','parcelas','valorParcela','valorFatura','nome','valorObjetivo','valorAtual','dataLimite','ativo','qtd','precoMedio','aporte','inst'];
        
        csvContent += headers.join(',') + "\\n";

        const processRow = (dbType, obj) => {
            return headers.map(h => {
                if (h === 'dbType') return dbType;
                let val = obj[h] || '';
                // formatar strings pra retirar vírgulas ou quebras
                if (typeof val === 'string') val = `"${val.replace(/"/g, '""').replace(/\\n/g, ' ')}"`;
                return val;
            }).join(',');
        };

        DB.get('db_fluxo').forEach(i => csvContent += processRow('db_fluxo', i) + "\\n");
        DB.get('db_cartao').forEach(i => csvContent += processRow('db_cartao', i) + "\\n");
        DB.get('db_metas').forEach(i => csvContent += processRow('db_metas', i) + "\\n");
        DB.get('db_invest').forEach(i => csvContent += processRow('db_invest', i) + "\\n");

        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "backup_financeiro_completo.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Import Full Schema CSV
    const importInput = document.getElementById('input-import-csv');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target.result;
                const lines = text.split('\\n').filter(l => l.trim() !== '');
                if (lines.length < 2) return alert("Arquivo vazio ou inválido.");

                // Parse manual para lidar com aspas
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
                let inserts = 0;

                for (let i = 1; i < lines.length; i++) {
                    const row = parseCSVLine(lines[i]);
                    let obj = {};
                    headers.forEach((h, idx) => {
                        let v = row[idx];
                        if (v !== undefined && v !== '') {
                            // auto-convert numbers
                            if (!isNaN(v) && h !== 'data' && h !== 'dataLimite' && h !== 'id') {
                                obj[h] = parseFloat(v);
                            } else {
                                obj[h] = v;
                            }
                        }
                    });

                    const dbType = obj.dbType;
                    if (dbType) {
                        delete obj.dbType;
                        // Avoid duplicates if ID exists, or just overwrite/add
                        let data = DB.get(dbType);
                        if (!obj.id) obj.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                        
                        const existIdx = data.findIndex(d => d.id === obj.id);
                        if (existIdx > -1) {
                            data[existIdx] = { ...data[existIdx], ...obj }; // Merge
                        } else {
                            data.push(obj);
                        }
                        DB.save(dbType, data);
                        inserts++;
                    }
                }
                
                alert(`Importação Completa! ${inserts} registros processados.`);
                renderTables();
                document.dispatchEvent(new Event('AppReady')); // trigger charts update
            };
            reader.readAsText(file);
            e.target.value = ''; // reset
        });
    }
}

}); // Fim AppReady
