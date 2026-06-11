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
        corpo.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum registro encontrado.</td></tr>`;
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
            conclusaoHtml = `<span style="color: #ef4444; font-weight: bold;"><i class="fas fa-arrow-down"></i> Deve Descontar ${formatarHora(saldo)}</span>`;
            conclusaoTexto = `Deve Descontar ${formatarHora(saldo)}`;
        } else {
            conclusaoHtml = `<span style="color: var(--text-secondary); font-weight: bold;"><i class="fas fa-equals"></i> Zerado</span>`;
            conclusaoTexto = "Zerado";
        }

        dadosSaldosParaExportacao.push({
            colaborador: item.colaborador.nome,
            cargo: item.colaborador.cargo,
            aPagar: formatarHora(aPagar),
            aDescontar: formatarHora(aDescontar),
            saldo: conclusaoTexto
        });

        corpo.innerHTML += `<tr>
            <td><i class="fas fa-user"></i> ${item.colaborador.nome}</td>
            <td>${item.colaborador.cargo}</td>
            <td style="color: #10b981; font-weight: 500;">${formatarHora(aPagar)}</td>
            <td style="color: #ef4444; font-weight: 500;">${formatarHora(aDescontar)}</td>
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
        
        doc.setFontSize(24); 
        doc.setTextColor(99, 102, 241); 
        doc.text("SerranaHoras - Relatório de Saldos e Ajustes", 20, 20);
        
        doc.setFontSize(12); 
        doc.setTextColor(100, 100, 100); 
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 20, 35);
        
        const tableData = dadosSaldosParaExportacao.map(r => [
            r.colaborador, 
            r.cargo,
            r.aPagar, 
            r.aDescontar, 
            r.saldo
        ]);
        
        doc.autoTable({ 
            startY: 45, 
            head: [['Colaborador', 'Cargo', 'Horas a Pagar (Devido)', 'Horas a Descontar (Excedente)', 'Saldo Atual']], 
            body: tableData, 
            theme: 'grid', 
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] }
        });
        
        doc.save(`saldos_e_ajustes_${new Date().toISOString().slice(0,19)}.pdf`);
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
            'Horas a Pagar (Devido)': r.aPagar, 
            'Horas a Descontar (Excedente)': r.aDescontar, 
            'Saldo Atual': r.saldo
        }));
        
        const wsResumo = XLSX.utils.json_to_sheet(excelResumo);
        XLSX.utils.book_append_sheet(wb, wsResumo, "Saldos e Ajustes");
        XLSX.writeFile(wb, `saldos_e_ajustes_${new Date().toISOString().slice(0,19)}.xlsx`);
    } catch (e) { 
        console.error("Erro no Excel:", e);
        alert("Erro ao gerar Excel."); 
    }
}

document.addEventListener("DOMContentLoaded", initSaldos);