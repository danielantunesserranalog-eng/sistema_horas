let colaboradores = [];
let dadosRelatorio = [];
let lancamentosGlobais = []; 

// =========================================================================
// FUNÇÕES DE FORMATAR HORA E MANIPULAR INPUTS
// =========================================================================
function formatarHora(decimal) {
    if (!decimal || isNaN(decimal) || decimal <= 0) return "00:00";
    decimal = Math.max(0, decimal);
    const horas = Math.floor(decimal);
    const minutos = Math.round((decimal - horas) * 60);
    if (minutos === 60) return `${String(horas + 1).padStart(2, '0')}:00`;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function formatarHoraInput(decimal) {
    if (!decimal || isNaN(decimal) || decimal <= 0) return "";
    const horas = Math.floor(decimal);
    const minutos = Math.round((decimal - horas) * 60);
    if (minutos === 60) return `${String(horas + 1).padStart(2, '0')}:00`;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

// Pega o valor do input de forma segura
function getValSeguro(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}

function setValSeguro(id, valor) {
    const el = document.getElementById(id);
    if (el) el.value = valor;
}

// Carregar dados iniciais
async function carregarDadosIniciais() {
    await initSupabase();
    
    colaboradores = await Database.getColaboradores();
    lancamentosGlobais = await Database.getLancamentos();
    
    atualizarSelect();
    atualizarLista();
    
    carregarTabelas(lancamentosGlobais);
    await carregarResumo(lancamentosGlobais);
    carregarFiltros();
    await atualizarPrevia(lancamentosGlobais);
    await atualizarStats(lancamentosGlobais);
}

// Carregar filtros
function carregarFiltros() {
    const filtroColab = document.getElementById("filtroColaborador");
    if (!filtroColab) return;
    filtroColab.innerHTML = '<option value="todos">Todos os colaboradores</option>';
    colaboradores.forEach(colab => {
        filtroColab.innerHTML += `<option value="${colab.id}">${colab.nome}</option>`;
    });
}

// Obter dados do relatório bruto (Detalhado)
async function obterDadosRelatorio(todosLancamentos = null) {
    const colaboradorId = document.getElementById("filtroColaborador").value;
    const periodo = document.getElementById("filtroPeriodo").value;
    
    if (!todosLancamentos) todosLancamentos = lancamentosGlobais;
    
    const resumo = await Database.getResumoGeral(colaboradores, todosLancamentos);
    let dados = [];
    
    for (const item of resumo) {
        if (colaboradorId !== "todos" && item.colaborador.id != colaboradorId) continue;
        
        const meses = periodo === "todos" ? ["marco", "abril", "maio"] : [periodo];
        
        for (const mes of meses) {
            const lanc = todosLancamentos.find(l => l.colaborador_id === item.colaborador.id && l.mes === mes);
            
            if (!lanc && periodo !== "todos") continue;
            
            const h50 = Math.max(0, (lanc?.h50 || 0) - (lanc?.pago50 || 0));
            const h80 = Math.max(0, (lanc?.h80 || 0) - (lanc?.pago80 || 0));
            const h100 = Math.max(0, (lanc?.h100 || 0) - (lanc?.pago100 || 0));
            const noturno = Math.max(0, (lanc?.adicional_noturno || 0) - (lanc?.pago_noturno || 0));
            const total = h50 + h80 + h100 + noturno;
            
            if (total > 0 || periodo !== "todos") {
                dados.push({
                    colaborador: item.colaborador.nome,
                    cargo: item.colaborador.cargo,
                    mes: mes.charAt(0).toUpperCase() + mes.slice(1),
                    h50: h50,
                    h80: h80,
                    h100: h100,
                    noturno: noturno,
                    total: total
                });
            }
        }
    }
    
    return dados;
}

// Agrupa e soma os dados de todos os meses por Colaborador
function agruparDadosRelatorio(dados) {
    const resumoMap = {};
    dados.forEach(row => {
        const chave = row.colaborador + "|" + row.cargo;
        if (!resumoMap[chave]) {
            resumoMap[chave] = {
                colaborador: row.colaborador,
                cargo: row.cargo,
                h50: 0,
                h80: 0,
                h100: 0,
                noturno: 0,
                total: 0
            };
        }
        resumoMap[chave].h50 += row.h50;
        resumoMap[chave].h80 += row.h80;
        resumoMap[chave].h100 += row.h100;
        resumoMap[chave].noturno += row.noturno;
        resumoMap[chave].total += row.total;
    });
    return Object.values(resumoMap);
}

// Atualizar prévia do relatório (Agrupado / Somado)
async function atualizarPrevia(todosLancamentos = null) {
    dadosRelatorio = await obterDadosRelatorio(todosLancamentos);
    const dadosAgrupados = agruparDadosRelatorio(dadosRelatorio);
    
    const previewDiv = document.getElementById("previaTabela");
    const dataSpan = document.getElementById("previewData");
    
    if(!previewDiv) return;
    
    dataSpan.innerHTML = `<i class="fas fa-calendar"></i> Gerado em: ${new Date().toLocaleString()}`;
    
    if (dadosAgrupados.length === 0) {
        previewDiv.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary);"><i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>Nenhum dado encontrado com os filtros selecionados.</div>';
        return;
    }
    
    let html = '<table><thead><tr>';
    html += '<th>Colaborador</th><th>Cargo</th><th>Devido 50%</th><th>Devido 80%</th><th>Devido 100%</th><th>Ad. Noturno</th><th>Total (h)</th>';
    html += '</tr></thead><tbody>';
    
    let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;

    dadosAgrupados.forEach(row => {
        html += `<tr>
            <td>${row.colaborador}</td>
            <td>${row.cargo}</td>
            <td>${formatarHora(row.h50)}</td>
            <td>${formatarHora(row.h80)}</td>
            <td>${formatarHora(row.h100)}</td>
            <td>${formatarHora(row.noturno)}</td>
            <td><strong>${formatarHora(row.total)}</strong></td>
        </tr>`;
        tot50 += row.h50;
        tot80 += row.h80;
        tot100 += row.h100;
        totNot += row.noturno;
        totGeral += row.total;
    });
    
    html += `<tr style="background: var(--accent);">
        <td colspan="2"><strong>TOTAL GERAL</strong></td>
        <td><strong>${formatarHora(tot50)}</strong></td>
        <td><strong>${formatarHora(tot80)}</strong></td>
        <td><strong>${formatarHora(tot100)}</strong></td>
        <td><strong>${formatarHora(totNot)}</strong></td>
        <td><strong>${formatarHora(totGeral)}</strong></td>
    </tr>`;
    
    html += '</tbody></table>';
    previewDiv.innerHTML = html;
}

// Gerar PDF (Agrupado / Somado)
async function gerarPDF() {
    const btn = document.getElementById("btnExportPDF");
    btn.classList.add("loading");
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        
        doc.setFontSize(24);
        doc.setTextColor(99, 102, 241);
        doc.text("HorasPro - Resumo Consolidado de Horas a Pagar", 20, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 20, 35);
        
        const dadosAgrupados = agruparDadosRelatorio(dadosRelatorio);
        
        const tableData = dadosAgrupados.map(row => [
            row.colaborador,
            row.cargo,
            formatarHora(row.h50),
            formatarHora(row.h80),
            formatarHora(row.h100),
            formatarHora(row.noturno),
            formatarHora(row.total)
        ]);
        
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;
        dadosAgrupados.forEach(row => {
            tot50 += row.h50; tot80 += row.h80; tot100 += row.h100;
            totNot += row.noturno; totGeral += row.total;
        });
        
        tableData.push(['TOTAL GERAL', '-', formatarHora(tot50), formatarHora(tot80), formatarHora(tot100), formatarHora(totNot), formatarHora(totGeral)]);
        
        doc.autoTable({
            startY: 45,
            head: [['Colaborador', 'Cargo', 'Devido 50%', 'Devido 80%', 'Devido 100%', 'Ad. Noturno', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' }
        });
        
        doc.save(`relatorio_resumo_horas_${new Date().toISOString().slice(0,19)}.pdf`);
        btn.classList.remove("loading");
    } catch (error) {
        alert("Erro ao gerar PDF.");
        btn.classList.remove("loading");
    }
}

// Gerar Excel com as DUAS Planilhas (Resumo e Detalhado)
async function gerarExcel() {
    const btn = document.getElementById("btnExportExcel");
    btn.classList.add("loading");
    
    try {
        const wb = XLSX.utils.book_new();
        
        // 1. DADOS AGRUPADOS (Planilha 1: Resumo)
        const dadosAgrupados = agruparDadosRelatorio(dadosRelatorio);
        const excelResumo = dadosAgrupados.map(row => ({
            'Colaborador': row.colaborador,
            'Cargo': row.cargo,
            'Devido 50%': formatarHora(row.h50),
            'Devido 80%': formatarHora(row.h80),
            'Devido 100%': formatarHora(row.h100),
            'Ad. Noturno': formatarHora(row.noturno),
            'Total (h)': formatarHora(row.total)
        }));
        
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;
        dadosAgrupados.forEach(row => {
            tot50 += row.h50; tot80 += row.h80;
            tot100 += row.h100; totNot += row.noturno; totGeral += row.total;
        });
        
        excelResumo.push({
            'Colaborador': 'TOTAL GERAL', 'Cargo': '-',
            'Devido 50%': formatarHora(tot50), 'Devido 80%': formatarHora(tot80),
            'Devido 100%': formatarHora(tot100), 'Ad. Noturno': formatarHora(totNot), 'Total (h)': formatarHora(totGeral)
        });
        
        const wsResumo = XLSX.utils.json_to_sheet(excelResumo);
        wsResumo['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Consolidado");
        
        // 2. DADOS DETALHADOS MÊS A MÊS (Planilha 2: Detalhado)
        const excelDetalhado = dadosRelatorio.map(row => ({
            'Colaborador': row.colaborador,
            'Cargo': row.cargo,
            'Mês': row.mes,
            'Devido 50%': formatarHora(row.h50),
            'Devido 80%': formatarHora(row.h80),
            'Devido 100%': formatarHora(row.h100),
            'Ad. Noturno': formatarHora(row.noturno),
            'Total (h)': formatarHora(row.total)
        }));
        
        excelDetalhado.push({
            'Colaborador': 'TOTAL GERAL', 'Cargo': '-', 'Mês': '-',
            'Devido 50%': formatarHora(tot50), 'Devido 80%': formatarHora(tot80),
            'Devido 100%': formatarHora(tot100), 'Ad. Noturno': formatarHora(totNot), 'Total (h)': formatarHora(totGeral)
        });

        const wsDetalhado = XLSX.utils.json_to_sheet(excelDetalhado);
        wsDetalhado['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsDetalhado, "Detalhado Mes a Mes");
        
        // Salva o arquivo Excel
        XLSX.writeFile(wb, `relatorio_horas_completo_${new Date().toISOString().slice(0,19)}.xlsx`);
        btn.classList.remove("loading");
    } catch (error) {
        console.error(error);
        alert("Erro ao gerar Excel.");
        btn.classList.remove("loading");
    }
}

// Gerar CSV (Exporta apenas o Resumo)
async function gerarCSV() {
    const btn = document.getElementById("btnExportCSV");
    btn.classList.add("loading");
    
    try {
        const dadosAgrupados = agruparDadosRelatorio(dadosRelatorio);
        const headers = ['Colaborador', 'Cargo', 'Devido 50%', 'Devido 80%', 'Devido 100%', 'Ad. Noturno', 'Total (h)'];
        const rows = dadosAgrupados.map(row => [
            row.colaborador, row.cargo, formatarHora(row.h50), formatarHora(row.h80), formatarHora(row.h100), formatarHora(row.noturno), formatarHora(row.total)
        ]);
        
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;
        dadosAgrupados.forEach(row => {
            tot50 += row.h50; tot80 += row.h80;
            tot100 += row.h100; totNot += row.noturno; totGeral += row.total;
        });
        
        rows.push(['TOTAL GERAL', '-', formatarHora(tot50), formatarHora(tot80), formatarHora(tot100), formatarHora(totNot), formatarHora(totGeral)]);
        
        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            const escapedRow = row.map(cell => {
                if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            });
            csvContent += escapedRow.join(',') + '\n';
        });
        
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `relatorio_resumo_${new Date().toISOString().slice(0,19)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        btn.classList.remove("loading");
    } catch (error) {
        alert("Erro ao gerar CSV.");
        btn.classList.remove("loading");
    }
}

// Atualizar select de colaboradores
function atualizarSelect() {
    const select = document.getElementById("colaboradorSelect");
    if(!select) return;
    select.innerHTML = '<option value="">Selecione um colaborador para carregar as horas</option>';
    colaboradores.forEach(colab => {
        select.innerHTML += `<option value="${colab.id}">${colab.nome} - ${colab.cargo}</option>`;
    });
}

// Atualizar lista de colaboradores
function atualizarLista() {
    const container = document.getElementById("listaNomes");
    if(!container) return;
    if (colaboradores.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum colaborador cadastrado</div>';
        return;
    }
    container.innerHTML = colaboradores.map(colab => `
        <div class="colab-badge">
            <i class="fas fa-user"></i> ${colab.nome} (${colab.cargo})
            <button onclick="excluirColaborador(${colab.id})" style="background: none; border: none; color: white; cursor: pointer; margin-left: 8px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join("");
}

// Carregar tabelas por mês (Aba Lançamento)
function carregarTabelas(todosLancamentos) {
    const meses = ['marco', 'abril', 'maio'];
    
    for (const mes of meses) {
        const tbody = document.getElementById(`tabela-${mes}`);
        if (!tbody) continue;
        tbody.innerHTML = '';
        
        for (const colab of colaboradores) {
            const lanc = todosLancamentos.find(l => l.colaborador_id === colab.id && l.mes === mes);
            
            const f50 = Math.max(0, (lanc?.h50 || 0) - (lanc?.pago50 || 0));
            const f80 = Math.max(0, (lanc?.h80 || 0) - (lanc?.pago80 || 0));
            const f100 = Math.max(0, (lanc?.h100 || 0) - (lanc?.pago100 || 0));
            const fNot = Math.max(0, (lanc?.adicional_noturno || 0) - (lanc?.pago_noturno || 0));
            const falta = f50 + f80 + f100 + fNot;
            
            tbody.innerHTML += `<tr>
                <td>${colab.nome}</td>
                <td>${colab.cargo}</td>
                <td>${formatarHora(f50)}</td>
                <td>${formatarHora(f80)}</td>
                <td>${formatarHora(f100)}</td>
                <td>${formatarHora(fNot)}</td>
                <td style="background: var(--warning); font-weight: bold;">${formatarHora(falta)}</td>
            </tr>`;
        }
    }
}

// Carregar o Dashboard
async function carregarResumo(todosLancamentos) {
    const resumo = await Database.getResumoGeral(colaboradores, todosLancamentos);
    const corpo = document.getElementById("resumo-corpo");
    if (!corpo) return;
    
    corpo.innerHTML = '';
    
    resumo.forEach(item => {
        corpo.innerHTML += `<tr>
            <td><i class="fas fa-user"></i> ${item.colaborador.nome}</td>
            <td>${formatarHora(item.totalGeral.h50)}</td>
            <td>${formatarHora(item.totalGeral.h80)}</td>
            <td>${formatarHora(item.totalGeral.h100)}</td>
            <td>${formatarHora(item.totalGeral.noturno)}</td>
            <td style="background: var(--success); font-weight: bold;">${formatarHora(item.totalGeral.total)}</td>
            <td><button onclick="excluirColaborador(${item.colaborador.id})" class="btn-primary" style="background: var(--danger); padding: 5px 10px;"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
}

// Atualizar stats superiores
async function atualizarStats(todosLancamentos) {
    const resumo = await Database.getResumoGeral(colaboradores, todosLancamentos);
    const totalHoras = resumo.reduce((acc, item) => acc + item.totalGeral.total, 0);
    
    const divColab = document.getElementById("totalColaboradores");
    const divHoras = document.getElementById("totalHorasDevidas");
    
    if(divColab) divColab.innerText = colaboradores.length;
    if(divHoras) divHoras.innerText = formatarHora(totalHoras);
}

// Excluir colaborador
window.excluirColaborador = async function(id) {
    if (confirm("Tem certeza que deseja excluir este colaborador?")) {
        const success = await Database.deleteColaborador(id);
        if (success) {
            await carregarDadosIniciais();
            alert("✅ Colaborador excluído com sucesso!");
        } else {
            alert("❌ Erro ao excluir colaborador");
        }
    }
};

// =========================================================================
// MÁSCARA E FORMULÁRIO (AGORA PERMITE ATÉ 999:59)
// =========================================================================
function aplicarMascaraHora(evento) {
    let input = evento.target;
    if (evento.inputType === 'deleteContentBackward') return;
    
    let v = input.value.replace(/\D/g, "");
    if (v.length > 5) v = v.substring(0, 5);
    
    if (v.length >= 3) {
        let horas = v.substring(0, v.length - 2);
        let minutos = v.substring(v.length - 2);
        input.value = horas + ":" + minutos;
    } else {
        input.value = v;
    }
}

function initMascaras() {
    const meses = ['marco', 'abril', 'maio'];
    const camposHora = ["h50", "h80", "h100", "noturno", "pago50", "pago80", "pago100", "pagoNoturno"];
    
    meses.forEach(mes => {
        camposHora.forEach(campo => {
            const el = document.getElementById(`${campo}_${mes}`);
            if (el) el.addEventListener("input", aplicarMascaraHora);
        });
    });
}

// Apaga os dados dos inputs da tela
function limparFormulario() {
    const meses = ['marco', 'abril', 'maio'];
    const campos = ["h50", "h80", "h100", "noturno", "pago50", "pago80", "pago100", "pagoNoturno"];
    
    meses.forEach(mes => {
        campos.forEach(campo => {
            setValSeguro(`${campo}_${mes}`, "");
        });
    });
}

// Preenche os inputs com o que já tem salvo no banco
window.preencherFormulario = function(colaboradorId) {
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
        }
    });
};

function converterTempoParaDecimal(tempoString) {
    if (!tempoString) return 0;
    if (tempoString.includes(':')) {
        const partes = tempoString.split(':');
        const horas = parseInt(partes[0], 10) || 0;
        const minutos = parseInt(partes[1], 10) || 0;
        return horas + (minutos / 60);
    }
    return parseFloat(tempoString.replace(',', '.')) || 0;
}

// Lançar horas
async function lancarHoras() {
    const colaboradorId = document.getElementById("colaboradorSelect").value;
    if (!colaboradorId) {
        alert("Selecione um colaborador primeiro!");
        return;
    }
    
    const btnLancar = document.getElementById("btnLancar");
    const textoOriginal = btnLancar.innerHTML;
    btnLancar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando os 3 meses...';
    btnLancar.disabled = true;

    const meses = ['marco', 'abril', 'maio'];
    let sucesso = true;
    let salvouAlgum = false;

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

            const somaTotal = h50 + h80 + h100 + noturno + pago50 + pago80 + pago100 + pagoNoturno;
            
            const lancExistente = lancamentosGlobais.find(l => l.colaborador_id == colaboradorId && l.mes === mes);
            
            if (somaTotal === 0 && !lancExistente) {
                continue; 
            }

            const lancamento = {
                colaborador_id: parseInt(colaboradorId),
                mes: mes,
                h50: h50,
                h80: h80,
                h100: h100,
                adicional_noturno: noturno,
                pago50: pago50,
                pago80: pago80,
                pago100: pago100,
                pago_noturno: pagoNoturno
            };
            
            if (lancExistente && lancExistente.id) {
                lancamento.id = lancExistente.id;
            }
            
            const result = await Database.upsertLancamento(lancamento);
            if (!result) sucesso = false;
            
            salvouAlgum = true;
        }
    } catch (error) {
        console.error("Erro interno ao processar meses:", error);
        sucesso = false;
    }
    
    btnLancar.innerHTML = textoOriginal;
    btnLancar.disabled = false;

    if (!salvouAlgum) {
        alert("⚠️ Nenhum valor foi preenchido para salvar.");
        return;
    }

    if (sucesso) {
        await carregarDadosIniciais(); 
        
        // AQUI ESTÁ A MÁGICA DE APAGAR AS HORAS DA TELA APÓS SALVAR
        limparFormulario(); // Limpa as caixinhas de input
        const colabSelect = document.getElementById("colaboradorSelect");
        if(colabSelect) colabSelect.value = ""; // Reseta a caixa "Selecione um colaborador"
        
        alert("✅ Lançamentos salvos com sucesso em todos os meses!");
    } else {
        alert("❌ Ocorreu um erro ao salvar algumas horas. Tente novamente.");
    }
}

// Cadastrar colaborador
async function cadastrarColaborador() {
    const nome = document.getElementById("nome").value.trim();
    const cargo = document.getElementById("cargo").value.trim();
    
    if (!nome || !cargo) {
        alert("Preencha todos os campos!");
        return;
    }
    
    const result = await Database.addColaborador(nome, cargo);
    if (result) {
        await carregarDadosIniciais();
        document.getElementById("nome").value = "";
        document.getElementById("cargo").value = "";
        alert("✅ Colaborador cadastrado com sucesso!");
    } else {
        alert("❌ Erro ao cadastrar colaborador");
    }
}

// Navegação instantânea entre abas
function initTabs() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabs = document.querySelectorAll(".tab-content");
    
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");
            tabs.forEach(tab => tab.classList.remove("active-tab"));
            document.getElementById(tabId).classList.add("active-tab");
            
            const titles = { 
                dashboard: "Dashboard", 
                cadastro: "Colaboradores", 
                lancamento: "Lançar Horas", 
                relatorios: "Relatórios" 
            };
            document.getElementById("pageTitle").innerText = titles[tabId];
            document.getElementById("pageSubtitle").innerText = `Gerenciando ${titles[tabId].toLowerCase()}`;
        });
    });
}

// Inicializar meses apenas para a visualização da Tabela
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

// Verificar conexão com banco
async function verificarConexao() {
    const dbStatus = document.getElementById("dbStatus");
    const supabase = await initSupabase();
    if(!dbStatus) return;
    
    if (supabase) {
        dbStatus.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> Banco Conectado';
        dbStatus.style.color = "#10b981";
    } else {
        dbStatus.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i> Falha na Conexão';
        dbStatus.style.color = "#ef4444";
    }
}

// Eventos dos filtros
function initFiltros() {
    const filtros = ["filtroColaborador", "filtroPeriodo"];
    filtros.forEach(filtro => {
        const elemento = document.getElementById(filtro);
        if (elemento) {
            elemento.addEventListener("change", () => {
                atualizarPrevia(lancamentosGlobais);
            });
        }
    });
}

// Inicializar aplicação
async function init() {
    initTabs();
    initMeses();
    initFiltros();
    initMascaras();
    
    await carregarDadosIniciais();
    await verificarConexao();
    
    const btnLancar = document.getElementById("btnLancar");
    if (btnLancar) btnLancar.addEventListener("click", lancarHoras);

    const btnCadastrar = document.getElementById("btnCadastrar");
    if (btnCadastrar) btnCadastrar.addEventListener("click", cadastrarColaborador);

    const btnPDF = document.getElementById("btnExportPDF");
    if (btnPDF) btnPDF.addEventListener("click", gerarPDF);
    
    const btnExcel = document.getElementById("btnExportExcel");
    if(btnExcel) btnExcel.addEventListener("click", gerarExcel);
    
    const btnCSV = document.getElementById("btnExportCSV");
    if(btnCSV) btnCSV.addEventListener("click", gerarCSV);

    const colabSelect = document.getElementById("colaboradorSelect");
    if(colabSelect) {
        colabSelect.addEventListener("change", (e) => {
            preencherFormulario(e.target.value);
        });
    }
}

init();