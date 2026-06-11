let colaboradores = [];
let dadosRelatorio = [];
let lancamentosGlobais = []; // Memória central para acabar com a lentidão de telas

// Carregar dados iniciais (Apenas 1 carregamento mega rápido)
async function carregarDadosIniciais() {
    await initSupabase();
    
    // CARREGA TUDO DE UMA VEZ
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

// Obter dados do relatório com filtros usando a memória global
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
                    h50: h50.toFixed(1),
                    h80: h80.toFixed(1),
                    h100: h100.toFixed(1),
                    noturno: noturno.toFixed(1),
                    total: total.toFixed(1)
                });
            }
        }
    }
    
    return dados;
}

// Atualizar prévia do relatório
async function atualizarPrevia(todosLancamentos = null) {
    dadosRelatorio = await obterDadosRelatorio(todosLancamentos);
    const previewDiv = document.getElementById("previaTabela");
    const dataSpan = document.getElementById("previewData");
    
    if(!previewDiv) return;
    
    dataSpan.innerHTML = `<i class="fas fa-calendar"></i> Gerado em: ${new Date().toLocaleString()}`;
    
    if (dadosRelatorio.length === 0) {
        previewDiv.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary);"><i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>Nenhum dado encontrado com os filtros selecionados.</div>';
        return;
    }
    
    let html = '<table><thead><tr>';
    html += '<th>Colaborador</th><th>Mês</th><th>Devido 50%</th><th>Devido 80%</th><th>Devido 100%</th><th>Ad. Noturno</th><th>Total (h)</th>';
    html += '</tr></thead><tbody>';
    
    let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;

    dadosRelatorio.forEach(row => {
        html += `<tr>
            <td>${row.colaborador}</td>
            <td>${row.mes}</td>
            <td>${row.h50}</td>
            <td>${row.h80}</td>
            <td>${row.h100}</td>
            <td>${row.noturno}</td>
            <td><strong>${row.total}</strong></td>
        </tr>`;
        tot50 += parseFloat(row.h50);
        tot80 += parseFloat(row.h80);
        tot100 += parseFloat(row.h100);
        totNot += parseFloat(row.noturno);
        totGeral += parseFloat(row.total);
    });
    
    html += `<tr style="background: var(--accent);">
        <td colspan="2"><strong>TOTAL GERAL</strong></td>
        <td><strong>${tot50.toFixed(1)}h</strong></td>
        <td><strong>${tot80.toFixed(1)}h</strong></td>
        <td><strong>${tot100.toFixed(1)}h</strong></td>
        <td><strong>${totNot.toFixed(1)}h</strong></td>
        <td><strong>${totGeral.toFixed(1)}h</strong></td>
    </tr>`;
    
    html += '</tbody></table>';
    previewDiv.innerHTML = html;
}

// Gerar PDF
async function gerarPDF() {
    const btn = document.getElementById("btnExportPDF");
    btn.classList.add("loading");
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        
        doc.setFontSize(24);
        doc.setTextColor(99, 102, 241);
        doc.text("HorasPro - Relatório Detalhado de Horas a Pagar", 20, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 20, 35);
        
        const colaborador = document.getElementById("filtroColaborador").selectedOptions[0].text;
        const periodo = document.getElementById("filtroPeriodo").selectedOptions[0].text;
        
        doc.setFontSize(10);
        doc.text(`Filtros: Colaborador (${colaborador}) | Período (${periodo})`, 20, 45);
        
        const tableData = dadosRelatorio.map(row => [
            row.colaborador,
            row.mes,
            `${row.h50} h`,
            `${row.h80} h`,
            `${row.h100} h`,
            `${row.noturno} h`,
            `${row.total} h`
        ]);
        
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;
        dadosRelatorio.forEach(row => {
            tot50 += parseFloat(row.h50);
            tot80 += parseFloat(row.h80);
            tot100 += parseFloat(row.h100);
            totNot += parseFloat(row.noturno);
            totGeral += parseFloat(row.total);
        });
        
        tableData.push(['TOTAL GERAL', '-', `${tot50.toFixed(1)} h`, `${tot80.toFixed(1)} h`, `${tot100.toFixed(1)} h`, `${totNot.toFixed(1)} h`, `${totGeral.toFixed(1)} h`]);
        
        doc.autoTable({
            startY: 55,
            head: [['Colaborador', 'Mês', 'Devido 50%', 'Devido 80%', 'Devido 100%', 'Ad. Noturno', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [240, 240, 250] }
        });
        
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
        }
        
        doc.save(`relatorio_horas_${new Date().toISOString().slice(0,19)}.pdf`);
        
        btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        setTimeout(() => {
            btn.style.background = "linear-gradient(135deg, #dc2626, #ef4444)";
            btn.classList.remove("loading");
        }, 1000);
        
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar PDF.");
        btn.classList.remove("loading");
    }
}

// Gerar Excel
async function gerarExcel() {
    const btn = document.getElementById("btnExportExcel");
    btn.classList.add("loading");
    
    try {
        const excelData = dadosRelatorio.map(row => ({
            'Colaborador': row.colaborador,
            'Mês': row.mes,
            'Devido 50%': parseFloat(row.h50),
            'Devido 80%': parseFloat(row.h80),
            'Devido 100%': parseFloat(row.h100),
            'Ad. Noturno': parseFloat(row.noturno),
            'Total (h)': parseFloat(row.total)
        }));
        
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;
        dadosRelatorio.forEach(row => {
            tot50 += parseFloat(row.h50); tot80 += parseFloat(row.h80);
            tot100 += parseFloat(row.h100); totNot += parseFloat(row.noturno); totGeral += parseFloat(row.total);
        });
        
        excelData.push({
            'Colaborador': 'TOTAL GERAL', 'Mês': '-',
            'Devido 50%': tot50, 'Devido 80%': tot80,
            'Devido 100%': tot100, 'Ad. Noturno': totNot, 'Total (h)': totGeral
        });
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio Horas");
        
        XLSX.writeFile(wb, `relatorio_horas_${new Date().toISOString().slice(0,19)}.xlsx`);
        
        btn.style.background = "linear-gradient(135deg, #34d399, #10b981)";
        setTimeout(() => {
            btn.style.background = "linear-gradient(135deg, #059669, #10b981)";
            btn.classList.remove("loading");
        }, 1000);
        
    } catch (error) {
        console.error("Erro ao gerar Excel:", error);
        alert("Erro ao gerar Excel.");
        btn.classList.remove("loading");
    }
}

// Gerar CSV
async function gerarCSV() {
    const btn = document.getElementById("btnExportCSV");
    btn.classList.add("loading");
    
    try {
        const headers = ['Colaborador', 'Mês', 'Devido 50%', 'Devido 80%', 'Devido 100%', 'Ad. Noturno', 'Total (h)'];
        const rows = dadosRelatorio.map(row => [
            row.colaborador, row.mes, row.h50, row.h80, row.h100, row.noturno, row.total
        ]);
        
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;
        dadosRelatorio.forEach(row => {
            tot50 += parseFloat(row.h50); tot80 += parseFloat(row.h80);
            tot100 += parseFloat(row.h100); totNot += parseFloat(row.noturno); totGeral += parseFloat(row.total);
        });
        
        rows.push(['TOTAL GERAL', '-', tot50.toFixed(1), tot80.toFixed(1), tot100.toFixed(1), totNot.toFixed(1), totGeral.toFixed(1)]);
        
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
        link.setAttribute('download', `relatorio_horas_${new Date().toISOString().slice(0,19)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        btn.style.background = "linear-gradient(135deg, #a78bfa, #8b5cf6)";
        setTimeout(() => {
            btn.style.background = "linear-gradient(135deg, #7c3aed, #8b5cf6)";
            btn.classList.remove("loading");
        }, 1000);
        
    } catch (error) {
        console.error("Erro ao gerar CSV:", error);
        alert("Erro ao gerar CSV.");
        btn.classList.remove("loading");
    }
}

// Atualizar select de colaboradores
function atualizarSelect() {
    const select = document.getElementById("colaboradorSelect");
    if(!select) return;
    select.innerHTML = '<option value="">Selecione um colaborador</option>';
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

// Carregar tabelas por mês de forma Instantânea
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
                <td>${f50.toFixed(1)}</td>
                <td>${f80.toFixed(1)}</td>
                <td>${f100.toFixed(1)}</td>
                <td>${fNot.toFixed(1)}</td>
                <td style="background: var(--warning); font-weight: bold;">${falta.toFixed(1)}</td>
            </tr>`;
        }
    }
}

// Carregar o Dashboard instantaneamente
async function carregarResumo(todosLancamentos) {
    const resumo = await Database.getResumoGeral(colaboradores, todosLancamentos);
    const corpo = document.getElementById("resumo-corpo");
    if (!corpo) return;
    
    corpo.innerHTML = '';
    
    resumo.forEach(item => {
        corpo.innerHTML += `<tr>
            <td><i class="fas fa-user"></i> ${item.colaborador.nome}</td>
            <td>${item.totalGeral.h50.toFixed(1)}</td>
            <td>${item.totalGeral.h80.toFixed(1)}</td>
            <td>${item.totalGeral.h100.toFixed(1)}</td>
            <td>${item.totalGeral.noturno.toFixed(1)}</td>
            <td style="background: var(--success); font-weight: bold;">${item.totalGeral.total.toFixed(1)}</td>
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
    if(divHoras) divHoras.innerText = totalHoras.toFixed(1);
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
// MÁSCARA INTELIGENTE PARA HORAS (Como você pediu antes)
// =========================================================================
function aplicarMascaraHora(evento) {
    let input = evento.target;
    if (evento.inputType === 'deleteContentBackward') return;
    let v = input.value.replace(/\D/g, "");
    if (v.length > 4) v = v.substring(0, 4);
    
    if (v.length === 3) input.value = v.substring(0, 1) + ":" + v.substring(1);
    else if (v.length === 4) input.value = v.substring(0, 2) + ":" + v.substring(2);
    else input.value = v;
}

function initMascaras() {
    const camposHora = ["h50", "h80", "h100", "adicionalNoturno", "pago50", "pago80", "pago100", "pagoNoturno"];
    camposHora.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", aplicarMascaraHora);
    });
}

// Função para converter formato HH:MM
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
        alert("Selecione um colaborador!");
        return;
    }
    
    const mesAtivo = document.querySelector(".mes-btn.active").getAttribute("data-mes");
    
    const lancamento = {
        colaborador_id: parseInt(colaboradorId),
        mes: mesAtivo,
        h50: converterTempoParaDecimal(document.getElementById("h50").value),
        h80: converterTempoParaDecimal(document.getElementById("h80").value),
        h100: converterTempoParaDecimal(document.getElementById("h100").value),
        adicional_noturno: converterTempoParaDecimal(document.getElementById("adicionalNoturno").value),
        pago50: converterTempoParaDecimal(document.getElementById("pago50").value),
        pago80: converterTempoParaDecimal(document.getElementById("pago80").value),
        pago100: converterTempoParaDecimal(document.getElementById("pago100").value),
        pago_noturno: converterTempoParaDecimal(document.getElementById("pagoNoturno").value)
    };
    
    const result = await Database.upsertLancamento(lancamento);
    if (result) {
        await carregarDadosIniciais(); // Atualiza tudo automaticamente
        alert("✅ Horas lançadas com sucesso!");
        limparFormulario();
    } else {
        alert("❌ Erro ao lançar horas");
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

function limparFormulario() {
    ["h50", "h80", "h100", "adicionalNoturno", "pago50", "pago80", "pago100", "pagoNoturno"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
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

// Inicializar meses
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

// Eventos dos filtros com atualização instantânea na memória local
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
}

init();