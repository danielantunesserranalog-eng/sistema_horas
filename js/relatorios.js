let colaboradoresGlobais = [];
let lancamentosGlobais = [];
let dadosRelatorio = [];

async function initRelatorios() {
    await initSupabase();
    await verificarConexao();
    await atualizarStatsGlobais();
    
    colaboradoresGlobais = await Database.getColaboradores();
    lancamentosGlobais = await Database.getLancamentos();
    
    carregarFiltros();
    initFiltros();
    await atualizarPrevia(lancamentosGlobais);
    
    document.getElementById("btnExportPDF").addEventListener("click", gerarPDF);
    document.getElementById("btnExportExcel").addEventListener("click", gerarExcel);
    document.getElementById("btnExportCSV").addEventListener("click", gerarCSV);
}

function carregarFiltros() {
    const filtroColab = document.getElementById("filtroColaborador");
    if (!filtroColab) return;
    filtroColab.innerHTML = '<option value="todos">Todos os colaboradores</option>';
    colaboradoresGlobais.forEach(colab => {
        filtroColab.innerHTML += `<option value="${colab.id}">${colab.nome}</option>`;
    });
}

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

async function obterDadosRelatorio(todosLancamentos) {
    const colaboradorId = document.getElementById("filtroColaborador").value;
    const periodo = document.getElementById("filtroPeriodo").value;
    const resumo = await Database.getResumoGeral(colaboradoresGlobais, todosLancamentos);
    let dados = [];
    
    for (const item of resumo) {
        if (colaboradorId !== "todos" && item.colaborador.id != colaboradorId) continue;
        const meses = periodo === "todos" ? ["marco", "abril", "maio"] : [periodo];
        for (const mes of meses) {
            const lanc = todosLancamentos.find(l => l.colaborador_id === item.colaborador.id && l.mes === mes);
            if (!lanc && periodo !== "todos") continue;
            
            // Cálculo do SALDO LÍQUIDO (Devido - Pago)
            const h50 = (lanc?.h50 || 0) - (lanc?.pago50 || 0);
            const h80 = (lanc?.h80 || 0) - (lanc?.pago80 || 0);
            const h100 = (lanc?.h100 || 0) - (lanc?.pago100 || 0);
            const noturno = (lanc?.adicional_noturno || 0) - (lanc?.pago_noturno || 0);
            const atrasos = lanc?.atrasos || 0; // Atrasos são apenas reembolsados (positivos)
            
            const total = h50 + h80 + h100 + noturno + atrasos;
            
            if (total !== 0 || h50 !== 0 || h80 !== 0 || h100 !== 0 || noturno !== 0 || atrasos !== 0 || periodo !== "todos") {
                dados.push({
                    colaborador: item.colaborador.nome, cargo: item.colaborador.cargo,
                    mes: mes.charAt(0).toUpperCase() + mes.slice(1), 
                    h50: h50, h80: h80, h100: h100, noturno: noturno, atrasos: atrasos, total: total
                });
            }
        }
    }
    return dados;
}

function agruparDadosRelatorio(dados) {
    const resumoMap = {};
    dados.forEach(row => {
        const chave = row.colaborador + "|" + row.cargo;
        if (!resumoMap[chave]) {
            resumoMap[chave] = { colaborador: row.colaborador, cargo: row.cargo, h50: 0, h80: 0, h100: 0, noturno: 0, atrasos: 0, total: 0 };
        }
        resumoMap[chave].h50 += row.h50; 
        resumoMap[chave].h80 += row.h80; 
        resumoMap[chave].h100 += row.h100;
        resumoMap[chave].noturno += row.noturno; 
        resumoMap[chave].atrasos += row.atrasos; 
        resumoMap[chave].total += row.total;
    });
    return Object.values(resumoMap);
}

// Funções para formatar com sinais e cores
function formatarSaldoHtml(val) {
    if (val === 0) return `<span style="color: var(--text-secondary);">00:00</span>`;
    if (val > 0) return `<span style="color: #10b981; font-weight: bold;">+${formatarHora(val)}</span>`;
    return `<span style="color: #ef4444; font-weight: bold;">-${formatarHora(Math.abs(val))}</span>`;
}

function formatarSaldoTexto(val) {
    if (val === 0) return "00:00";
    if (val > 0) return "+" + formatarHora(val);
    return "-" + formatarHora(Math.abs(val));
}

async function atualizarPrevia(todosLancamentos) {
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
    
    let html = '<table><thead><tr><th>Colaborador</th><th>Cargo</th><th>Saldo 50%</th><th>Saldo 80%</th><th>Saldo 100%</th><th>Saldo Noturno</th><th>Atrasos Indev.</th><th>Saldo Total</th></tr></thead><tbody>';
    let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totAtraso = 0, totGeral = 0;

    dadosAgrupados.forEach(row => {
        html += `<tr>
            <td>${row.colaborador}</td>
            <td>${row.cargo}</td>
            <td>${formatarSaldoHtml(row.h50)}</td>
            <td>${formatarSaldoHtml(row.h80)}</td>
            <td>${formatarSaldoHtml(row.h100)}</td>
            <td>${formatarSaldoHtml(row.noturno)}</td>
            <td>${formatarSaldoHtml(row.atrasos)}</td>
            <td style="background: rgba(99, 102, 241, 0.1);">${formatarSaldoHtml(row.total)}</td>
        </tr>`;
        tot50 += row.h50; tot80 += row.h80; tot100 += row.h100; totNot += row.noturno; totAtraso += row.atrasos; totGeral += row.total;
    });
    
    html += `<tr style="background: var(--accent); color: white;">
        <td colspan="2"><strong>TOTAL GERAL</strong></td>
        <td><strong>${formatarSaldoTexto(tot50)}</strong></td>
        <td><strong>${formatarSaldoTexto(tot80)}</strong></td>
        <td><strong>${formatarSaldoTexto(tot100)}</strong></td>
        <td><strong>${formatarSaldoTexto(totNot)}</strong></td>
        <td><strong>${formatarSaldoTexto(totAtraso)}</strong></td>
        <td><strong>${formatarSaldoTexto(totGeral)}</strong></td>
    </tr></tbody></table>`;
    previewDiv.innerHTML = html;
}

async function gerarPDF() {
    const btn = document.getElementById("btnExportPDF");
    btn.classList.add("loading");
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        doc.setFontSize(22); doc.setTextColor(99, 102, 241); doc.text("SerranaHoras - Relatorio de Saldos Separados", 20, 20);
        doc.setFontSize(11); doc.setTextColor(100, 100, 100); doc.text(`Gerado em: ${new Date().toLocaleString()}`, 20, 32);
        
        const dadosAgrupados = agruparDadosRelatorio(dadosRelatorio);
        const tableData = dadosAgrupados.map(r => [
            r.colaborador, r.cargo, 
            formatarSaldoTexto(r.h50), formatarSaldoTexto(r.h80), formatarSaldoTexto(r.h100), 
            formatarSaldoTexto(r.noturno), formatarSaldoTexto(r.atrasos), formatarSaldoTexto(r.total)
        ]);
        
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totAtraso = 0, totGeral = 0;
        dadosAgrupados.forEach(r => { tot50+=r.h50; tot80+=r.h80; tot100+=r.h100; totNot+=r.noturno; totAtraso+=r.atrasos; totGeral+=r.total; });
        tableData.push([
            'TOTAL GERAL', '-', 
            formatarSaldoTexto(tot50), formatarSaldoTexto(tot80), formatarSaldoTexto(tot100), 
            formatarSaldoTexto(totNot), formatarSaldoTexto(totAtraso), formatarSaldoTexto(totGeral)
        ]);
        
        doc.autoTable({ 
            startY: 40, 
            head: [['Colaborador', 'Cargo', 'Saldo 50%', 'Saldo 80%', 'Saldo 100%', 'Saldo Noturno', 'Atrasos Indev.', 'Saldo Total']], 
            body: tableData, 
            theme: 'grid', 
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] }
        });
        doc.save(`relatorio_saldos_${new Date().toISOString().slice(0,19)}.pdf`);
    } catch (e) { alert("Erro ao gerar PDF."); }
    btn.classList.remove("loading");
}

async function gerarExcel() {
    const btn = document.getElementById("btnExportExcel"); btn.classList.add("loading");
    try {
        const wb = XLSX.utils.book_new();
        const dadosAgrupados = agruparDadosRelatorio(dadosRelatorio);
        const excelResumo = dadosAgrupados.map(r => ({
            'Colaborador': r.colaborador, 'Cargo': r.cargo, 
            'Saldo 50%': formatarSaldoTexto(r.h50), 
            'Saldo 80%': formatarSaldoTexto(r.h80), 
            'Saldo 100%': formatarSaldoTexto(r.h100), 
            'Saldo Noturno': formatarSaldoTexto(r.noturno), 
            'Atrasos Indevidos': formatarSaldoTexto(r.atrasos), 
            'Saldo Total': formatarSaldoTexto(r.total)
        }));
        
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totAtraso = 0, totGeral = 0;
        dadosAgrupados.forEach(r => { tot50+=r.h50; tot80+=r.h80; tot100+=r.h100; totNot+=r.noturno; totAtraso+=r.atrasos; totGeral+=r.total; });
        excelResumo.push({
            'Colaborador': 'TOTAL GERAL', 'Cargo': '-', 
            'Saldo 50%': formatarSaldoTexto(tot50), 
            'Saldo 80%': formatarSaldoTexto(tot80), 
            'Saldo 100%': formatarSaldoTexto(tot100), 
            'Saldo Noturno': formatarSaldoTexto(totNot), 
            'Atrasos Indevidos': formatarSaldoTexto(totAtraso), 
            'Saldo Total': formatarSaldoTexto(totGeral)
        });
        
        const wsResumo = XLSX.utils.json_to_sheet(excelResumo);
        XLSX.utils.book_append_sheet(wb, wsResumo, "Saldos Separados");
        XLSX.writeFile(wb, `relatorio_saldos_${new Date().toISOString().slice(0,19)}.xlsx`);
    } catch (e) { alert("Erro ao gerar Excel."); }
    btn.classList.remove("loading");
}

async function gerarCSV() {
    const btn = document.getElementById("btnExportCSV"); btn.classList.add("loading");
    try {
        const dadosAgrupados = agruparDadosRelatorio(dadosRelatorio);
        const headers = ['Colaborador', 'Cargo', 'Saldo 50%', 'Saldo 80%', 'Saldo 100%', 'Saldo Noturno', 'Atrasos Indevidos', 'Saldo Total'];
        const rows = dadosAgrupados.map(r => [
            r.colaborador, r.cargo, 
            formatarSaldoTexto(r.h50), formatarSaldoTexto(r.h80), formatarSaldoTexto(r.h100), 
            formatarSaldoTexto(r.noturno), formatarSaldoTexto(r.atrasos), formatarSaldoTexto(r.total)
        ]);
        let csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `relatorio_saldos_${new Date().toISOString().slice(0,19)}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (e) { alert("Erro ao gerar CSV."); }
    btn.classList.remove("loading");
}

document.addEventListener("DOMContentLoaded", initRelatorios);