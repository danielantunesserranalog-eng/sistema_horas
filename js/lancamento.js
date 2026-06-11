let colaboradoresGlobais = [];
let lancamentosGlobais = [];
let dadosImportadosExcel = [];

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

    const inputExcel = document.getElementById("arquivoExcel");
    if(inputExcel) inputExcel.addEventListener("change", lerArquivoExcel);
    
    const btnConfirmarImp = document.getElementById("btnConfirmarImportacao");
    if(btnConfirmarImp) btnConfirmarImp.addEventListener("click", salvarImportacao);
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
        
        // Otimização: Montar string HTML antes de injetar (Evita travamentos na tela normal também)
        let htmlTabela = "";
        
        for (const colab of colaboradoresGlobais) {
            const lanc = todosLancamentos.find(l => l.colaborador_id === colab.id && l.mes === mes);
            const f50 = Math.max(0, (lanc?.h50 || 0) - (lanc?.pago50 || 0));
            const f80 = Math.max(0, (lanc?.h80 || 0) - (lanc?.pago80 || 0));
            const f100 = Math.max(0, (lanc?.h100 || 0) - (lanc?.pago100 || 0));
            const fNot = Math.max(0, (lanc?.adicional_noturno || 0) - (lanc?.pago_noturno || 0));
            const fAtraso = lanc?.atrasos || 0;
            const falta = (f50 + f80 + f100 + fNot) + fAtraso; 
            
            htmlTabela += `<tr>
                <td>${colab.nome}</td><td>${colab.cargo}</td>
                <td>${formatarHora(f50)}</td><td>${formatarHora(f80)}</td>
                <td>${formatarHora(f100)}</td><td>${formatarHora(fNot)}</td>
                <td style="color:#ffffff;">${formatarHora(fAtraso)}</td>
                <td style="background: var(--warning); font-weight: bold;">${formatarHora(falta)}</td>
            </tr>`;
        }
        tbody.innerHTML = htmlTabela;
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

// ==========================================
// FUNÇÕES DE IMPORTAÇÃO DE EXCEL (ULTRA RÁPIDA)
// ==========================================

async function lerArquivoExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Pega o botão para colocar o Loading (girando) e travar a tela
    const btnImportar = document.querySelector('button[onclick="document.getElementById(\'arquivoExcel\').click()"]');
    const textoOriginal = btnImportar.innerHTML;
    btnImportar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lendo Excel...';
    btnImportar.disabled = true;

    // Timeout de 50ms para permitir que o navegador atualize o botão antes de travar lendo o Excel
    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Lê a matriz
                const matriz = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false, defval: ""}); 
                
                processarDadosMatriz(matriz);
            } catch(erro) {
                console.error("Erro ao ler excel:", erro);
                alert("Houve um problema ao ler este arquivo.");
            } finally {
                // Restaura o botão
                btnImportar.innerHTML = textoOriginal;
                btnImportar.disabled = false;
                document.getElementById('arquivoExcel').value = ''; // reseta
            }
        };
        reader.readAsArrayBuffer(file);
    }, 50);
}

function processarDadosMatriz(matriz) {
    dadosImportadosExcel = [];
    const tbody = document.getElementById("corpoPreviewImportacao");
    if(!tbody) return;

    if (!matriz || matriz.length === 0) {
        alert("O arquivo está vazio!");
        return;
    }

    // 1. Procurar em qual linha está a palavra "Nome"
    let linhaCabecalhoIndex = -1;
    let indexColunaNome = -1;

    for (let i = 0; i < matriz.length; i++) {
        const linha = matriz[i];
        for (let j = 0; j < linha.length; j++) {
            if (String(linha[j]).trim().toLowerCase() === 'nome') {
                linhaCabecalhoIndex = i;
                indexColunaNome = j;
                break;
            }
        }
        if (linhaCabecalhoIndex !== -1) break;
    }

    if (linhaCabecalhoIndex === -1) {
        alert("Erro: Não encontrei nenhuma coluna chamada 'Nome' no Excel.");
        return;
    }

    // 2. Mapear as colunas
    const cabecalho = matriz[linhaCabecalhoIndex].map(c => String(c).trim().toLowerCase());
    
    let cols = {
        h50: cabecalho.indexOf('h50'), h80: cabecalho.indexOf('h80'), h100: cabecalho.indexOf('h100'), noturno: cabecalho.indexOf('noturno'),
        pago50: cabecalho.indexOf('pago50'), pago80: cabecalho.indexOf('pago80'), pago100: cabecalho.indexOf('pago100'), pagoNoturno: cabecalho.indexOf('pagonoturno'),
        atrasos: cabecalho.indexOf('atrasos')
    };

    if (cols.h50 === -1 && cabecalho.includes('hora extra 50%')) {
        const todos100 = cabecalho.reduce((arr, val, i) => val === 'hora extra 100%' ? [...arr, i] : arr, []);
        const todos50 = cabecalho.reduce((arr, val, i) => val === 'hora extra 50%' ? [...arr, i] : arr, []);
        const todos80 = cabecalho.reduce((arr, val, i) => val === 'hora extra 80%' ? [...arr, i] : arr, []);
        const todosNoturno = cabecalho.reduce((arr, val, i) => val === 'adicional noturno' ? [...arr, i] : arr, []);

        if (todos50.length >= 2) {
            cols.pago100 = todos100[0]; cols.h100 = todos100[1];
            cols.pago50 = todos50[0];   cols.h50 = todos50[1];
            cols.pago80 = todos80[0];   cols.h80 = todos80[1];
            cols.pagoNoturno = todosNoturno[0]; cols.noturno = todosNoturno[1];
        }
    }

    // OTIMIZAÇÃO DE BUSCA: Criar uma lista de colaboradores com nomes já em minúsculas (MUITO MAIS RÁPIDO)
    const colabsBuscaRápida = colaboradoresGlobais.map(c => ({
        id: c.id,
        nomeOriginal: c.nome,
        nomeLower: c.nome.toLowerCase().trim()
    }));

    let encontrouLinhas = false;
    
    // OTIMIZAÇÃO DOM: Guardar o HTML todo numa variável e colocar só no fim (EVITA O TRAVAMENTO)
    let htmlPreview = "";

    for (let i = linhaCabecalhoIndex + 1; i < matriz.length; i++) {
        const linha = matriz[i];
        const nomeExcelOrig = String(linha[indexColunaNome] || '').trim();
        
        if (!nomeExcelOrig || nomeExcelOrig === 'undefined') continue;
        encontrouLinhas = true;

        const nomeExcelBaixa = nomeExcelOrig.toLowerCase();

        // Busca Super Rápida
        let colabEncontrado = colabsBuscaRápida.find(c => c.nomeLower === nomeExcelBaixa);
        if (!colabEncontrado) {
            colabEncontrado = colabsBuscaRápida.find(c => 
                c.nomeLower.includes(nomeExcelBaixa) || 
                nomeExcelBaixa.includes(c.nomeLower)
            );
        }

        const pegarValor = (indexCol) => (indexCol !== -1 && linha[indexCol] !== undefined) ? linha[indexCol] : "00:00";

        const dadosLinha = {
            idLinha: i,
            nomeExcel: nomeExcelOrig,
            colaboradorId: colabEncontrado ? colabEncontrado.id : '',
            h50: extrairStringHora(pegarValor(cols.h50)),
            h80: extrairStringHora(pegarValor(cols.h80)),
            h100: extrairStringHora(pegarValor(cols.h100)),
            noturno: extrairStringHora(pegarValor(cols.noturno)),
            pago50: extrairStringHora(pegarValor(cols.pago50)),
            pago80: extrairStringHora(pegarValor(cols.pago80)),
            pago100: extrairStringHora(pegarValor(cols.pago100)),
            pagoNoturno: extrairStringHora(pegarValor(cols.pagoNoturno)),
            atrasos: extrairStringHora(pegarValor(cols.atrasos))
        };
        
        dadosImportadosExcel.push(dadosLinha);

        const classeErro = colabEncontrado ? "" : "erro";
        
        // Montamos o select (usando o id da lista original)
        let optionsHtml = `<option value="">-- NÃO ENCONTRADO --</option>`;
        for(let j=0; j < colaboradoresGlobais.length; j++) {
            const c = colaboradoresGlobais[j];
            const isSelected = (colabEncontrado && colabEncontrado.id === c.id) ? 'selected' : '';
            optionsHtml += `<option value="${c.id}" ${isSelected}>${c.nome}</option>`;
        }

        let selectColab = `<select class="vincular-select ${classeErro}" data-idlinha="${i}">${optionsHtml}</select>`;

        // Acumula na variável em vez de jogar direto na tela
        htmlPreview += `<tr>
            <td><strong>${nomeExcelOrig}</strong></td>
            <td>${selectColab}</td>
            <td>${dadosLinha.h50}</td><td>${dadosLinha.h80}</td><td>${dadosLinha.h100}</td><td>${dadosLinha.noturno}</td>
            <td>${dadosLinha.pago50}</td><td>${dadosLinha.pago80}</td><td>${dadosLinha.pago100}</td><td>${dadosLinha.pagoNoturno}</td>
            <td style="color: var(--warning);">${dadosLinha.atrasos}</td>
        </tr>`;
    }

    if(!encontrouLinhas) {
        alert("Não foram encontrados dados válidos abaixo do cabeçalho.");
        return;
    }

    // Injeta tudo de uma vez só! (É aqui que a mágica da velocidade acontece)
    tbody.innerHTML = htmlPreview;

    // Ativa os eventos dos selects depois de injetados na tela
    document.querySelectorAll('.vincular-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const idLinha = parseInt(e.target.dataset.idlinha);
            const dado = dadosImportadosExcel.find(d => d.idLinha === idLinha);
            if (dado) dado.colaboradorId = e.target.value;
            if(e.target.value) e.target.classList.remove("erro");
            else e.target.classList.add("erro");
        });
    });

    document.getElementById("modalImportacao").style.display = "flex";
}

function extrairStringHora(val) {
    if (val === undefined || val === null || val === '') return "00:00";
    let strVal = String(val).replace(/=/g, '').trim();
    if(strVal === '') return "00:00";
    
    if (strVal.includes(':')) {
        let partes = strVal.split(':');
        let h = partes[0].padStart(2, '0');
        let m = partes[1].padStart(2, '0');
        return `${h}:${m}`;
    }
    
    let num = parseFloat(strVal.replace(',', '.'));
    if (isNaN(num) || num < 0) return "00:00";
    return formatarHoraInput(num);
}

async function salvarImportacao() {
    const mesSelecionado = document.getElementById("mesImportacao").value;
    const btn = document.getElementById("btnConfirmarImportacao");
    
    const temAlguemVinculado = dadosImportadosExcel.some(d => d.colaboradorId !== '');
    if(!temAlguemVinculado) {
        alert("Nenhum colaborador foi vinculado! Selecione os nomes na coluna 'Vincular a...'.");
        return;
    }

    if(!confirm(`Deseja lançar estas horas no mês de ${mesSelecionado.toUpperCase()}? (Isso substituirá/atualizará os lançamentos existentes para estas pessoas neste mês).`)) return;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando no Banco...';
    btn.disabled = true;

    let salvouAlgum = false;
    let erro = false;

    try {
        for (const dado of dadosImportadosExcel) {
            if (!dado.colaboradorId) continue; 

            const lancamento = {
                colaborador_id: parseInt(dado.colaboradorId), 
                mes: mesSelecionado, 
                h50: converterTempoParaDecimal(dado.h50), 
                h80: converterTempoParaDecimal(dado.h80), 
                h100: converterTempoParaDecimal(dado.h100),
                adicional_noturno: converterTempoParaDecimal(dado.noturno), 
                pago50: converterTempoParaDecimal(dado.pago50), 
                pago80: converterTempoParaDecimal(dado.pago80), 
                pago100: converterTempoParaDecimal(dado.pago100), 
                pago_noturno: converterTempoParaDecimal(dado.pagoNoturno), 
                atrasos: converterTempoParaDecimal(dado.atrasos)
            };

            const lancExistente = lancamentosGlobais.find(l => l.colaborador_id == dado.colaboradorId && l.mes === mesSelecionado);
            if (lancExistente && lancExistente.id) {
                lancamento.id = lancExistente.id;
            }

            const result = await Database.upsertLancamento(lancamento);
            if (result) salvouAlgum = true;
            else erro = true;
        }
    } catch (e) {
        console.error("Erro na importação:", e);
        erro = true;
    }

    btn.innerHTML = '<i class="fas fa-check"></i> Salvar Lançamentos Selecionados';
    btn.disabled = false;

    if (erro) {
        alert("❌ Houve um erro ao salvar alguns registos. Verifique a conexão.");
    } else if (salvouAlgum) {
        alert(`✅ Horas importadas e salvas com sucesso na competência: ${mesSelecionado.toUpperCase()}!`);
        document.getElementById("modalImportacao").style.display = 'none';
        
        lancamentosGlobais = await Database.getLancamentos();
        carregarTabelas(lancamentosGlobais);
        await atualizarStatsGlobais();
    }
}

document.addEventListener("DOMContentLoaded", initLancamento);