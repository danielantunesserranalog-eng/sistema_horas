let colaboradoresGlobais = [];
let lancamentosGlobais = [];

async function initLancamento() {
    await initSupabase();
    await verificarConexao();
    await atualizarStatsGlobais();
    
    colaboradoresGlobais = await Database.getColaboradores();
    lancamentosGlobais = await Database.getLancamentos();
    
    atualizarSelect();
    carregarTabelas(lancamentosGlobais);
    initMascaras();
    initMeses();
    
    document.getElementById("btnLancar").addEventListener("click", lancarHoras);
    document.getElementById("colaboradorSelect").addEventListener("change", (e) => {
        preencherFormulario(e.target.value);
    });
}

function initMeses() {
    const botoes = document.querySelectorAll(".mes-btn");
    const tabelas = document.querySelectorAll(".tabela-mes");
    botoes.forEach(btn => {
        btn.addEventListener("click", () => {
            const mes = btn.getAttribute("data-mes");
            botoes.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            tabelas.forEach(tabela => tabela.classList.remove("active-mes"));
            document.getElementById(mes).classList.add("active-mes");
        });
    });
}

function atualizarSelect() {
    const select = document.getElementById("colaboradorSelect");
    if(!select) return;
    select.innerHTML = '<option value="">Selecione um colaborador para carregar as horas</option>';
    colaboradoresGlobais.forEach(colab => {
        select.innerHTML += `<option value="${colab.id}">${colab.nome} - ${colab.cargo}</option>`;
    });
}

function carregarTabelas(todosLancamentos) {
    const meses = ['marco', 'abril', 'maio'];
    for (const mes of meses) {
        const tbody = document.getElementById(`tabela-${mes}`);
        if (!tbody) continue;
        tbody.innerHTML = '';
        for (const colab of colaboradoresGlobais) {
            const lanc = todosLancamentos.find(l => l.colaborador_id === colab.id && l.mes === mes);
            const f50 = Math.max(0, (lanc?.h50 || 0) - (lanc?.pago50 || 0));
            const f80 = Math.max(0, (lanc?.h80 || 0) - (lanc?.pago80 || 0));
            const f100 = Math.max(0, (lanc?.h100 || 0) - (lanc?.pago100 || 0));
            const fNot = Math.max(0, (lanc?.adicional_noturno || 0) - (lanc?.pago_noturno || 0));
            const fAtraso = lanc?.atrasos || 0;
            const falta = (f50 + f80 + f100 + fNot) + fAtraso; 
            
            tbody.innerHTML += `<tr>
                <td>${colab.nome}</td><td>${colab.cargo}</td>
                <td>${formatarHora(f50)}</td><td>${formatarHora(f80)}</td>
                <td>${formatarHora(f100)}</td><td>${formatarHora(fNot)}</td>
                <td style="color:#ffffff;">${formatarHora(fAtraso)}</td>
                <td style="background: var(--warning); font-weight: bold;">${formatarHora(falta)}</td>
            </tr>`;
        }
    }
}

function aplicarMascaraHora(evento) {
    let input = evento.target;
    if (evento.inputType === 'deleteContentBackward') return;
    let v = input.value.replace(/\D/g, "");
    if (v.length > 5) v = v.substring(0, 5);
    if (v.length >= 3) {
        let horas = v.substring(0, v.length - 2);
        let minutos = v.substring(v.length - 2);
        input.value = horas + ":" + minutos;
    } else { input.value = v; }
}

function initMascaras() {
    const meses = ['marco', 'abril', 'maio'];
    const camposHora = ["h50", "h80", "h100", "noturno", "pago50", "pago80", "pago100", "pagoNoturno", "atrasos"];
    meses.forEach(mes => {
        camposHora.forEach(campo => {
            const el = document.getElementById(`${campo}_${mes}`);
            if (el) el.addEventListener("input", aplicarMascaraHora);
        });
    });
}

function limparFormulario() {
    const meses = ['marco', 'abril', 'maio'];
    const campos = ["h50", "h80", "h100", "noturno", "pago50", "pago80", "pago100", "pagoNoturno", "atrasos"];
    meses.forEach(mes => {
        campos.forEach(campo => { setValSeguro(`${campo}_${mes}`, ""); });
    });
}

function preencherFormulario(colaboradorId) {
    limparFormulario();
    if (!colaboradorId) return;
    const meses = ['marco', 'abril', 'maio'];
    meses.forEach(mes => {
        const lanc = lancamentosGlobais.find(l => l.colaborador_id == colaboradorId && l.mes === mes);
        if (lanc) {
            setValSeguro(`h50_${mes}`, formatarHoraInput(lanc.h50));
            setValSeguro(`h80_${mes}`, formatarHoraInput(lanc.h80));
            setValSeguro(`h100_${mes}`, formatarHoraInput(lanc.h100));
            setValSeguro(`noturno_${mes}`, formatarHoraInput(lanc.adicional_noturno));
            setValSeguro(`pago50_${mes}`, formatarHoraInput(lanc.pago50));
            setValSeguro(`pago80_${mes}`, formatarHoraInput(lanc.pago80));
            setValSeguro(`pago100_${mes}`, formatarHoraInput(lanc.pago100));
            setValSeguro(`pagoNoturno_${mes}`, formatarHoraInput(lanc.pago_noturno));
            setValSeguro(`atrasos_${mes}`, formatarHoraInput(lanc.atrasos));
        }
    });
}

async function lancarHoras() {
    const colaboradorId = document.getElementById("colaboradorSelect").value;
    if (!colaboradorId) { alert("Selecione um colaborador primeiro!"); return; }
    
    const btnLancar = document.getElementById("btnLancar");
    const textoOriginal = btnLancar.innerHTML;
    btnLancar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando os 3 meses...';
    btnLancar.disabled = true;

    const meses = ['marco', 'abril', 'maio'];
    let sucesso = true; let salvouAlgum = false;

    try {
        for (const mes of meses) {
            const h50 = converterTempoParaDecimal(getValSeguro(`h50_${mes}`));
            const h80 = converterTempoParaDecimal(getValSeguro(`h80_${mes}`));
            const h100 = converterTempoParaDecimal(getValSeguro(`h100_${mes}`));
            const noturno = converterTempoParaDecimal(getValSeguro(`noturno_${mes}`));
            const pago50 = converterTempoParaDecimal(getValSeguro(`pago50_${mes}`));
            const pago80 = converterTempoParaDecimal(getValSeguro(`pago80_${mes}`));
            const pago100 = converterTempoParaDecimal(getValSeguro(`pago100_${mes}`));
            const pagoNoturno = converterTempoParaDecimal(getValSeguro(`pagoNoturno_${mes}`));
            const atrasos = converterTempoParaDecimal(getValSeguro(`atrasos_${mes}`));

            const somaTotal = h50 + h80 + h100 + noturno + pago50 + pago80 + pago100 + pagoNoturno + atrasos;
            const lancExistente = lancamentosGlobais.find(l => l.colaborador_id == colaboradorId && l.mes === mes);
            
            if (somaTotal === 0 && !lancExistente) continue; 

            const lancamento = {
                colaborador_id: parseInt(colaboradorId), mes: mes, h50: h50, h80: h80, h100: h100,
                adicional_noturno: noturno, pago50: pago50, pago80: pago80, pago100: pago100, pago_noturno: pagoNoturno, atrasos: atrasos
            };
            if (lancExistente && lancExistente.id) lancamento.id = lancExistente.id;
            
            const result = await Database.upsertLancamento(lancamento);
            if (!result) sucesso = false;
            salvouAlgum = true;
        }
    } catch (error) { console.error("Erro interno:", error); sucesso = false; }
    
    btnLancar.innerHTML = textoOriginal;
    btnLancar.disabled = false;

    if (!salvouAlgum) { alert("⚠️ Nenhum valor foi preenchido para salvar."); return; }
    if (sucesso) {
        lancamentosGlobais = await Database.getLancamentos();
        carregarTabelas(lancamentosGlobais);
        await atualizarStatsGlobais();
        limparFormulario(); 
        document.getElementById("colaboradorSelect").value = ""; 
        alert("✅ Lançamentos salvos com sucesso!");
    } else { alert("❌ Ocorreu um erro ao salvar algumas horas. Tente novamente."); }
}

document.addEventListener("DOMContentLoaded", initLancamento);