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

async function carregarSaldos(todosLancamentos) {
    const resumo = await Database.getResumoGeral(colaboradoresGlobais, todosLancamentos);
    const corpo = document.getElementById("saldos-corpo");
    if (!corpo) return;
    
    corpo.innerHTML = '';
    dadosSaldosParaExportacao = [];

    if (resumo.length === 0) {
        corpo.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum registo encontrado.</td></tr>`;
        return;
    }
    
    resumo.forEach(item => {
        const aPagar = item.totalGeral.total;
        const aDescontar = item.totalExcedente.total;
        
        let conclusaoHtml = "";
        let conclusaoTexto = "";
        
        if (aPagar > aDescontar) {
            const saldo = aPagar - aDescontar;
            conclusaoHtml = `<span style="color: #10b981; font-weight: bold;"><i class="fas fa-arrow-up"></i> Recebe ${formatarHora(saldo)}</span>`;
            conclusaoTexto = `Recebe ${formatarHora(saldo)}`;
        } else if (aDescontar > aPagar) {
            const saldo = aDescontar - aPagar;
            conclusaoHtml = `<span style="color: #ef4444; font-weight: bold;"><i class="fas fa-arrow-down"></i> Descontar ${formatarHora(saldo)}</span>`;
            conclusaoTexto = `Descontar ${formatarHora(saldo)}`;
        } else {
            conclusaoHtml = `<span style="color: var(--text-secondary); font-weight: bold;"><i class="fas fa-equals"></i> Zerado</span>`;
            conclusaoTexto = "Zerado";
        }

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
            saldo: conclusaoTexto
        });

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
            <td>${conclusaoHtml}</td>
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
        doc.text("SerranaHoras - Relatório Detalhado de Saldos e Ajustes", 20, 20);
        
        doc.setFontSize(11); 
        doc.setTextColor(100, 100, 100); 
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 20, 32);
        
        const tableData = dadosSaldosParaExportacao.map(r => [
            r.colaborador, 
            r.cargo,
            r.pag50,
            r.pag80,
            r.pag100,
            r.pagNot,
            r.pagAtr,
            r.exc50,
            r.exc80,
            r.exc100,
            r.excNot,
            r.saldo
        ]);
        
        doc.autoTable({ 
            startY: 40, 
            head: [
                [
                    'Colaborador', 'Cargo', 
                    'Pagar 50%', 'Pagar 80%', 'Pagar 100%', 'Pagar Not.', 'Pagar Atr.', 
                    'Desc. 50%', 'Desc. 80%', 'Desc. 100%', 'Desc. Not.', 
                    'Saldo Final'
                ]
            ], 
            body: tableData, 
            theme: 'grid', 
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontSize: 9 },
            styles: { fontSize: 9 }
        });
        
        doc.save(`saldos_detalhados_${new Date().toISOString().slice(0,19)}.pdf`);
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
        const excelResumo = dadosSaldosParaExportacao.map(r => ({
            'Colaborador': r.colaborador, 
            'Cargo': r.cargo,
            'A Pagar - 50%': r.pag50,
            'A Pagar - 80%': r.pag80,
            'A Pagar - 100%': r.pag100,
            'A Pagar - Noturno': r.pagNot,
            'A Pagar - Atrasos': r.pagAtr,
            'A Descontar - 50%': r.exc50,
            'A Descontar - 80%': r.exc80,
            'A Descontar - 100%': r.exc100,
            'A Descontar - Noturno': r.excNot,
            'Saldo Atual / Conclusão': r.saldo
        }));
        
        const wsResumo = XLSX.utils.json_to_sheet(excelResumo);
        XLSX.utils.book_append_sheet(wb, wsResumo, "Saldos Detalhados");
        XLSX.writeFile(wb, `saldos_detalhados_${new Date().toISOString().slice(0,19)}.xlsx`);
    } catch (e) { 
        console.error("Erro no Excel:", e);
        alert("Erro ao gerar Excel."); 
    }
}

document.addEventListener("DOMContentLoaded", initSaldos);