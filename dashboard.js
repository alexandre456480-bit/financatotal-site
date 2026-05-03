// dashboard.js — ECharts + KPIs para index.html e cartoes.html
document.addEventListener('AppReady', () => {

    const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 1 }).format(v);
    const FLUXO = JSON.parse(localStorage.getItem('db_fluxo') || '[]');
    const CARTAO = JSON.parse(localStorage.getItem('db_cartao') || '[]');

    // Agrupador genérico (Ordenado)
    const group = (arr, mode) => {
        const sortedArr = [...arr].sort((a, b) => dayjs(a.data).valueOf() - dayjs(b.data).valueOf());
        const m = {};
        sortedArr.forEach(d => {
            let k = '';
            if (mode === 'dia') k = dayjs(d.data).format('DD/MM');
            if (mode === 'semana') k = 'S' + dayjs(d.data).week();
            if (mode === 'mes') k = dayjs(d.data).format('MMM/YY');
            if (mode === 'ano') k = dayjs(d.data).format('YYYY');
            if (!m[k]) m[k] = { rec: 0, desp: 0 };
            if (d.tipo === 'Receita') m[k].rec += d.valor;
            else m[k].desp += d.valor;
        });
        return m;
    };

    // --- CONSOLIDAÇÃO DE DADOS (NOVO) ---
    // Transforma gastos de cartões em "transações virtuais" para o dashboard principal
    const getConsolidatedTransactions = () => {
        let consolidated = [...FLUXO];
        const hoje = dayjs();

        CARTAO.forEach(c => {
            const baseDt = dayjs(c.data);
            if (c.tipo === 'Fatura') {
                // Compra à vista: entra sempre (o controle de exibição por mês é feito pelos gráficos/KPIs)
                consolidated.push({
                    data: c.data,
                    tipo: 'Despesa',
                    categoria: c.categoria || 'Cartão',
                    subcategoria: c.subcategoria || c.desc || 'Compra no Cartão',
                    valor: c.valorFatura || 0,
                    desc: `[${c.cartao}] ${c.desc || ''}`
                });
            } else if (c.tipo === 'Parcela') {
                // Compra parcelada: apenas parcelas cujo mês já chegou (pagas)
                const np = parseInt(c.parcelas) || 1;
                const vp = c.valorParcela || 0;
                for (let i = 0; i < np; i++) {
                    const fDt = baseDt.add(i, 'month');
                    // Apenas se a data da parcela for anterior ou igual ao mês atual (seguindo lógica de Cartões)
                    if (fDt.isBefore(hoje, 'month') || fDt.isSame(hoje, 'month')) {
                        consolidated.push({
                            data: fDt.format('YYYY-MM-DD'),
                            tipo: 'Despesa',
                            categoria: c.categoria || 'Cartão',
                            subcategoria: c.subcategoria || c.desc || 'Parcela Cartão',
                            valor: vp,
                            desc: `Parc ${i + 1}/${np} [${c.cartao}] ${c.desc || ''}`
                        });
                    }
                }
            }
        });
        return consolidated;
    };

    const CONSOLIDADO = getConsolidatedTransactions();

    // Tooltip premium — dark mode
    const tipStyle = { backgroundColor: 'rgba(56, 68, 95, 0.95)', borderColor: 'rgba(255,255,255,0.08)', textStyle: { color: '#E8ECF4', fontSize: 13 }, borderRadius: 12 };

    // Neon glow color helpers — Dark theme
    const neonCyan = ['rgba(0,229,255,0.5)', 'rgba(0,229,255,0)'];
    const neonPink = ['rgba(194, 6, 47, 0.4)', 'rgba(255,107,138,0)'];
    const neonGold = ['rgba(255,215,0,0.35)', 'rgba(255,215,0,0)'];
    const neonPurple = ['rgba(124,107,255,0.45)', 'rgba(124,107,255,0)'];
    const neonSilver = ['rgba(107,122,153,0.25)', 'rgba(107,122,153,0)'];

    const grad = (c) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: c[0] }, { offset: 1, color: c[1] }]);

    // Filter btn wiring
    document.querySelectorAll('.chart-filters').forEach(bar => {
        bar.querySelectorAll('.fbtn').forEach(btn => {
            btn.addEventListener('click', () => {
                bar.querySelectorAll('.fbtn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const t = bar.dataset.target;
                const f = btn.dataset.f;
                if (t === 'fluxo') drawFluxo(f);
                if (t === 'saldo') drawSaldo(f);
                if (t === 'cat') drawCat(f);
                if (t === 'cartao-evo') drawCartaoEvo(f);
            });
        });
    });

    // ===== INDEX.HTML — DASH FINANCEIRO =====
    if (document.getElementById('kpi-saldo')) {
        let globalFilterMonth = 'all';
        let globalFilterYear = 'all';

        // Configurar o Filtro Global (UI)
        const btnFilter = document.getElementById('btn-global-filter');
        const popupFilter = document.getElementById('global-filter-popup');
        const selectYear = document.getElementById('g-filter-year');
        const btnApply = document.getElementById('btn-apply-filter');

        if (btnFilter && popupFilter && selectYear) {
            const currentYearStr = dayjs().format('YYYY');
            for (let y = dayjs().year() - 3; y <= dayjs().year() + 2; y++) {
                selectYear.innerHTML += `<option value="${y}" ${y == currentYearStr ? 'selected' : ''}>${y}</option>`;
            }
            btnFilter.addEventListener('click', () => { popupFilter.style.display = popupFilter.style.display === 'none' ? 'block' : 'none'; });
            document.addEventListener('click', (e) => {
                const btnContainer = btnFilter.parentElement;
                if (btnContainer && !btnContainer.contains(e.target)) popupFilter.style.display = 'none';
            });
            btnApply.addEventListener('click', () => {
                globalFilterMonth = document.getElementById('g-filter-month').value;
                globalFilterYear = document.getElementById('g-filter-year').value;
                popupFilter.style.display = 'none';

                if (globalFilterMonth === 'all') {
                    document.getElementById('label-global-filter').textContent = 'Filtro de Período';
                } else {
                    const mNome = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' };
                    document.getElementById('label-global-filter').textContent = `${mNome[globalFilterMonth]}/${globalFilterYear}`;
                }
                updateDashboardCrossSection();
            });
        }

        const updateDashboardCrossSection = () => {
            let cm = dayjs().format('YYYY-MM');
            let pm = dayjs().subtract(1, 'month').format('YYYY-MM');
            let isFiltered = (globalFilterMonth !== 'all' && globalFilterYear !== 'all');

            if (isFiltered) {
                cm = `${globalFilterYear}-${globalFilterMonth}`;
                pm = dayjs(`${cm}-01`).subtract(1, 'month').format('YYYY-MM');
            }

            let rT = 0, rC = 0, rP = 0, dT = 0, dC = 0, dP = 0;

            FLUXO.forEach(i => {
                const mm = dayjs(i.data).format('YYYY-MM');
                const matchF = !isFiltered || mm === cm;

                if (i.tipo === 'Receita') {
                    if (matchF) rT += i.valor;
                    if (mm === cm) rC += i.valor;
                    if (mm === pm) rP += i.valor;
                }
            });

            CONSOLIDADO.forEach(i => {
                if (i.tipo === 'Despesa') {
                    const v = i.valor || 0;
                    const mm = dayjs(i.data).format('YYYY-MM');
                    const matchF = !isFiltered || mm === cm;

                    if (matchF) dT += v;
                    if (mm === cm) dC += v;
                    if (mm === pm) dP += v;
                }
            });

            document.getElementById('kpi-saldo').textContent = fmt(rT - dT);
            document.getElementById('kpi-receita').textContent = fmt(rT);
            document.getElementById('kpi-despesa').textContent = fmt(dT);

            const setG = (el, cur, prev, invert) => {
                const diff = cur - prev;
                if (diff > 0) { el.className = 'kpi-growth ' + (invert ? 'down' : 'up'); el.textContent = '▲ +' + fmt(diff) + (isFiltered ? ' no período' : ' no mês'); }
                else if (diff < 0) { el.className = 'kpi-growth ' + (invert ? 'up' : 'down'); el.textContent = '▼ ' + fmt(diff) + (isFiltered ? ' no período' : ' no mês'); }
                else { el.className = 'kpi-growth flat'; el.textContent = '— Sem variação'; }
            };
            setG(document.getElementById('growth-saldo'), rC - dC, rP - dP, false);
            setG(document.getElementById('growth-receita'), rC, rP, false);
            setG(document.getElementById('growth-despesa'), dC, dP, true);

            if (typeof window.drawCat === 'function') {
                const actCat = document.querySelector('.chart-filters[data-target="cat"] .active')?.dataset?.f || 'Receita';
                window.drawCat(actCat);
            }
            if (typeof window.drawTop === 'function') {
                window.drawTop('chart-top-rec', 'Receita', document.getElementById('filter-cat-rec')?.value || 'todas');
                window.drawTop('chart-top-desp', 'Despesa', document.getElementById('filter-cat-desp')?.value || 'todas');
            }
        };

        // Gráfico Área — Receita x Despesa
        const drawFluxo = (mode) => {
            const g = group(CONSOLIDADO, mode);
            const labels = Object.keys(g);
            echarts.init(document.getElementById('chart-fluxo'), 'dark').setOption({
                backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'axis' },
                legend: { data: ['Receitas', 'Despesas'], bottom: 0, textStyle: { color: '#6B7A99' } },
                grid: { left: '3%', right: '4%', bottom: '16%', top: '8%', containLabel: true },
                xAxis: { type: 'category', boundaryGap: false, data: labels, axisLine: { lineStyle: { color: '#2A3042' } }, axisLabel: { color: '#6B7A99' } },
                yAxis: { type: 'value', splitLine: { show: false }, axisLabel: { formatter: v => fmt(v), color: '#6B7A99' } },
                series: [
                    { name: 'Receitas', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#00ff15ff' }, lineStyle: { width: 3, shadowColor: 'rgba(3, 131, 10, 0.4)', shadowBlur: 8 }, areaStyle: { color: grad(neonCyan) }, data: labels.map(l => +g[l].rec.toFixed(1)) },
                    { name: 'Despesas', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#bb0606ff' }, lineStyle: { width: 3, shadowColor: 'rgba(255,107,138,0.4)', shadowBlur: 8 }, areaStyle: { color: grad(neonPink) }, data: labels.map(l => +g[l].desp.toFixed(1)) }
                ]
            });
        };

        // Gráfico Linha — Saldo acumulado
        const drawSaldo = (mode) => {
            const g = group(CONSOLIDADO, mode);
            const labels = Object.keys(g);
            let acc = 0;
            const vals = labels.map(l => { acc += g[l].rec - g[l].desp; return +acc.toFixed(1); });
            echarts.init(document.getElementById('chart-saldo'), 'dark').setOption({
                backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'axis', formatter: p => `${p[0].name}<br/>Saldo: <b>${fmt(p[0].value)}</b>` },
                grid: { left: '3%', right: '4%', bottom: '8%', top: '8%', containLabel: true },
                xAxis: { type: 'category', boundaryGap: false, data: labels, axisLine: { lineStyle: { color: '#2A3042' } }, axisLabel: { color: '#6B7A99' } },
                yAxis: { type: 'value', splitLine: { show: false }, axisLabel: { formatter: v => fmt(v), color: '#6B7A99' } },
                series: [{ type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#FFD700' }, lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(255,215,0,0.5)' }, areaStyle: { color: grad(neonGold) }, data: vals }]
            });
        };

        // Pizza — Categorias
        const drawCat = (tipo) => {
            const acc = {};
            const source = tipo === 'Receita' ? FLUXO : CONSOLIDADO;
            let isF = (typeof globalFilterMonth !== 'undefined' && globalFilterMonth !== 'all' && globalFilterYear !== 'all');
            let targetMM = isF ? `${globalFilterYear}-${globalFilterMonth}` : null;

            source.forEach(d => {
                let match = !isF || dayjs(d.data).format('YYYY-MM') === targetMM;
                if (d.tipo === tipo && match) acc[d.categoria] = (acc[d.categoria] || 0) + d.valor;
            });
            const data = Object.entries(acc).map(([n, v]) => ({ name: n, value: +v.toFixed(1) }));
            const colors = tipo === 'Receita' ? ['#33ff00ff', '#076617ff', '#84e64cff', '#0c961eff', '#0c740cff', '#9ceb53ff', '#094713ff'] : ['#FF6B8A', '#E8415A', '#D32F2F', '#FF8A80', '#FFAB91', '#EF5350', '#C62828'];
            echarts.init(document.getElementById('chart-cat'), 'dark').setOption({
                backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'item', formatter: '{b}<br/>R$ {c} ({d}%)' },
                series: [{ type: 'pie', radius: ['38%', '72%'], avoidLabelOverlap: false, itemStyle: { borderRadius: 8, borderWidth: 2, borderColor: '#1A1F2E' }, label: { show: false }, data, color: colors }]
            });
        };

        // Helper setup for Category Select
        ['Receita', 'Despesa'].forEach(tipo => {
            const selectId = tipo === 'Receita' ? 'filter-cat-rec' : 'filter-cat-desp';
            const selectEl = document.getElementById(selectId);
            if (selectEl) {
                const catSet = new Set();
                const source = tipo === 'Receita' ? FLUXO : CONSOLIDADO;
                source.forEach(d => { if (d.tipo === tipo && d.categoria) catSet.add(d.categoria); });
                catSet.forEach(c => { selectEl.innerHTML += `<option value="${c}">${c}</option>`; });
                selectEl.addEventListener('change', (e) => {
                    drawTop(tipo === 'Receita' ? 'chart-top-rec' : 'chart-top-desp', tipo, e.target.value);
                });
            }
        });

        // Barras Horiz — Top7
        const drawTop = (id, tipo, filterCat = 'todas') => {
            const acc = {};
            const source = tipo === 'Receita' ? FLUXO : CONSOLIDADO;
            let isF = (typeof globalFilterMonth !== 'undefined' && globalFilterMonth !== 'all' && globalFilterYear !== 'all');
            let targetMM = isF ? `${globalFilterYear}-${globalFilterMonth}` : null;

            source.forEach(d => {
                let matchDate = !isF || dayjs(d.data).format('YYYY-MM') === targetMM;
                if (d.tipo === tipo && matchDate) {
                    if (filterCat === 'todas' || d.categoria === filterCat) {
                        const label = d.subcategoria || d.categoria;
                        acc[label] = (acc[label] || 0) + d.valor;
                    }
                }
            });

            const sorted = Object.entries(acc).sort((a, b) => a[1] - b[1]).slice(-7); // Ascending order (lowest to highest) for horizontal layout
            let totalSoma = sorted.reduce((sum, curr) => sum + curr[1], 0);

            const tf_labels = sorted.map(i => i[0].length > 20 ? i[0].substring(0, 20) + '...' : i[0]);
            const tf_dataObjects = sorted.map(i => {
                let pct = totalSoma > 0 ? ((i[1] / totalSoma) * 100).toFixed(1) : 0;
                return { value: +i[1].toFixed(1), pct: pct };
            });

            // Cores neon e gradientes compatíveis com a identidade
            const c1 = tipo === 'Receita' ? '#075c0eff' : '#690b0bff';
            const c2 = tipo === 'Receita' ? '#00c120ff' : '#e6542fff'; // Receita: Verde/Ciano, Despesa: Rosa/Ouro
            const textCor = tipo === 'Receita' ? '#C8E6C9' : '#FFEBAA'; // Cor do valor em si

            const inst = echarts.getInstanceByDom(document.getElementById(id)) || echarts.init(document.getElementById(id), 'dark');
            inst.setOption({
                backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { top: '5%', left: '2%', right: '5%', bottom: '5%', containLabel: true },
                xAxis: { type: 'value', show: false },
                yAxis: { type: 'category', data: tf_labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
                series: [{
                    type: 'bar',
                    data: tf_dataObjects,
                    barWidth: 22,
                    itemStyle: {
                        borderRadius: [0, 8, 8, 0],
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: c1 }, { offset: 1, color: c2 }]),
                        shadowColor: 'rgba(0, 0, 0, 0.4)',
                        shadowBlur: 8,
                        shadowOffsetY: 4
                    },
                    label: {
                        show: true,
                        position: 'insideLeft',
                        distance: 14,
                        formatter: function (p) { return '{name|' + p.name + '}   {val|' + fmt(p.value) + ' (' + p.data.pct + '%)}'; },
                        rich: {
                            name: { color: '#FFFFFF', fontSize: 12, fontWeight: 900, textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4, textShadowOffsetX: 1, textShadowOffsetY: 1 },
                            val: { color: textCor, fontSize: 11, fontWeight: 700, textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4, textShadowOffsetX: 1, textShadowOffsetY: 1 }
                        }
                    }
                }]
            }, true);
        };

        // Initial draw calls -> now replaced by updateDashboardCrossSection to boot up correctly
        drawFluxo('dia');
        drawSaldo('dia');
        updateDashboardCrossSection(); // This will naturally call drawCat and drawTop, and render KPIs

        // Expor para filtros
        window.drawFluxo = drawFluxo;
        window.drawSaldo = drawSaldo;
        window.drawCat = drawCat;

        // Resize
        window.addEventListener('resize', () => {
            ['chart-fluxo', 'chart-saldo', 'chart-cat', 'chart-top-rec', 'chart-top-desp'].forEach(id => {
                const inst = echarts.getInstanceByDom(document.getElementById(id));
                if (inst) inst.resize();
            });
        });
    }

    // ===== CARTOES.HTML — DASH CARTÕES =====
    if (document.getElementById('chart-cartao-evo')) {
        let t1 = 0, t2 = 0, t3 = 0;
        const hoje = dayjs();
        const topList = [];

        CARTAO.forEach(item => {
            const dt = dayjs(item.data);
            const c = item.cartao || 'Cartão 1';

            if (item.tipo === 'Parcela') {
                const np = parseInt(item.parcelas) || 1;
                const vp = item.valorParcela || 0;

                // Meses cobrados: O mês atual da compra conta como parcela 1.
                // A cada mês transcorrido, outra parcela é engatilhada, até o max de 'np'.
                let pagas = hoje.diff(dt, 'month');
                if (pagas < 0) pagas = 0;
                const parcelasCobradas = Math.min(np, pagas + 1);

                // O limite exibido no card só sofre impacto gradativo do que já caiu de parcela
                if (c === 'Cartão 1') t1 += parcelasCobradas * vp;
                else if (c === 'Cartão 2') t2 += parcelasCobradas * vp;
                else t3 += parcelasCobradas * vp;

                // Se ainda pendura parcela futura ou se está cobrando a atual...
                // (O topList de parcelas foi depreciado e substituído pelo UI Flow do Painel Gestor de Parcelas)
            } else {
                const vf = item.valorFatura || 0;
                if (c === 'Cartão 1') t1 += vf;
                else if (c === 'Cartão 2') t2 += vf;
                else t3 += vf;

                if (dt.month() === hoje.month() && dt.year() === hoje.year()) {
                    topList.push({ data: item.data, desc: item.desc || 'Fatura', cartao: c, status: 'Integral', valor: vf });
                }
            }
        });

        let configs = JSON.parse(localStorage.getItem('db_cartoes_config') || '[]');
        if (configs.length === 0) configs = [
            { slot: "Cartão 1", banco: "nubank", limite: 8000, final: "1234", apelido: "Nubank Principal" },
            { slot: "Cartão 2", banco: "itau", limite: 15000, final: "9876", apelido: "Itaú Click" },
            { slot: "Cartão 3", banco: "inter", limite: 5000, final: "5566", apelido: "Inter Conta" }
        ];

        let htmlCards = '';
        const totaisObj = { 'Cartão 1': t1, 'Cartão 2': t2, 'Cartão 3': t3 };

        configs.forEach((cfg) => {
            let gasto = totaisObj[cfg.slot] || 0;
            let gastoStr = `Gasto: ${fmt(gasto)}`;
            let limStr = (cfg.limite && cfg.limite > 0) ? `Limite: ${fmt(cfg.limite)}` : 'Sem Limite';

            // SÍMBOLO DO BANCO NO TOPO (LOGOMARCAS OFICIAIS CERTIFICADAS)
            let bgIcon = '';
            if (cfg.banco === 'nubank') {
                bgIcon = `<img src="https://upload.wikimedia.org/wikipedia/commons/f/f7/Nubank_logo_2021.svg" style="height:26px; filter: brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.3));" alt="Nubank">`;
            } else if (cfg.banco === 'inter') {
                bgIcon = `<img src="https://upload.wikimedia.org/wikipedia/commons/8/8f/Logo_do_banco_Inter_(2023).svg" style="height:22px; filter: brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.3));" alt="Inter">`;
            } else if (cfg.banco === 'santander') {
                bgIcon = `<img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/Banco_Santander_Logotipo.svg" style="height:24px; filter: brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.3));" alt="Santander">`;
            } else if (cfg.banco === 'itau') {
                bgIcon = `<svg viewBox="0 0 50 50" style="height:32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"><rect width="50" height="50" rx="8" fill="#EC7000"/><rect x="3" y="3" width="44" height="44" rx="6" fill="#003399"/><text x="25" y="34" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-weight="900" font-size="20px" fill="#EC7000" text-anchor="middle">Itaú</text></svg>`;
            } else if (cfg.banco === 'bradesco') {
                bgIcon = `<img src="https://logotyp.us/file/bradesco.svg" style="height:34px; filter: brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.3));" alt="Bradesco">`;
            } else if (cfg.banco === 'bb') {
                // BB usa filter brightnes(0) ou none dependendo da logo. Worldvector traz o B do BB azul e amarelo. Se inverte, buga tudo. Mas como o bg do cartao é Gold, vamos forçar em preto PURO
                bgIcon = `<img src="https://cdn.worldvectorlogo.com/logos/banco-do-brasil.svg" style="height:30px; filter: brightness(1) drop-shadow(0 1px 2px rgba(255, 255, 255, 0.4));" alt="BB">`;
            } else if (cfg.banco === 'caixa') {
                bgIcon = `<img src="https://logotyp.us/file/caixa.svg" style="height:32px; filter: brightness(1) invert(0) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));" alt="Caixa">`;
            } else if (cfg.banco === 'c6') {
                bgIcon = `<img src="https://cdn.brandfetch.io/c6bank.com/fallback/lettermark/theme/dark/h/256/w/256/icon?c=1bfwsmEH20zzEfSNTed" style="height:28px; filter: brightness(1) invert(0) drop-shadow(0 2px 4px rgba(0,0,0,0.3));" alt="C6 Bank">`;
            } else if (cfg.banco === 'xp') {
                bgIcon = `<img src="https://i.pinimg.com/originals/eb/34/56/eb34563a7a810d5754d3b7f9d8189ade.png" style="height:28px; filter: brightness(1) invert(0) drop-shadow(0 2px 4px rgba(0,0,0,0.3));" alt="XP">`;
            } else if (cfg.banco === 'dark') {
                bgIcon = `<svg viewBox="0 0 100 30" style="height:18px;"><text y="20" font-family="Arial" font-weight="bold" font-size="20" fill="#888" letter-spacing="4">BLACK</text></svg>`;
            } else {
                bgIcon = `<svg viewBox="0 0 80 30" style="height:20px;"><text y="20" font-family="Arial" font-weight="bold" font-size="18" fill="#fff" letter-spacing="2">CARD</text></svg>`;
            }

            // BANDEIRA INFERIOR
            let flagHtml = '';
            if (cfg.banco === 'xp') {
                // XP is VISA Infinite
                flagHtml = `<svg width="55" height="20" viewBox="0 0 100 30"><text y="24" font-family="Arial" font-weight="bold" font-style="italic" font-size="34" fill="#fff" letter-spacing="-1">VISA</text><text x="75" y="24" font-family="Arial" font-size="10" fill="#D4AF37" font-weight="bold">Infinite</text></svg>`;
            } else {
                // O padrão dos outros é Mastercard geralmente ou design minimalista da Master
                flagHtml = `<svg width="45" viewBox="0 0 100 60"><circle cx="32" cy="30" r="28" fill="#eb001b" opacity="0.9" /><circle cx="68" cy="30" r="28" fill="#f79e1b" opacity="0.9" /></svg>`;
            }

            // CHIP HIPER REALISTA (SEM ÍCONE LUCIDE)
            let chipHtml = `<svg width="42" height="24" viewBox="0 0 42 32" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">
               <rect width="42" height="32" rx="6" fill="url(#chipGradient_${cfg.slot.replace(' ', '')})" />
               <!-- linhas internas do chip para visual real -->
               <path d="M 12 0 V 32 M 30 0 V 32 M 0 12 H 42 M 0 20 H 42" stroke="rgba(0,0,0,0.25)" stroke-width="1.2" fill="none"/>
               <rect x="16" y="8" width="10" height="16" rx="2" stroke="rgba(0,0,0,0.3)" stroke-width="1.2" fill="none"/>
               <defs>
                   <linearGradient id="chipGradient_${cfg.slot.replace(' ', '')}" x1="0%" y1="0%" x2="100%" y2="100%">
                       <stop offset="0%" stop-color="#F2DD99" />
                       <stop offset="50%" stop-color="#EBC86A" />
                       <stop offset="100%" stop-color="#D9A83A" />
                   </linearGradient>
               </defs>
           </svg>`;

            let pctNum = (cfg.limite && cfg.limite > 0) ? ((gasto / cfg.limite) * 100) : 0;
            let pct = pctNum.toFixed(1);

            let insightTitle = '';
            let insightMsg = '';
            let insightColor = '';
            let alertGlow = '';
            let bgTtOuter = 'rgba(18,22,34,0.95)';
            let borderTt = 'rgba(124,107,255,0.3)';

            let dispInsight = (cfg.limite || 0) - gasto;
            let formattedDisp = fmt(Math.abs(dispInsight));

            if (pctNum === 0) {
                insightTitle = 'CARTÃO INATIVO';
                insightColor = '#4DD0E1';
                insightMsg = `Você não utilizou este cartão referente. Todo o seu crédito estrutural de <b>${fmt(cfg.limite || 0)}</b> segue completamente limpo.`;
            }
            else if (pctNum <= 30) {
                insightTitle = 'USO CONSERVADOR';
                insightColor = '#00E5FF';
                insightMsg = `Alavancagem estável e baixa. O expressivo limite livre de <b>${formattedDisp}</b> atua como excelente folga operacional para emergências extremas.`;
            } else if (pctNum <= 50) {
                insightTitle = 'GASTO SAUDÁVEL';
                insightColor = '#80DEEA';
                insightMsg = `Sua utilização está perfeitamente dimensionada. Você preserva <b>${formattedDisp}</b> de margem flutuante no seu score do cartão.`;
            } else if (pctNum <= 75) {
                insightTitle = 'ALAVANCAGEM ELEVADA';
                insightColor = '#F79E1B';
                insightMsg = `Utilizações de crédito acima de 50% refletem negativamente nas variações temporárias do seu Serasa Score. Refreie gastos extras. Restam <b>${formattedDisp}</b> flexíveis.`;
            } else if (pctNum < 100) {
                insightTitle = 'ALERTA DE RISCO !';
                insightColor = '#E8415A';
                insightMsg = `Perigo! O cartão consumiu a maior parte da renda fiadora. O resíduo de segurança caiu brutalmente para <b>${formattedDisp}</b> e não mitiga despesas altas. Cancele compras pendentes se possível.`;
            } else {
                insightTitle = '🔥 ESTOURO DE LIMITE 🔥';
                insightColor = '#FF0044';
                alertGlow = 'text-shadow: 0 0 10px rgba(255,0,0,0.8);';
                bgTtOuter = 'rgba(40,10,15,0.96)';
                borderTt = 'rgba(255,0,68,0.7)';
                insightMsg = `Operação arriscada detectada. Carga de gastos ultrapassou o teto original do banco em <b>${formattedDisp}</b>. Antecipe pagamentos para estancar rapidamente a incidência letal de CET nos juros do rotativo.`;
            }

            let tProg = `<div style="position:absolute; top:24px; right:20px; z-index:100; cursor:pointer;" 
               onmouseenter="this.children[1].style.opacity='1'; this.children[1].style.transform='translateY(0)'; this.children[0].style.background='var(--primary)'; this.closest('.mc-card').style.zIndex='99999';" 
               onmouseleave="this.children[1].style.opacity='0'; this.children[1].style.transform='translateY(-5px)'; this.children[0].style.background='rgba(255,255,255,0.05)'; this.closest('.mc-card').style.zIndex='';">
               <div style="width:24px; height:24px; border:1.5px solid rgba(255,255,255,0.4); border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:Arial,sans-serif; font-size:14px; font-weight:bold; background:rgba(255,255,255,0.05); color:#fff; transition:all 0.3s; box-shadow:0 0 8px rgba(0,0,0,0.3); z-index:2;">!</div>
               
               <div style="position:absolute; top:36px; right:0px; width:270px; background:${bgTtOuter}; border:1px solid ${borderTt}; border-radius:12px; padding:18px; color:#fff; text-align:left; opacity:0; transform:translateY(-5px); transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:0 20px 50px rgba(0,0,0,0.95); pointer-events:none; z-index:999999;">
                   
                   <div style="display:flex; justify-content:space-between; align-items:end; margin-bottom:10px;">
                      <div style="font-weight:bold; font-size:0.75rem; color:#8B9BB4; text-transform:uppercase; letter-spacing:1px; line-height: 1.2;">Comprometimento</div>
                      <div style="font-size:1.4rem; color:${insightColor}; text-shadow:0 0 8px ${insightColor}88; line-height: 1.0; font-weight: 800; margin-left: 10px; ${alertGlow}">${pct}%</div>
                   </div>

                   <div style="width:100%; height:6px; border-radius:3px; background:rgba(255,255,255,0.08); overflow:hidden; margin-bottom:14px;">
                      <div style="width:${Math.min(100, pctNum)}%; height:100%; background:${pctNum >= 75 ? '#E8415A' : 'linear-gradient(90deg, #7C6BFF, #00E5FF)'}; border-radius:3px; transition: width 1s;"></div>
                   </div>

                   <div style="padding-top: 14px; border-top: 1px dashed rgba(255,255,255,0.15);">
                      <div style="font-size: 0.8rem; color: ${insightColor}; font-weight: 800; margin-bottom: 6px; text-transform: uppercase;">${insightTitle}</div>
                      <div style="font-size: 0.85rem; line-height: 1.5; color: #E8ECF4; opacity: 0.95;">
                         ${insightMsg}
                      </div>
                   </div>

               </div>
           </div>`;

            htmlCards += `
              <div class="mc-card mc-${cfg.banco}" draggable="true" data-slot="${cfg.slot}" style="cursor: grab;">
                 <!-- Container absoluto para trancar o brilho radial dentro dos cantos arredondados, sem vazar -->
                 <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 20px; overflow: hidden; pointer-events: none; z-index: 0;">
                     <div class="mc-shine"></div>
                 </div>
                 
                 <!-- Ícone Tooltip -->
                 ${tProg}

                 <!-- Logo Banco Top Left -->
                 <div style="position: absolute; top: 22px; left: 24px; z-index: 1;">
                     ${bgIcon}
                 </div>
                 <!-- Aproximação NFC Icon Top Right (movido um pouco ao lado) -->
                 <div style="position: absolute; top: 26px; right: 54px; z-index: 1; opacity: 0.6;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M5.5 15.5A7.5 7.5 0 0 1 5.5 8.5M9 13.5a4 4 0 0 1 0-7M12.5 11.5a1.5 1.5 0 0 1 0-3M16 10v.01"/></svg>
                 </div>

                 <div class="mc-top-row" style="margin-top: 36px;">
                     <!-- Chip Real Left -->
                     ${chipHtml}
                 </div>

                 <div class="mc-number-row" style="margin-left: 10px; font-size: 1.25rem; margin-top: 5px;">**** **** **** ${cfg.final || '0000'}</div>
                 
                 <div class="mc-bottom-row" style="align-items: center; margin-top: auto;">
                     <div style="display:flex; flex-direction:column; gap:4px;">
                         <strong style="margin:0; font-size: 1.1rem; text-transform: uppercase;">${cfg.apelido || cfg.slot}</strong>
                         <small style="color:rgba(255,255,255,0.75); font-size:0.85rem; letter-spacing: 0.5px; font-weight: bold;">${gastoStr}</small>
                     </div>
                     <div class="mc-right" style="display:flex; flex-direction:column; justify-content:center; align-items:flex-end;">
                        <small style="margin-bottom: 2px; font-size: 0.75rem; color:#fff; letter-spacing:1px; opacity: 0.9;">${limStr}</small>
                        <!-- BANDEIRA AQUI (Master / Visa) -->
                        <div>${flagHtml}</div>
                     </div>
                 </div>
              </div>
           `;
        });
        const cContainer = document.getElementById('mc-cards-container');
        if (cContainer) {
            cContainer.innerHTML = htmlCards;

            // --- LÓGICA DE DRAG AND DROP ---
            let dragTarget = null;

            cContainer.addEventListener('dragstart', (e) => {
                dragTarget = e.target.closest('.mc-card');
                if (dragTarget) {
                    dragTarget.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                }
            });

            cContainer.addEventListener('dragend', (e) => {
                if (dragTarget) dragTarget.classList.remove('dragging');
                dragTarget = null;
            });

            cContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                const afterElement = getDragAfterElement(cContainer, e.clientX);
                const draggable = document.querySelector('.dragging');
                if (draggable) {
                    if (afterElement == null) {
                        cContainer.appendChild(draggable);
                    } else {
                        cContainer.insertBefore(draggable, afterElement);
                    }
                }
            });

            cContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                // Salvar nova ordem no localStorage
                const newOrderSlots = [...cContainer.querySelectorAll('.mc-card')].map(card => card.dataset.slot);
                const currentConfigs = JSON.parse(localStorage.getItem('db_cartoes_config') || '[]');

                // Reconstruir array baseado na nova ordem visual
                const sortedConfigs = newOrderSlots.map(slot => {
                    return currentConfigs.find(c => c.slot === slot);
                }).filter(Boolean);

                localStorage.setItem('db_cartoes_config', JSON.stringify(sortedConfigs));
            });

            function getDragAfterElement(container, x) {
                const draggableElements = [...container.querySelectorAll('.mc-card:not(.dragging)')];

                return draggableElements.reduce((closest, child) => {
                    const box = child.getBoundingClientRect();
                    const offset = x - box.left - box.width / 2;
                    if (offset < 0 && offset > closest.offset) {
                        return { offset: offset, element: child };
                    } else {
                        return closest;
                    }
                }, { offset: Number.NEGATIVE_INFINITY }).element;
            }
        }

        // Gráfico evo
        const drawCartaoEvo = (mode) => {
            const acc1 = {}, acc2 = {}, acc3 = {}, all = new Set();

            const addK = (k, c, v) => {
                all.add(k);
                if (c === 'Cartão 1') acc1[k] = (acc1[k] || 0) + v;
                else if (c === 'Cartão 2') acc2[k] = (acc2[k] || 0) + v;
                else acc3[k] = (acc3[k] || 0) + v;
            };

            CARTAO.forEach(d => {
                const c = d.cartao || 'Cartão 1';
                const baseDt = dayjs(d.data);

                if (d.tipo === 'Parcela') {
                    const np = parseInt(d.parcelas) || 1;
                    const vp = d.valorParcela || 0;

                    // Dispara a despesa mês a mês dinamicamente nas keys
                    for (let i = 0; i < np; i++) {
                        let fDt = baseDt.add(i, 'month');
                        let k = '';
                        if (mode === 'dia') k = fDt.format('DD/MM');
                        else if (mode === 'semana') k = 'S' + fDt.week();
                        else if (mode === 'mes') k = fDt.format('MMM/YY');
                        else if (mode === 'ano') k = fDt.format('YYYY');
                        addK(k, c, vp);
                    }
                } else {
                    const v = d.valorFatura || 0;
                    let k = '';
                    if (mode === 'dia') k = baseDt.format('DD/MM');
                    else if (mode === 'semana') k = 'S' + baseDt.week();
                    else if (mode === 'mes') k = baseDt.format('MMM/YY');
                    else if (mode === 'ano') k = baseDt.format('YYYY');
                    addK(k, c, v);
                }
            });
            const labels = [...all].sort((a, b) => {
                // Ordenação rudimentar para garantir que meses fiquem em ordem caso iterados forçadamente
                if (mode === 'mes' && a.includes('/') && b.includes('/')) {
                    const [mA, yA] = a.toLowerCase().split('/'); 
                    const [mB, yB] = b.toLowerCase().split('/');
                    const idx = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12, feb:2, apr:4, may:5, aug:8, sep:9, oct:10, dec:12 };
                    return (yA === yB) ? (idx[mA] || 0) - (idx[mB] || 0) : yA - yB;
                }
                return a.localeCompare(b);
            });
            echarts.init(document.getElementById('chart-cartao-evo'), 'dark').setOption({
                backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'axis' },
                legend: { data: ['Cartão 1', 'Cartão 2', 'Cartão 3'], bottom: 0, textStyle: { color: '#6B7A99' } },
                grid: { left: '3%', right: '4%', bottom: '16%', top: '8%', containLabel: true },
                xAxis: { type: 'category', boundaryGap: false, data: labels, axisLabel: { color: '#6B7A99' } },
                yAxis: { type: 'value', axisLabel: { formatter: v => fmt(v), color: '#6B7A99' }, splitLine: { show: false } },
                series: [
                    { name: 'Cartão 1', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#201b44ff' }, lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(124,107,255,0.5)' }, areaStyle: { color: grad(neonPurple) }, data: labels.map(l => +(acc1[l] || 0).toFixed(1)) },
                    { name: 'Cartão 2', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#606061ff' }, lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }, areaStyle: { color: grad(neonSilver) }, data: labels.map(l => +(acc2[l] || 0).toFixed(1)) },
                    { name: 'Cartão 3', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#0097A7' }, lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(0, 229, 255, 0.5)' }, areaStyle: { color: grad(neonCyan) }, data: labels.map(l => +(acc3[l] || 0).toFixed(1)) }
                ]
            });
        };
        drawCartaoEvo('dia');
        window.drawCartaoEvo = drawCartaoEvo;

        window.addEventListener('resize', () => {
            const inst = echarts.getInstanceByDom(document.getElementById('chart-cartao-evo'));
            if (inst) inst.resize();
        });

        // === DASHBOARD DE FATURAS E PARCELAS (NOVO) ===

        // 1. TOP 15 Faturas (À vista com design de Barras Horizontais / Funil e com Porcentual)
        const drawTop15 = (mode) => {
            const chartDom = document.getElementById('chart-top15-faturas');
            if (!chartDom) return;

            // Filtro Temporal
            let filtered = CARTAO.filter(i => i.tipo !== 'Parcela');
            if (mode !== 'total') {
                filtered = filtered.filter(i => {
                    const d = dayjs(i.data);
                    if (mode === 'dia') return d.isSame(hoje, 'day');
                    if (mode === 'semana') return d.isSame(hoje, 'week');
                    if (mode === 'mes') return d.isSame(hoje, 'month');
                    if (mode === 'ano') return d.isSame(hoje, 'year');
                    return true;
                });
            }

            let faturasArr = filtered.map(i => ({ desc: i.desc || 'Compra', valor: i.valorFatura || 0, cartao: i.cartao || 'Cartão' }));
            faturasArr.sort((a, b) => a.valor - b.valor); // ascending obriga echarts a empilhar a maior barra por cima de modo horizontal
            const tf_arr = faturasArr.slice(Math.max(faturasArr.length - 15, 0));

            let totalSoma = tf_arr.reduce((acc, curr) => acc + curr.valor, 0);
            const tf_labels = tf_arr.map(i => (i.desc.length > 20 ? i.desc.substring(0, 20) + '...' : i.desc) + ' (' + i.cartao.split(' ')[1] + ')');

            const tf_dataObjects = tf_arr.map(i => {
                let pct = totalSoma > 0 ? ((i.valor / totalSoma) * 100).toFixed(1) : 0;
                return { value: +i.valor.toFixed(1), pct: pct };
            });

            const myChart = echarts.init(chartDom, 'dark');
            myChart.setOption({
                backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { top: '5%', left: '2%', right: '5%', bottom: '5%', containLabel: true },
                xAxis: { type: 'value', show: false },
                yAxis: { type: 'category', data: tf_labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
                series: [{
                    type: 'bar',
                    data: tf_dataObjects,
                    barWidth: 22,
                    itemStyle: {
                        borderRadius: [0, 8, 8, 0],
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#443a80d0' }, { offset: 1, color: '#6c06f1ff' }]),
                        shadowColor: 'rgba(0, 0, 0, 0.4)',
                        shadowBlur: 8,
                        shadowOffsetY: 4
                    },
                    label: {
                        show: true,
                        position: 'insideLeft',
                        distance: 14,
                        formatter: function (p) { return '{name|' + p.name + '}   {val|' + fmt(p.value) + ' (' + p.data.pct + '%)}'; },
                        rich: {
                            name: { color: '#000000ff', fontSize: 12, fontWeight: 900, textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4, textShadowOffsetX: 1, textShadowOffsetY: 1 },
                            val: { color: '#ffffffff', fontSize: 11, fontWeight: 700, textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4, textShadowOffsetX: 1, textShadowOffsetY: 1 }
                        }
                    }
                }]
            });
            window.addEventListener('resize', () => { myChart.resize(); });
        };
        // Inicializa padrão Mês igual definimos no HTML class active
        drawTop15('mes');

        document.querySelectorAll('#btn-group-top15 .fbtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#btn-group-top15 .fbtn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                drawTop15(e.target.dataset.f);
            });
        });

        // 2. PAINEL PROFISSIONAL DE GESTÃO DE PARCELAMENTOS
        if (document.getElementById('parcelas-list-container')) {
            const parcelasAll = CARTAO.filter(i => i.tipo === 'Parcela').map(i => {
                let dt = dayjs(i.data);
                let np = parseInt(i.parcelas) || 1;
                let vp = i.valorParcela || 0;
                let pagasRaw = hoje.diff(dt, 'month') + 1;
                let pagas = pagasRaw < 0 ? 0 : Math.min(pagasRaw, np);
                return {
                    id: i.id || Math.random().toString(),
                    desc: i.desc || 'Compra Parcelada',
                    cartao: i.cartao || 'Cartão',
                    data: i.data,
                    np: np,
                    vp: vp,
                    total: np * vp,
                    pagas: pagas
                };
            });

            // 2.a Lógica de Tooltip Analítico das Parcelas
            let saldoAtivo = 0;
            let parcelasMesCorrente = 0;
            let faturasMesCorrente = 0;

            parcelasAll.forEach(p => {
                if (p.pagas < p.np) saldoAtivo += (p.np - p.pagas) * p.vp; // dívida rolante
                if (p.pagas > 0 && p.pagas <= p.np && hoje.diff(dayjs(p.data), 'month') < p.np) parcelasMesCorrente += p.vp;
            });
            // Varre compras comuns sem ser parcela
            CARTAO.forEach(i => {
                if (i.tipo !== 'Parcela' && dayjs(i.data).month() === hoje.month() && dayjs(i.data).year() === hoje.year()) {
                    faturasMesCorrente += (i.valorFatura || 0);
                }
            });

            let totalFaturaMes = parcelasMesCorrente + faturasMesCorrente;
            let yPct = totalFaturaMes > 0 ? ((parcelasMesCorrente / totalFaturaMes) * 100).toFixed(1) : 0;

            let markupInsight = `
            <div style="cursor:pointer;" 
               onmouseenter="this.children[1].style.opacity='1'; this.children[1].style.transform='translateY(0)'; this.children[0].style.background='var(--primary)';" 
               onmouseleave="this.children[1].style.opacity='0'; this.children[1].style.transform='translateY(5px)'; this.children[0].style.background='rgba(0,229,255,0.1)';">
               
               <div style="width:26px; height:26px; border:1.5px solid rgba(0,229,255,0.4); border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:Arial,sans-serif; font-size:14px; font-weight:bold; background:rgba(0,229,255,0.1); color:#00E5FF; transition:all 0.3s; box-shadow:0 0 10px rgba(0,229,255,0.2);">!</div>
               
               <div style="position:absolute; top:36px; left:-140px; width:340px; background:rgba(18,22,34,0.96); border:1px solid rgba(0,229,255,0.3); border-radius:12px; padding:20px; color:#fff; text-align:left; opacity:0; transform:translateY(5px); transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:0 15px 40px rgba(0,0,0,0.9); pointer-events:none; z-index:999999; backdrop-filter: blur(10px);">
                   <div style="color:#8B9BB4; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; font-weight:800; margin-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">Insights sobre as Parcelas</div>
                   
                   <div style="margin-bottom:16px; background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                      <div style="font-size:0.85rem; color:#E8ECF4; opacity:0.9;">Parcelas para pagar:</div>
                      <div style="font-size:1.4rem; color:#F79E1B; font-weight:800; text-shadow:0 0 8px rgba(247,158,27,0.4); margin:4px 0;">${fmt(saldoAtivo)}</div>
                      <div style="font-size:0.75rem; color:#8B9BB4; line-height:1.3;">Valor total a pagar em todas as suas compras parceladas.</div>
                   </div>

                   <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                      <div style="font-size:0.85rem; color:#E8ECF4; opacity:0.9;">Parcelas do Mês Corrente:</div>
                      <div style="font-size:1.4rem; color:#00E5FF; font-weight:800; text-shadow:0 0 8px rgba(0,229,255,0.4); margin:4px 0;">${yPct}%</div>
                      <div style="font-size:0.75rem; color:#8B9BB4; line-height:1.3;">Das faturas deste mês estão impactadas por compras parceladas (frente aos ${fmt(totalFaturaMes)} totais).</div>
                   </div>
               </div>
            </div>`;
            const insightWrapper = document.getElementById('parcelas-insight-wrapper');
            if (insightWrapper) insightWrapper.innerHTML = markupInsight;

            const renderParcelas = (filter = 'month') => {
                let filtered = parcelasAll;
                if (filter === 'month') {
                    // "Neste Mês" - Parcelas ativas que possuem parcela caindo validada.
                    filtered = parcelasAll.filter(p => p.pagas > 0 && p.pagas <= p.np && hoje.diff(dayjs(p.data), 'month') < p.np);
                } else if (filter === 'pending') {
                    // "Aberta" / a Pagar
                    filtered = parcelasAll.filter(p => p.pagas < p.np);
                } else if (filter === 'paid') {
                    // "Pagas" 100% quitadas
                    filtered = parcelasAll.filter(p => p.pagas >= p.np);
                }

                const c = document.getElementById('parcelas-list-container');
                c.innerHTML = '';
                if (filtered.length === 0) {
                    c.innerHTML = `<div style="text-align:center; padding: 50px; color: var(--text-light); font-size: 1.1rem;">Sem parcelas neste status :)</div>`;
                    return;
                }

                filtered.sort((a, b) => dayjs(b.data).valueOf() - dayjs(a.data).valueOf());

                filtered.forEach(p => {
                    let pct = Math.round((p.pagas / p.np) * 100);
                    let colorMain = pct >= 100 ? '#00E676' : '#00E5FF';
                    let bgBox = pct >= 100 ? 'rgba(0,230,118,0.1)' : 'rgba(0,229,255,0.08)';

                    c.innerHTML += `
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:20px 28px; display:flex; justify-content:space-between; align-items:center; transition: all 0.3s; cursor:default;" onmouseover="this.style.background='rgba(255,255,255,0.05)';" onmouseout="this.style.background='rgba(255,255,255,0.02)';">
                       <div style="display:flex; flex-direction:column; gap:6px;">
                          <div style="color:${colorMain}; font-weight:800; font-size:1.2rem; letter-spacing:-0.3px;">${p.desc.toUpperCase()}</div>
                          <div style="color:#8B9BB4; font-size:0.85rem; font-weight:500;">
                              <span style="display:inline-block; margin-right:10px; padding:4px 10px; border-radius:8px; background:rgba(124,107,255,0.15); color:#7C6BFF; font-weight:800;">${p.cartao}</span> 
                              Registrada em: ${dayjs(p.data).format('DD/MM/YYYY')}
                          </div>
                          <div style="width:180px; height:5px; background:rgba(255,255,255,0.08); border-radius:3px; margin-top:10px; overflow:hidden;">
                               <div style="height:100%; width:${pct}%; background:${colorMain}; box-shadow:0 0 10px ${colorMain};"></div>
                          </div>
                       </div>
                       
                       <div style="display:flex; align-items:center; gap:32px;">
                          <div style="text-align:right;">
                             <div style="color:#fff; font-size:1.2rem; font-weight:800; text-shadow:0 2px 4px rgba(0,0,0,0.5);">${p.np}x de ${fmt(p.vp)}</div>
                             <div style="color:#F79E1B; font-size:0.85rem; margin-top:6px; font-weight:600; opacity:0.95;">Contrato Total: ${fmt(p.total)}</div>
                          </div>
                          <div style="background:${bgBox}; border:1px solid ${colorMain}40; color:${colorMain}; padding:12px 20px; border-radius:12px; font-weight:900; font-size:1rem; min-width: 130px; text-align:center; box-shadow:inset 0 0 10px ${colorMain}22;">
                             ${p.pagas} / ${p.np} Paga(s)
                          </div>
                       </div>
                    </div>
                    `;
                });
            };
            renderParcelas('month');

            document.querySelectorAll('#btn-group-parcelas .fbtn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('#btn-group-parcelas .fbtn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    renderParcelas(e.target.dataset.f);
                });
            });
        }
    }

    // ===== METAS.HTML — DASH METAS =====
    if (document.getElementById('chart-kpi-meta1')) {
        const METAS = JSON.parse(localStorage.getItem('db_metas') || '[]');

        // Setup Gauge Helper
        const createNeonGauge = (elId, title, subText, percent, color) => {
            const chart = echarts.init(document.getElementById(elId), 'dark');
            chart.setOption({
                backgroundColor: 'transparent',
                title: { text: title, subtext: subText, left: 'center', top: 'center', textStyle: { color: '#6B7A99', fontSize: 13, fontWeight: 'bold' }, subtextStyle: { color: color, fontSize: 24, fontWeight: 'bold', textShadowColor: color, textShadowBlur: 8 } },
                series: [{
                    type: 'pie', radius: ['70%', '85%'], silent: true, labelLine: { show: false },
                    data: [
                        { value: Math.max(0, percent), itemStyle: { color: color, shadowColor: color, shadowBlur: 10 } },
                        { value: Math.max(0, 100 - percent), itemStyle: { color: 'rgba(255,255,255,0.04)' } }
                    ]
                }]
            });
            window.addEventListener('resize', () => chart.resize());
        };

        let sortedByVal = [...METAS].sort((a, b) => b.valorObjetivo - a.valorObjetivo);
        let sortedByPct = [...METAS].sort((a, b) => (b.valorAtual / b.valorObjetivo) - (a.valorAtual / a.valorObjetivo));

        if (sortedByVal[0]) {
            let p1 = Math.min(100, (sortedByVal[0].valorAtual / sortedByVal[0].valorObjetivo) * 100) || 0;
            createNeonGauge('chart-kpi-meta1', sortedByVal[0].nome.substring(0, 15), p1.toFixed(1) + '%', p1, '#00E5FF');
        }
        if (sortedByVal[1]) {
            let p2 = Math.min(100, (sortedByVal[1].valorAtual / sortedByVal[1].valorObjetivo) * 100) || 0;
            createNeonGauge('chart-kpi-meta2', sortedByVal[1].nome.substring(0, 15), p2.toFixed(1) + '%', p2, '#7C6BFF');
        }
        if (sortedByPct[0]) {
            let p3 = Math.min(100, (sortedByPct[0].valorAtual / sortedByPct[0].valorObjetivo) * 100) || 0;
            createNeonGauge('chart-kpi-meta3', sortedByPct[0].nome.substring(0, 15), p3.toFixed(1) + '%', p3, '#4facfe');
        }

        // Gráfico de Metas Acumuladas no tempo (usando a data de criação / ID)
        const metasNoTempo = {};
        METAS.forEach(m => {
            const date = dayjs(parseInt(m.id)).format('DD/MM/YYYY');
            metasNoTempo[date] = (metasNoTempo[date] || 0) + m.valorObjetivo;
        });
        const labelsEvo = Object.keys(metasNoTempo).sort((a, b) => {
            const [d1, m1, y1] = a.split('/');
            const [d2, m2, y2] = b.split('/');
            return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
        });
        let accMeta = 0;
        const valsEvo = labelsEvo.map(l => { accMeta += metasNoTempo[l]; return +accMeta.toFixed(1); });

        echarts.init(document.getElementById('chart-metas-evo'), 'dark').setOption({
            backgroundColor: 'transparent',
            tooltip: { ...tipStyle, trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '8%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: labelsEvo, axisLabel: { color: '#6B7A99' } },
            yAxis: { type: 'value', axisLabel: { formatter: v => fmt(v), color: '#6B7A99' }, splitLine: { show: false } },
            series: [{ type: 'line', smooth: true, itemStyle: { color: '#7C6BFF' }, lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(124,107,255,0.5)' }, areaStyle: { color: grad(neonPurple) }, data: valsEvo }]
        });

        // Top 10 Metas
        const top10 = sortedByVal.slice(0, 10);
        echarts.init(document.getElementById('chart-metas-top10'), 'dark').setOption({
            backgroundColor: 'transparent',
            tooltip: { ...tipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { top: 10, left: '3%', right: '14%', bottom: 10, containLabel: true },
            xAxis: { type: 'value', show: false },
            yAxis: { type: 'category', data: top10.map(m => m.nome).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#6B7A99' } },
            series: [{ type: 'bar', data: top10.map(m => +m.valorObjetivo.toFixed(1)).reverse(), itemStyle: { borderRadius: [0, 6, 6, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#5A54E8' }, { offset: 1, color: '#7C6BFF' }]) }, label: { show: true, position: 'right', formatter: p => fmt(p.value), fontSize: 11, color: '#6B7A99' } }]
        });

        window.addEventListener('resize', () => {
            ['chart-metas-evo', 'chart-metas-top10'].forEach(id => {
                const inst = echarts.getInstanceByDom(document.getElementById(id));
                if (inst) inst.resize();
            });
        });
    }

    // ===== INVESTIMENTOS.HTML — DASH INVEST =====
    if (document.getElementById('chart-inv-barras')) {

        (async () => {
            let INVEST = JSON.parse(localStorage.getItem('db_invest') || '[]');

            // ── 1. DEFINIR FUNÇÕES DE GRÁFICOS PRIMEIRO (const não faz hoisting) ──

            // Barras Verticais — Aporte vs Acumulado por tipo de ativo
            const drawInvestBarras = (investData, filter) => {
                const acc = {};
                investData.forEach(i => {
                    if (filter === 'todos' || filter === i.tipo) {
                        if (!acc[i.ativo]) acc[i.ativo] = { aporte: 0, acum: 0 };
                        acc[i.ativo].aporte += parseFloat(i.aporte || 0);
                        acc[i.ativo].acum += parseFloat(i.acumulado || i.aporte || 0);
                    }
                });
                const ativos = Object.keys(acc);

                let dom = document.getElementById('chart-inv-barras');
                try {
                    let oldChart = echarts.getInstanceByDom(dom);
                    if (oldChart) oldChart.dispose();
                    let chart = echarts.init(dom, 'dark');
                    chart.setOption({
                        backgroundColor: 'transparent',
                        tooltip: { ...tipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
                        legend: { data: ['Aporte', 'Acumulado'], bottom: 0, textStyle: { color: '#6B7A99' } },
                        grid: { top: 10, left: '3%', right: '4%', bottom: '15%', containLabel: true },
                        xAxis: { type: 'category', data: ativos, axisLabel: { color: '#6B7A99' } },
                        yAxis: { type: 'value', axisLabel: { formatter: v => fmt(v), color: '#6B7A99' }, splitLine: { show: false } },
                        series: [
                            { name: 'Aporte', type: 'bar', data: ativos.map(a => +acc[a].aporte.toFixed(1)), itemStyle: { color: '#7C6BFF', borderRadius: [4, 4, 0, 0] } },
                            { name: 'Acumulado', type: 'bar', data: ativos.map(a => +acc[a].acum.toFixed(1)), itemStyle: { color: '#00E5FF', borderRadius: [4, 4, 0, 0] } }
                        ]
                    });
                } catch(e) {
                    console.error('ERRO ECHARTS BARRAS:', e);
                }
            };

            // Funis Top 10
            const renderFunnel = (investData, id, tipo, colorSet) => {
                const acc = {};
                investData.forEach(i => {
                    if (i.tipo === tipo) acc[i.ativo] = (acc[i.ativo] || 0) + parseFloat(i.acumulado || i.aporte || 0);
                });
                const data = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, v]) => ({ name: n, value: +v.toFixed(1) }));

                let dom = document.getElementById(id);
                try {
                    let oldChart = echarts.getInstanceByDom(dom);
                    if (oldChart) oldChart.dispose();
                    let chart = echarts.init(dom, 'dark');
                    chart.setOption({
                        backgroundColor: 'transparent',
                        tooltip: { ...tipStyle, trigger: 'item', formatter: '{b} : R$ {c}' },
                        color: colorSet,
                        series: [{
                            type: 'funnel', left: '10%', top: 20, bottom: 20, width: '80%', sort: 'descending', gap: 2,
                            label: { show: true, position: 'inside', fontSize: 13, formatter: '{b}', color: '#fff' }, labelLine: { show: false }, itemStyle: { borderColor: '#1A1F2E', borderWidth: 1 },
                            data: data
                        }]
                    });
                } catch(e) {
                    console.error('ERRO ECHARTS FUNNEL:', e);
                }
            };

            // ── 2. RENDERIZAÇÃO DO DASHBOARD (KPIs + Insights + Gráficos) ──
            const renderInvestDash = () => {
                INVEST = JSON.parse(localStorage.getItem('db_invest') || '[]');
                let tAporte = 0;
                let tAcum = 0;
                INVEST.forEach(i => {
                    tAporte += i.aporte || 0;
                    tAcum += i.acumulado || i.aporte || 0;
                });

                // Card Total Investido
                document.getElementById('inv-total-investido').textContent = fmt(tAporte);

                // Card Total Acumulado/Ganhos
                document.getElementById('inv-total-acumulado').textContent = fmt(tAcum);
                const ganho = tAcum - tAporte;
                const ganhoEl = document.getElementById('inv-ganho-label');
                ganhoEl.textContent = `Rendimento Líquido: ${ganho >= 0 ? '+' : ''}${fmt(ganho)}`;
                if (ganho > 0) ganhoEl.className = 'kpi-growth up';
                else if (ganho < 0) ganhoEl.className = 'kpi-growth down';

                // --- LÓGICA DE INSIGHTS ---
                let aporteFixa = 0, aporteVar = 0;
                let ganhoFixa = 0, ganhoVar = 0;

                INVEST.forEach(i => {
                    if (i.tipo === 'Renda Fixa') {
                        aporteFixa += i.aporte || 0;
                        ganhoFixa += (i.acumulado || i.aporte) - i.aporte;
                    } else {
                        aporteVar += i.aporte || 0;
                        ganhoVar += (i.acumulado || i.aporte) - i.aporte;
                    }
                });

                const pctFixaAporte = tAporte > 0 ? (aporteFixa / tAporte * 100) : 0;
                const pctVarAporte = tAporte > 0 ? (aporteVar / tAporte * 100) : 0;

                const elPctFixa = document.getElementById('ins-pct-fixa-aporte');
                if (elPctFixa) elPctFixa.textContent = pctFixaAporte.toFixed(1) + '%';
                const elBarFixa = document.getElementById('ins-bar-fixa-aporte');
                if (elBarFixa) elBarFixa.style.width = pctFixaAporte + '%';

                const elPctVar = document.getElementById('ins-pct-var-aporte');
                if (elPctVar) elPctVar.textContent = pctVarAporte.toFixed(1) + '%';
                const elBarVar = document.getElementById('ins-bar-var-aporte');
                if (elBarVar) elBarVar.style.width = pctVarAporte + '%';

                const pctFixaGanho = aporteFixa > 0 ? (ganhoFixa / aporteFixa * 100) : 0;
                const pctVarGanho = aporteVar > 0 ? (ganhoVar / aporteVar * 100) : 0;
                const pctTotalGanho = tAporte > 0 ? (ganho / tAporte * 100) : 0;

                const elFixaGanho = document.getElementById('ins-pct-fixa-ganho');
                if (elFixaGanho) elFixaGanho.textContent = (ganhoFixa >= 0 ? '+' : '') + pctFixaGanho.toFixed(2) + '%';

                const elVarGanho = document.getElementById('ins-pct-var-ganho');
                if (elVarGanho) elVarGanho.textContent = (ganhoVar >= 0 ? '+' : '') + pctVarGanho.toFixed(2) + '%';

                const elTotGanho = document.getElementById('ins-pct-total-ganho');
                if (elTotGanho) elTotGanho.textContent = (ganho >= 0 ? '+' : '') + pctTotalGanho.toFixed(2) + '%';

                // Detalhamento por Ativo
                const detalheAtivos = {};
                INVEST.forEach(i => {
                    if (!detalheAtivos[i.ativo]) detalheAtivos[i.ativo] = { aporte: 0, acumulado: 0, tipo: i.tipo };
                    detalheAtivos[i.ativo].aporte += i.aporte || 0;
                    detalheAtivos[i.ativo].acumulado += (i.acumulado || i.aporte || 0);
                });

                const listaHtml = Object.entries(detalheAtivos)
                    .sort((a, b) => (b[1].acumulado - b[1].aporte) - (a[1].acumulado - a[1].aporte))
                    .map(([nome, dados]) => {
                        const lucroAtivo = dados.acumulado - dados.aporte;
                        const pctAtivo = dados.aporte > 0 ? (lucroAtivo / dados.aporte * 100) : 0;
                        const cor = lucroAtivo >= 0 ? '#00E676' : '#FF6B8A';
                        const tagCor = dados.tipo === 'Renda Fixa' ? '#FFD700' : '#00E5FF';

                        return `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 8px; border-left: 3px solid ${tagCor};">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 0.8rem; font-weight: 700; color: #fff;">${nome}</span>
                                <span style="font-size: 0.65rem; color: #8B9BB4; text-transform: uppercase;">${dados.tipo}</span>
                            </div>
                            <span style="font-size: 0.85rem; font-weight: 800; color: ${cor};">${lucroAtivo >= 0 ? '▲' : '▼'} ${pctAtivo.toFixed(1)}%</span>
                        </div>
                    `;
                    }).join('');

                const containerLista = document.getElementById('ins-lista-ativos-detalhe');
                if (containerLista) {
                    containerLista.innerHTML = listaHtml || '<div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">Sem dados para detalhamento</div>';
                }

                const getLevel = (val) => {
                    if (val < 5000) return 'Starter';
                    if (val < 20000) return 'Bronze';
                    if (val < 50000) return 'Silver';
                    if (val < 150000) return 'Gold';
                    if (val < 500000) return 'Platinum';
                    return 'Diamond';
                };

                const getPerfil = (val) => {
                    if (val < 10000) return 'Conservador';
                    if (val < 50000) return 'Moderado';
                    if (val < 200000) return 'Arrojado';
                    return 'Institutional';
                };

                const elLevelAporte = document.getElementById('ins-level-aporte');
                if (elLevelAporte) elLevelAporte.textContent = getLevel(tAporte);

                const elLevelAtual = document.getElementById('ins-level-atual');
                if (elLevelAtual) elLevelAtual.textContent = getPerfil(tAcum);

                // Recria os gráficos com dados novos
                drawInvestBarras(INVEST, 'todos');
                renderFunnel(INVEST, 'chart-inv-funil-fixa', 'Renda Fixa', ['#FFD700', '#F5A623', '#E6A817', '#D4940F', '#C28508', '#FFE066']);
                renderFunnel(INVEST, 'chart-inv-funil-var', 'Renda Variável', ['#00E5FF', '#00B8D4', '#0097A7', '#4DD0E1', '#80DEEA', '#26C6DA']);
            };

            // ── 3. RENDERIZA IMEDIATAMENTE COM DADOS DO CACHE LOCAL ──
            renderInvestDash();

            // ── 4. ATUALIZAÇÃO DE PREÇOS VIA BACKEND (server-side, 1 chamada) ──
            // O backend lê do Supabase, busca preços nas APIs, atualiza e salva. Econômico (cache 1h server).
            const updateInvestPrices = async () => {
                const authToken = localStorage.getItem('auth_token');
                if (!authToken) return;

                try {
                    console.log('[Invest] Chamando backend para atualizar preços...');
                    const res = await fetch('http://localhost:3001/api/update-prices', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    const result = await res.json();
                    
                    if (result.updated && result.investments) {
                        // Atualiza localStorage e APP_DATA com dados atualizados do backend
                        localStorage.setItem('db_invest', JSON.stringify(result.investments));
                        if (window.APP_DATA) window.APP_DATA.db_invest = result.investments;
                        INVEST = result.investments;
                        console.log('[Invest] ✅ Preços atualizados pelo backend!');
                        renderInvestDash();
                    } else {
                        console.log('[Invest] Sem mudanças de preço.');
                    }
                } catch (err) {
                    console.error('[Invest] Erro ao atualizar preços:', err);
                }
            };

            // Dispara uma única vez ao abrir a página
            updateInvestPrices();

            // ── 5. FILTROS DOS BOTÕES ──
            // HTML usa data-f="todos", data-f="Renda Fixa", data-f="Renda Variável"
            document.querySelectorAll('.chart-filters[data-target="inv"] .fbtn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.chart-filters[data-target="inv"] .fbtn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const f = btn.dataset.f;
                    let currentData = JSON.parse(localStorage.getItem('db_invest') || '[]');
                    drawInvestBarras(currentData, f);
                });
            });

            // ── 6. RESIZE ──
            window.addEventListener('resize', () => {
                ['chart-inv-barras', 'chart-inv-funil-fixa', 'chart-inv-funil-var'].forEach(id => {
                    const inst = echarts.getInstanceByDom(document.getElementById(id));
                    if (inst) inst.resize();
                });
            });

        })(); // Finalizando a função async auto-executável
    }

});
