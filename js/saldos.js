let colaboradoresGlobais = [];
let lancamentosGlobais = [];
let dadosSaldosParaExportacao = [];

async function initSaldos() {
    await initSupabase();
    await verificarConexao();
    await atualizarStatsGlobais();
    
    colaboradoresGlobais = await Database.getColaboradores();
    lancamentosGlobais = await Database.getLancamentos();
    
    await carregarSaldos(lancamentosGlobais);

    document.getElementById("btnExportPDF").addEventListener("click", gerarPDFSaldos);
    document.getElementById("btnExportExcel").addEventListener("click", gerarExcelSaldos);
}

// Funções para formatar saldos com sinais de + e -
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

async function carregarSaldos(todosLancamentos) {
    const resumo = await Database.getResumoGeral(colaboradoresGlobais, todosLancamentos);
    const corpo = document.getElementById("saldos-corpo");
    if (!corpo) return;
    
    corpo.innerHTML = '';
    dadosSaldosParaExportacao = [];

    if (resumo.length === 0) {
        corpo.innerHTML = `<tr><td colspan="17" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum registo encontrado.</td></tr>`;
        return;
    }
    
    resumo.forEach(item => {
        // Totais e cálculos por coluna
        const aPagar = item.totalGeral.total;
        const aDescontar = item.totalExcedente.total;
        const saldoTotal = aPagar - aDescontar;
        
        const s50 = item.totalGeral.h50 - item.totalExcedente.h50;
        const s80 = item.totalGeral.h80 - item.totalExcedente.h80;
        const s100 = item.totalGeral.h100 - item.totalExcedente.h100;
        const sNot = item.totalGeral.noturno - item.totalExcedente.noturno;
        const sAtr = item.totalGeral.atrasos;

        // Guarda em colunas separadas para Excel e PDF
        dadosSaldosParaExportacao.push({
            colaborador: item.colaborador.nome,
            cargo: item.colaborador.cargo,
            pag50: formatarHora(item.totalGeral.h50),
            pag80: formatarHora(item.totalGeral.h80),
            pag100: formatarHora(item.totalGeral.h100),
            pagNot: formatarHora(item.totalGeral.noturno),
            pagAtr: formatarHora(item.totalGeral.atrasos),
            exc50: formatarHora(item.totalExcedente.h50),
            exc80: formatarHora(item.totalExcedente.h80),
            exc100: formatarHora(item.totalExcedente.h100),
            excNot: formatarHora(item.totalExcedente.noturno),
            saldo50: formatarSaldoTexto(s50),
            saldo80: formatarSaldoTexto(s80),
            saldo100: formatarSaldoTexto(s100),
            saldoNot: formatarSaldoTexto(sNot),
            saldoAtr: formatarSaldoTexto(sAtr),
            saldoTotal: formatarSaldoTexto(saldoTotal)
        });

        // Tabela Web Separada
        corpo.innerHTML += `<tr>
            <td><i class="fas fa-user"></i> ${item.colaborador.nome}</td>
            <td>${item.colaborador.cargo}</td>
            
            <td style="color: #10b981;">${formatarHora(item.totalGeral.h50)}</td>
            <td style="color: #10b981;">${formatarHora(item.totalGeral.h80)}</td>
            <td style="color: #10b981;">${formatarHora(item.totalGeral.h100)}</td>
            <td style="color: #10b981;">${formatarHora(item.totalGeral.noturno)}</td>
            <td style="color: #10b981;">${formatarHora(item.totalGeral.atrasos)}</td>
            
            <td style="color: #ef4444;">${formatarHora(item.totalExcedente.h50)}</td>
            <td style="color: #ef4444;">${formatarHora(item.totalExcedente.h80)}</td>
            <td style="color: #ef4444;">${formatarHora(item.totalExcedente.h100)}</td>
            <td style="color: #ef4444;">${formatarHora(item.totalExcedente.noturno)}</td>
            
            <td style="background: rgba(99,102,241,0.05);">${formatarSaldoHtml(s50)}</td>
            <td style="background: rgba(99,102,241,0.05);">${formatarSaldoHtml(s80)}</td>
            <td style="background: rgba(99,102,241,0.05);">${formatarSaldoHtml(s100)}</td>
            <td style="background: rgba(99,102,241,0.05);">${formatarSaldoHtml(sNot)}</td>
            <td style="background: rgba(99,102,241,0.05);">${formatarSaldoHtml(sAtr)}</td>
            <td style="background: rgba(99,102,241,0.15); font-size: 1.05em;">${formatarSaldoHtml(saldoTotal)}</td>
        </tr>`;
    });
}

async function gerarPDFSaldos() {
    if (dadosSaldosParaExportacao.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        
        doc.setFontSize(20); 
        doc.setTextColor(99, 102, 241); 
        doc.text("SerranaHoras - Saldos Detalhados (Separados)", 20, 20);
        
        doc.setFontSize(11); 
        doc.setTextColor(100, 100, 100); 
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 20, 32);
        
        // Removemos o cargo do PDF para caberem as 16 colunas perfeitamente
        const tableData = dadosSaldosParaExportacao.map(r => [
            r.colaborador, 
            r.pag50, r.pag80, r.pag100, r.pagNot, r.pagAtr, 
            r.exc50, r.exc80, r.exc100, r.excNot, 
            r.saldo50, r.saldo80, r.saldo100, r.saldoNot, r.saldoAtr, r.saldoTotal
        ]);
        
        doc.autoTable({ 
            startY: 40, 
            head: [
                [
                    'Colaborador',
                    'Pg.50', 'Pg.80', 'Pg.100', 'Pg.Not', 'Pg.Atr', 
                    'Ex.50', 'Ex.80', 'Ex.100', 'Ex.Not', 
                    'S.50', 'S.80', 'S.100', 'S.Not', 'S.Atr', 'TOTAL'
                ]
            ], 
            body: tableData, 
            theme: 'grid', 
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontSize: 7, halign: 'center' },
            styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
            columnStyles: { 0: { halign: 'left', cellWidth: 25 } }
        });
        
        doc.save(`saldos_separados_${new Date().toISOString().slice(0,19)}.pdf`);
    } catch (e) { 
        console.error("Erro no PDF:", e);
        alert("Erro ao gerar PDF."); 
    }
}

async function gerarExcelSaldos() {
    if (dadosSaldosParaExportacao.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }
    try {
        const wb = XLSX.utils.book_new();
        // Mapeamento direto para colunas do Excel
        const excelResumo = dadosSaldosParaExportacao.map(r => ({
            'Colaborador': r.colaborador, 
            'Cargo': r.cargo,
            'Pagar - 50%': r.pag50,
            'Pagar - 80%': r.pag80,
            'Pagar - 100%': r.pag100,
            'Pagar - Noturno': r.pagNot,
            'Pagar - Atrasos': r.pagAtr,
            'Descontar - 50%': r.exc50,
            'Descontar - 80%': r.exc80,
            'Descontar - 100%': r.exc100,
            'Descontar - Noturno': r.excNot,
            'Saldo 50%': r.saldo50,
            'Saldo 80%': r.saldo80,
            'Saldo 100%': r.saldo100,
            'Saldo Noturno': r.saldoNot,
            'Saldo Atrasos': r.saldoAtr,
            'SALDO TOTAL': r.saldoTotal
        }));
        
        const wsResumo = XLSX.utils.json_to_sheet(excelResumo);
        XLSX.utils.book_append_sheet(wb, wsResumo, "Saldos Separados");
        XLSX.writeFile(wb, `saldos_separados_${new Date().toISOString().slice(0,19)}.xlsx`);
    } catch (e) { 
        console.error("Erro no Excel:", e);
        alert("Erro ao gerar Excel."); 
    }
}

document.addEventListener("DOMContentLoaded", initSaldos);