let colaboradores = [];
let dadosRelatorio = [];

// Carregar dados iniciais
async function carregarDadosIniciais() {
    await initSupabase();
    await carregarColaboradores();
    await carregarTabelas();
    await carregarResumo();
    await gerarRelatorio();
    await carregarFiltros();
    await atualizarPrevia();
    atualizarStats();
}

// Carregar filtros
async function carregarFiltros() {
    const filtroColab = document.getElementById("filtroColaborador");
    filtroColab.innerHTML = '<option value="todos">Todos os colaboradores</option>';
    colaboradores.forEach(colab => {
        filtroColab.innerHTML += `<option value="${colab.id}">${colab.nome}</option>`;
    });
}

// Obter dados do relatório com filtros
async function obterDadosRelatorio() {
    const colaboradorId = document.getElementById("filtroColaborador").value;
    const periodo = document.getElementById("filtroPeriodo").value;
    const tipoHora = document.getElementById("filtroTipo").value;
    
    const resumo = await Database.getResumoGeral();
    let dados = [];
    
    for (const item of resumo) {
        if (colaboradorId !== "todos" && item.colaborador.id != colaboradorId) continue;
        
        const meses = periodo === "todos" ? ["marco", "abril", "maio"] : [periodo];
        
        for (const mes of meses) {
            const lancamentos = await Database.getLancamentos(item.colaborador.id, mes);
            const lanc = lancamentos[0];
            
            if (!lanc && periodo !== "todos") continue;
            
            let horasExtras = 0;
            let tipoLabel = "";
            
            if (tipoHora === "50") {
                horasExtras = (lanc?.h50 || 0) - (lanc?.pago50 || 0);
                tipoLabel = "Horas 50%";
            } else if (tipoHora === "80") {
                horasExtras = (lanc?.h80 || 0) - (lanc?.pago80 || 0);
                tipoLabel = "Horas 80%";
            } else if (tipoHora === "100") {
                horasExtras = (lanc?.h100 || 0) - (lanc?.pago100 || 0);
                tipoLabel = "Horas 100%";
            } else if (tipoHora === "noturno") {
                horasExtras = (lanc?.adicional_noturno || 0) - (lanc?.pago_noturno || 0);
                tipoLabel = "Adicional Noturno";
            } else {
                const falta50 = Math.max(0, (lanc?.h50 || 0) - (lanc?.pago50 || 0));
                const falta80 = Math.max(0, (lanc?.h80 || 0) - (lanc?.pago80 || 0));
                const falta100 = Math.max(0, (lanc?.h100 || 0) - (lanc?.pago100 || 0));
                const faltaNoturno = Math.max(0, (lanc?.adicional_noturno || 0) - (lanc?.pago_noturno || 0));
                horasExtras = falta50 + falta80 + falta100 + faltaNoturno;
                tipoLabel = "Total Horas";
            }
            
            if (horasExtras > 0 || periodo !== "todos") {
                dados.push({
                    colaborador: item.colaborador.nome,
                    cargo: item.colaborador.cargo,
                    mes: mes.charAt(0).toUpperCase() + mes.slice(1),
                    horasExtras: horasExtras.toFixed(1),
                    tipo: tipoLabel,
                    dataGeracao: new Date().toLocaleString()
                });
            }
        }
    }
    
    return dados;
}

// Atualizar prévia do relatório
async function atualizarPrevia() {
    dadosRelatorio = await obterDadosRelatorio();
    const previewDiv = document.getElementById("previaTabela");
    const dataSpan = document.getElementById("previewData");
    
    dataSpan.innerHTML = `<i class="fas fa-calendar"></i> Gerado em: ${new Date().toLocaleString()}`;
    
    if (dadosRelatorio.length === 0) {
        previewDiv.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary);"><i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>Nenhum dado encontrado com os filtros selecionados.</div>';
        return;
    }
    
    let html = '<table><thead><tr>';
    html += '<th>Colaborador</th><th>Cargo</th><th>Mês</th><th>Horas Devidas</th><th>Tipo</th>';
    html += '</tr></thead><tbody>';
    
    dadosRelatorio.forEach(row => {
        html += `<tr>
            <td>${row.colaborador}</td>
            <td>${row.cargo}</td>
            <td>${row.mes}</td>
            <td><strong>${row.horasExtras}</strong></td>
            <td>${row.tipo}</td>
        </tr>`;
    });
    
    // Adicionar total
    const totalHoras = dadosRelatorio.reduce((sum, row) => sum + parseFloat(row.horasExtras), 0);
    html += `<tr style="background: var(--accent);">
        <td colspan="3"><strong>TOTAL GERAL</strong></td>
        <td><strong>${totalHoras.toFixed(1)} horas</strong></td>
        <td></td>
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
        
        // Título
        doc.setFontSize(24);
        doc.setTextColor(99, 102, 241);
        doc.text("HorasPro - Relatório de Horas Extras", 20, 20);
        
        // Subtítulo
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 20, 35);
        
        // Filtros aplicados
        const colaborador = document.getElementById("filtroColaborador").selectedOptions[0].text;
        const periodo = document.getElementById("filtroPeriodo").selectedOptions[0].text;
        const tipo = document.getElementById("filtroTipo").selectedOptions[0].text;
        
        doc.setFontSize(10);
        doc.text(`Filtros: Colaborador (${colaborador}) | Período (${periodo}) | Tipo (${tipo})`, 20, 45);
        
        // Preparar dados para tabela
        const tableData = dadosRelatorio.map(row => [
            row.colaborador,
            row.cargo,
            row.mes,
            `${row.horasExtras} h`,
            row.tipo
        ]);
        
        // Adicionar total
        const totalHoras = dadosRelatorio.reduce((sum, row) => sum + parseFloat(row.horasExtras), 0);
        tableData.push(['', '', 'TOTAL GERAL', `${totalHoras.toFixed(1)} h`, '']);
        
        // Gerar tabela
        doc.autoTable({
            startY: 55,
            head: [['Colaborador', 'Cargo', 'Mês', 'Horas Devidas', 'Tipo']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [99, 102, 241],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            bodyStyles: {
                textColor: [0, 0, 0],
                fontSize: 9
            },
            alternateRowStyles: {
                fillColor: [240, 240, 250]
            }
        });
        
        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
            doc.text("HorasPro - Sistema de Gestão de Horas", 20, doc.internal.pageSize.height - 10);
        }
        
        doc.save(`relatorio_horas_${new Date().toISOString().slice(0,19)}.pdf`);
        
        // Animação de sucesso
        btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        setTimeout(() => {
            btn.style.background = "linear-gradient(135deg, #dc2626, #ef4444)";
            btn.classList.remove("loading");
        }, 1000);
        
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar PDF. Verifique o console.");
        btn.classList.remove("loading");
    }
}

// Gerar Excel
async function gerarExcel() {
    const btn = document.getElementById("btnExportExcel");
    btn.classList.add("loading");
    
    try {
        // Preparar dados para Excel
        const excelData = dadosRelatorio.map(row => ({
            'Colaborador': row.colaborador,
            'Cargo': row.cargo,
            'Mês': row.mes,
            'Horas Devidas': parseFloat(row.horasExtras),
            'Tipo': row.tipo
        }));
        
        // Adicionar total
        const totalHoras = dadosRelatorio.reduce((sum, row) => sum + parseFloat(row.horasExtras), 0);
        excelData.push({
            'Colaborador': '',
            'Cargo': '',
            'Mês': 'TOTAL GERAL',
            'Horas Devidas': totalHoras,
            'Tipo': ''
        });
        
        // Criar worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Ajustar largura das colunas
        ws['!cols'] = [
            { wch: 25 }, // Colaborador
            { wch: 20 }, // Cargo
            { wch: 12 }, // Mês
            { wch: 15 }, // Horas Devidas
            { wch: 20 }  // Tipo
        ];
        
        // Adicionar informações de cabeçalho
        const wsName = "Relatorio Horas";
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, wsName);
        
        // Salvar arquivo
        XLSX.writeFile(wb, `relatorio_horas_${new Date().toISOString().slice(0,19)}.xlsx`);
        
        // Animação de sucesso
        btn.style.background = "linear-gradient(135deg, #34d399, #10b981)";
        setTimeout(() => {
            btn.style.background = "linear-gradient(135deg, #059669, #10b981)";
            btn.classList.remove("loading");
        }, 1000);
        
    } catch (error) {
        console.error("Erro ao gerar Excel:", error);
        alert("Erro ao gerar Excel. Verifique o console.");
        btn.classList.remove("loading");
    }
}

// Gerar CSV
async function gerarCSV() {
    const btn = document.getElementById("btnExportCSV");
    btn.classList.add("loading");
    
    try {
        // Preparar dados
        const headers = ['Colaborador', 'Cargo', 'Mês', 'Horas Devidas', 'Tipo'];
        const rows = dadosRelatorio.map(row => [
            row.colaborador,
            row.cargo,
            row.mes,
            row.horasExtras,
            row.tipo
        ]);
        
        // Adicionar total
        const totalHoras = dadosRelatorio.reduce((sum, row) => sum + parseFloat(row.horasExtras), 0);
        rows.push(['', '', 'TOTAL GERAL', totalHoras.toFixed(1), '']);
        rows.push(['', '', '', '', '']);
        rows.push(['Relatório gerado em:', new Date().toLocaleString(), '', '', '']);
        
        // Criar conteúdo CSV
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
        
        // Download
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `relatorio_horas_${new Date().toISOString().slice(0,19)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Animação de sucesso
        btn.style.background = "linear-gradient(135deg, #a78bfa, #8b5cf6)";
        setTimeout(() => {
            btn.style.background = "linear-gradient(135deg, #7c3aed, #8b5cf6)";
            btn.classList.remove("loading");
        }, 1000);
        
    } catch (error) {
        console.error("Erro ao gerar CSV:", error);
        alert("Erro ao gerar CSV. Verifique o console.");
        btn.classList.remove("loading");
    }
}

// Carregar colaboradores
async function carregarColaboradores() {
    colaboradores = await Database.getColaboradores();
    atualizarSelect();
    atualizarLista();
}

// Atualizar select de colaboradores
function atualizarSelect() {
    const select = document.getElementById("colaboradorSelect");
    select.innerHTML = '<option value="">Selecione um colaborador</option>';
    colaboradores.forEach(colab => {
        select.innerHTML += `<option value="${colab.id}">${colab.nome} - ${colab.cargo}</option>`;
    });
}

// Atualizar lista de colaboradores
function atualizarLista() {
    const container = document.getElementById("listaNomes");
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

// Calcular faltas
function calcularFaltas(lancamento) {
    if (!lancamento) return 0;
    const falta50 = Math.max(0, (lancamento.h50 || 0) - (lancamento.pago50 || 0));
    const falta80 = Math.max(0, (lancamento.h80 || 0) - (lancamento.pago80 || 0));
    const falta100 = Math.max(0, (lancamento.h100 || 0) - (lancamento.pago100 || 0));
    const faltaNoturno = Math.max(0, (lancamento.adicional_noturno || 0) - (lancamento.pago_noturno || 0));
    return falta50 + falta80 + falta100 + faltaNoturno;
}

// Carregar tabelas por mês
async function carregarTabelas() {
    const meses = ['marco', 'abril', 'maio'];
    
    for (const mes of meses) {
        const tbody = document.getElementById(`tabela-${mes}`);
        if (!tbody) continue;
        tbody.innerHTML = '';
        
        const lancamentos = await Database.getLancamentos(null, mes);
        
        for (const colab of colaboradores) {
            const lanc = lancamentos.find(l => l.colaborador_id === colab.id);
            const falta = calcularFaltas(lanc);
            
            tbody.innerHTML += `<tr>
                <td>${colab.nome}</td>
                <td>${colab.cargo}</td>
                <td>${lanc?.h50 || 0}</td>
                <td>${lanc?.h80 || 0}</td>
                <td>${lanc?.h100 || 0}</td>
                <td>${lanc?.adicional_noturno || 0}</td>
                <td style="background: var(--warning); font-weight: bold;">${falta.toFixed(1)}</td>
            </tr>`;
        }
    }
}

// Carregar resumo
async function carregarResumo() {
    const resumo = await Database.getResumoGeral();
    const corpo = document.getElementById("resumo-corpo");
    corpo.innerHTML = '';
    
    resumo.forEach(item => {
        corpo.innerHTML += `<tr>
            <td><i class="fas fa-user"></i> ${item.colaborador.nome}</td>
            <td>${item.marco.toFixed(1)}</td>
            <td>${item.abril.toFixed(1)}</td>
            <td>${item.maio.toFixed(1)}</td>
            <td style="background: var(--success); font-weight: bold;">${item.total.toFixed(1)}</td>
            <td><button onclick="excluirColaborador(${item.colaborador.id})" class="btn-primary" style="background: var(--danger); padding: 5px 10px;"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
}

// Atualizar stats
async function atualizarStats() {
    const resumo = await Database.getResumoGeral();
    const totalHoras = resumo.reduce((acc, item) => acc + item.total, 0);
    document.getElementById("totalColaboradores").innerText = colaboradores.length;
    document.getElementById("totalHorasDevidas").innerText = totalHoras.toFixed(1);
}

// Gerar relatório
async function gerarRelatorio() {
    const resumo = await Database.getResumoGeral();
    let relatorio = "═══════════════════════════════════════════════════\n";
    relatorio += "         RELATÓRIO GERAL DE HORAS A PAGAR          \n";
    relatorio += "═══════════════════════════════════════════════════\n\n";
    let totalEmpresa = 0;
    
    resumo.forEach(item => {
        relatorio += `📌 ${item.colaborador.nome} - ${item.colaborador.cargo}\n`;
        relatorio += "───────────────────────────────────────────────\n";
        relatorio += `MARÇO: ${item.marco.toFixed(1)} horas\n`;
        relatorio += `ABRIL: ${item.abril.toFixed(1)} horas\n`;
        relatorio += `MAIO: ${item.maio.toFixed(1)} horas\n`;
        relatorio += `👉 TOTAL: ${item.total.toFixed(1)} horas\n\n`;
        totalEmpresa += item.total;
    });
    
    relatorio += "═══════════════════════════════════════════════════\n";
    relatorio += `🏢 TOTAL GERAL DA EMPRESA: ${totalEmpresa.toFixed(1)} horas\n`;
    relatorio += `📅 Gerado em: ${new Date().toLocaleString()}\n`;
    relatorio += "═══════════════════════════════════════════════════\n";
    
    document.getElementById("relatorioConteudo").innerHTML = `<pre>${relatorio}</pre>`;
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
        h50: parseFloat(document.getElementById("h50").value) || 0,
        h80: parseFloat(document.getElementById("h80").value) || 0,
        h100: parseFloat(document.getElementById("h100").value) || 0,
        adicional_noturno: parseFloat(document.getElementById("adicionalNoturno").value) || 0,
        pago50: parseFloat(document.getElementById("pago50").value) || 0,
        pago80: parseFloat(document.getElementById("pago80").value) || 0,
        pago100: parseFloat(document.getElementById("pago100").value) || 0,
        pago_noturno: parseFloat(document.getElementById("pagoNoturno").value) || 0
    };
    
    const result = await Database.upsertLancamento(lancamento);
    if (result) {
        await carregarDadosIniciais();
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
        document.getElementById(id).value = "";
    });
}

// Navegação entre abas
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
    const filtros = ["filtroColaborador", "filtroPeriodo", "filtroTipo"];
    filtros.forEach(filtro => {
        document.getElementById(filtro).addEventListener("change", () => {
            atualizarPrevia();
        });
    });
}

// Inicializar aplicação
async function init() {
    initTabs();
    initMeses();
    initFiltros();
    await carregarDadosIniciais();
    await verificarConexao();
    
    // Eventos dos botões de exportação
    document.getElementById("btnExportPDF").addEventListener("click", gerarPDF);
    document.getElementById("btnExportExcel").addEventListener("click", gerarExcel);
    document.getElementById("btnExportCSV").addEventListener("click", gerarCSV);
}

init();