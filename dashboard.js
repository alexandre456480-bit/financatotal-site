// dashboard.js — ECharts + KPIs para index.html e cartoes.html
document.addEventListener('DOMContentLoaded', () => {

    const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 1 }).format(v);
    const FLUXO = JSON.parse(localStorage.getItem('db_fluxo') || '[]');
    const CARTAO = JSON.parse(localStorage.getItem('db_cartao') || '[]');

    // Agrupador genérico
    const group = (arr, mode) => {
        const m = {};
        arr.forEach(d => {
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
        const cm = dayjs().format('YYYY-MM');
        const pm = dayjs().subtract(1, 'month').format('YYYY-MM');
        let rT = 0, rC = 0, rP = 0, dT = 0, dC = 0, dP = 0;

        FLUXO.forEach(i => {
            const v = i.valor || 0;
            const mm = dayjs(i.data).format('YYYY-MM');
            if (i.tipo === 'Receita') { rT += v; if (mm === cm) rC += v; if (mm === pm) rP += v; }
            else { dT += v; if (mm === cm) dC += v; if (mm === pm) dP += v; }
        });

        document.getElementById('kpi-saldo').textContent = fmt(rT - dT);
        document.getElementById('kpi-receita').textContent = fmt(rT);
        document.getElementById('kpi-despesa').textContent = fmt(dT);

        const setGrowth = (el, cur, prev, invert) => {
            const diff = cur - prev;
            if (diff > 0) { el.className = 'kpi-growth ' + (invert ? 'down' : 'up'); el.textContent = '▲ +' + fmt(diff) + ' no mês'; }
            else if (diff < 0) { el.className = 'kpi-growth ' + (invert ? 'up' : 'down'); el.textContent = '▼ ' + fmt(diff) + ' no mês'; }
            else { el.className = 'kpi-growth flat'; el.textContent = '— Sem variação'; }
        };
        setGrowth(document.getElementById('growth-saldo'), rC - dC, rP - dP, false);
        setGrowth(document.getElementById('growth-receita'), rC, rP, false);
        setGrowth(document.getElementById('growth-despesa'), dC, dP, true);

        // Gráfico Área — Receita x Despesa
        const drawFluxo = (mode) => {
            const g = group(FLUXO, mode);
            const labels = Object.keys(g);
            echarts.init(document.getElementById('chart-fluxo'), 'dark').setOption({ backgroundColor: 'transparent',
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
            const g = group(FLUXO, mode);
            const labels = Object.keys(g);
            let acc = 0;
            const vals = labels.map(l => { acc += g[l].rec - g[l].desp; return +acc.toFixed(1); });
            echarts.init(document.getElementById('chart-saldo'), 'dark').setOption({ backgroundColor: 'transparent',
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
            FLUXO.forEach(d => { if (d.tipo === tipo) acc[d.categoria] = (acc[d.categoria] || 0) + d.valor; });
            const data = Object.entries(acc).map(([n, v]) => ({ name: n, value: +v.toFixed(1) }));
            const colors = tipo === 'Receita' ? ['#33ff00ff', '#076617ff', '#84e64cff', '#0c961eff', '#0c740cff', '#9ceb53ff', '#094713ff'] : ['#FF6B8A', '#E8415A', '#D32F2F', '#FF8A80', '#FFAB91', '#EF5350', '#C62828'];
            echarts.init(document.getElementById('chart-cat'), 'dark').setOption({ backgroundColor: 'transparent',
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
                FLUXO.forEach(d => { if (d.tipo === tipo && d.categoria) catSet.add(d.categoria); });
                catSet.forEach(c => { selectEl.innerHTML += `<option value="${c}">${c}</option>`; });
                selectEl.addEventListener('change', (e) => {
                    drawTop(tipo === 'Receita' ? 'chart-top-rec' : 'chart-top-desp', tipo, e.target.value);
                });
            }
        });

        // Barras Horiz — Top7
        const drawTop = (id, tipo, filterCat = 'todas') => {
            const acc = {};
            FLUXO.forEach(d => { 
                if (d.tipo === tipo) {
                    if (filterCat === 'todas' || d.categoria === filterCat) {
                        const label = d.subcategoria || d.categoria; 
                        acc[label] = (acc[label] || 0) + d.valor;
                    }
                }
            });
            const sorted = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 7);
            const labels = sorted.map(i => i[0]).reverse();
            const vals = sorted.map(i => +i[1].toFixed(1)).reverse();
            const c1 = tipo === 'Receita' ? '#086632ff' : '#C62828';
            const c2 = tipo === 'Receita' ? '#0d915eff' : '#FF6B8A';
            const inst = echarts.getInstanceByDom(document.getElementById(id)) || echarts.init(document.getElementById(id), 'dark');
            inst.setOption({ backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { top: 10, left: '3%', right: '14%', bottom: 10, containLabel: true },
                xAxis: { type: 'value', show: false, splitLine: { show: false } },
                yAxis: { type: 'category', data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#6B7A99' } },
                series: [{ type: 'bar', data: vals, barWidth: 18, itemStyle: { borderRadius: [0, 6, 6, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: c1 }, { offset: 1, color: c2 }]) }, label: { show: true, position: 'right', formatter: p => fmt(p.value), fontSize: 11, color: '#6B7A99' } }]
            }, true); // true para limpar series antigas se mudar de dados
        };

        drawFluxo('dia'); drawSaldo('dia'); drawCat('Receita');
        drawTop('chart-top-rec', 'Receita'); drawTop('chart-top-desp', 'Despesa');

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
        let t1 = 0, t2 = 0;
        const hoje = dayjs();
        const topList = [];

        CARTAO.forEach(item => {
            const dt = dayjs(item.data);
            const c = item.cartao || 'Cartão 1';

            if (item.tipo === 'Parcela') {
                const np = parseInt(item.parcelas) || 1;
                const vp = item.valorParcela || 0;
                const pagas = Math.max(0, hoje.diff(dt, 'month'));

                // Total projetado
                if (c === 'Cartão 1') t1 += np * vp; else t2 += np * vp;

                // Se ainda deve parcela este mês
                if (pagas < np) {
                    topList.push({ data: item.data, desc: item.desc || 'Compra Parcelada', cartao: c, status: `${pagas + 1}/${np}`, valor: vp });
                }
            } else {
                const vf = item.valorFatura || 0;
                if (c === 'Cartão 1') t1 += vf; else t2 += vf;
                if (dt.month() === hoje.month() && dt.year() === hoje.year()) {
                    topList.push({ data: item.data, desc: item.desc || 'Fatura', cartao: c, status: 'Integral', valor: vf });
                }
            }
        });

        document.getElementById('mc-total-1').textContent = fmt(t1);
        document.getElementById('mc-total-2').textContent = fmt(t2);

        // Gráfico evo
        const drawCartaoEvo = (mode) => {
            const acc1 = {}, acc2 = {}, all = new Set();
            CARTAO.forEach(d => {
                let k = '';
                if (mode === 'dia') k = dayjs(d.data).format('DD/MM');
                if (mode === 'semana') k = 'S' + dayjs(d.data).week();
                if (mode === 'mes') k = dayjs(d.data).format('MMM/YY');
                if (mode === 'ano') k = dayjs(d.data).format('YYYY');
                all.add(k);
                const v = d.tipo === 'Parcela' ? d.valorParcela * d.parcelas : d.valorFatura;
                const c = d.cartao || 'Cartão 1';
                if (c === 'Cartão 1') { acc1[k] = (acc1[k] || 0) + v; } else { acc2[k] = (acc2[k] || 0) + v; }
            });
            const labels = [...all];
            echarts.init(document.getElementById('chart-cartao-evo'), 'dark').setOption({ backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'axis' },
                legend: { data: ['Cartão 1', 'Cartão 2'], bottom: 0, textStyle: { color: '#6B7A99' } },
                grid: { left: '3%', right: '4%', bottom: '16%', top: '8%', containLabel: true },
                xAxis: { type: 'category', boundaryGap: false, data: labels, axisLabel: { color: '#6B7A99' } },
                yAxis: { type: 'value', axisLabel: { formatter: v => fmt(v), color: '#6B7A99' }, splitLine: { show: false } },
                series: [
                    { name: 'Cartão 1', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#201b44ff' }, lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(124,107,255,0.5)' }, areaStyle: { color: grad(neonPurple) }, data: labels.map(l => +(acc1[l] || 0).toFixed(1)) },
                    { name: 'Cartão 2', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#606061ff' }, lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }, areaStyle: { color: grad(neonSilver) }, data: labels.map(l => +(acc2[l] || 0).toFixed(1)) }
                ]
            });
        };
        drawCartaoEvo('dia');
        window.drawCartaoEvo = drawCartaoEvo;

        window.addEventListener('resize', () => {
            const inst = echarts.getInstanceByDom(document.getElementById('chart-cartao-evo'));
            if (inst) inst.resize();
        });

        // Top 15 Funil (Agora usando Barras Horizontais do Maior pro Menor - Formato Funil)
        topList.sort((a, b) => a.valor - b.valor); // ascending para exibir os maiores em cima no echarts
        const tf_arr = topList.slice(Math.max(topList.length - 15, 0));
        const tf_labels = tf_arr.map(i => i.desc.substring(0,18) + ' (' + i.cartao + ')');
        const tf_vals = tf_arr.map(i => +i.valor.toFixed(1));
        
        if (document.getElementById('chart-top15-funil')) {
            echarts.init(document.getElementById('chart-top15-funil'), 'dark').setOption({ backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { top: 10, left: '3%', right: '15%', bottom: 10, containLabel: true },
                xAxis: { type: 'value', show: false },
                yAxis: { type: 'category', data: tf_labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#6B7A99', fontSize: 11 } },
                series: [{
                    type: 'bar', data: tf_vals, barWidth: 14,
                    itemStyle: { borderRadius: [0, 6, 6, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#5A54E8' }, { offset: 1, color: '#00E5FF' }]) },
                    label: { show: true, position: 'right', formatter: p => fmt(p.value), fontSize: 11, color: '#E8ECF4' }
                }]
            });
            window.addEventListener('resize', () => {
                const inst2 = echarts.getInstanceByDom(document.getElementById('chart-top15-funil'));
                if (inst2) inst2.resize();
            });
        }
    }

    // ===== METAS.HTML — DASH METAS =====
    if (document.getElementById('chart-kpi-meta1')) {
        const METAS = JSON.parse(localStorage.getItem('db_metas') || '[]');

        // Setup Gauge Helper
        const createNeonGauge = (elId, title, subText, percent, color) => {
            const chart = echarts.init(document.getElementById(elId), 'dark');
            chart.setOption({ backgroundColor: 'transparent',
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
        const labelsEvo = Object.keys(metasNoTempo).sort((a, b) => dayjs(a, 'DD/MM/YYYY').diff(dayjs(b, 'DD/MM/YYYY')));
        let accMeta = 0;
        const valsEvo = labelsEvo.map(l => { accMeta += metasNoTempo[l]; return +accMeta.toFixed(1); });

        echarts.init(document.getElementById('chart-metas-evo'), 'dark').setOption({ backgroundColor: 'transparent',
            tooltip: { ...tipStyle, trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '8%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: labelsEvo, axisLabel: { color: '#6B7A99' } },
            yAxis: { type: 'value', axisLabel: { formatter: v => fmt(v), color: '#6B7A99' }, splitLine: { show: false } },
            series: [{ type: 'line', smooth: true, itemStyle: { color: '#7C6BFF' }, lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(124,107,255,0.5)' }, areaStyle: { color: grad(neonPurple) }, data: valsEvo }]
        });

        // Top 10 Metas
        const top10 = sortedByVal.slice(0, 10);
        echarts.init(document.getElementById('chart-metas-top10'), 'dark').setOption({ backgroundColor: 'transparent',
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
        const INVEST = JSON.parse(localStorage.getItem('db_invest') || '[]');

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

        // Barras Verticais
        const drawInvestBarras = (filter) => {
            const acc = {};
            INVEST.forEach(i => {
                if (filter === 'todos' || filter === i.tipo) {
                    if (!acc[i.ativo]) acc[i.ativo] = { aporte: 0, acum: 0 };
                    acc[i.ativo].aporte += i.aporte;
                    acc[i.ativo].acum += (i.acumulado || i.aporte);
                }
            });
            const ativos = Object.keys(acc);

            echarts.init(document.getElementById('chart-inv-barras'), 'dark').setOption({ backgroundColor: 'transparent',
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
        };
        drawInvestBarras('todos');

        document.querySelectorAll('.chart-filters[data-target="inv"] .fbtn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chart-filters[data-target="inv"] .fbtn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                drawInvestBarras(btn.dataset.f);
            });
        });

        // Funis Top 10
        const renderFunnel = (id, tipo, colorSet) => {
            const acc = {};
            INVEST.forEach(i => {
                if (i.tipo === tipo) acc[i.ativo] = (acc[i.ativo] || 0) + (i.acumulado || i.aporte);
            });
            const data = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, v]) => ({ name: n, value: +v.toFixed(1) }));

            echarts.init(document.getElementById(id), 'dark').setOption({ backgroundColor: 'transparent',
                tooltip: { ...tipStyle, trigger: 'item', formatter: '{b} : R$ {c}' },
                color: colorSet,
                series: [{
                    type: 'funnel', left: '10%', top: 20, bottom: 20, width: '80%', sort: 'descending', gap: 2,
                    label: { show: true, position: 'inside', fontSize: 13, formatter: '{b}', color: '#fff' }, labelLine: { show: false }, itemStyle: { borderColor: '#1A1F2E', borderWidth: 1 },
                    data: data
                }]
            });
        };

        renderFunnel('chart-inv-funil-fixa', 'Renda Fixa', ['#FFD700', '#F5A623', '#E6A817', '#D4940F', '#C28508', '#FFE066']);
        renderFunnel('chart-inv-funil-var', 'Renda Variável', ['#00E5FF', '#00B8D4', '#0097A7', '#4DD0E1', '#80DEEA', '#26C6DA']);

        window.addEventListener('resize', () => {
            ['chart-inv-barras', 'chart-inv-funil-fixa', 'chart-inv-funil-var'].forEach(id => {
                const inst = echarts.getInstanceByDom(document.getElementById(id));
                if (inst) inst.resize();
            });
        });
    }

});
