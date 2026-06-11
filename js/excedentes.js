let colaboradoresGlobais = [];
let lancamentosGlobais = [];
let dadosExcedentesParaExportacao = []; // Array para armazenar os dados para o Excel/PDF

async function initExcedentes() {
    await initSupabase();
    await verificarConexao();
    await atualizarStatsGlobais();
    
    colaboradoresGlobais = await Database.getColaboradores();
    lancamentosGlobais = await Database.getLancamentos();
    
    await carregarExcedentes(lancamentosGlobais);

    // Eventos para os botões de exportação
    document.getElementById("btnExportPDFExc").addEventListener("click", gerarPDFExcedentes);
    document.getElementById("btnExportExcelExc").addEventListener("click", gerarExcelExcedentes);
}

async function carregarExcedentes(todosLancamentos) {
    const resumo = await Database.getResumoGeral(colaboradoresGlobais, todosLancamentos);
    const corpo = document.getElementById("excedentes-corpo");
    if (!corpo) return;
    
    corpo.innerHTML = '';
    let encontrouExcedentes = false;
    dadosExcedentesParaExportacao = []; // Limpa dados antigos

    // Variáveis para somar os totais para os indicadores
    let totExc50 = 0;
    let totExc80 = 0;
    let totExc100 = 0;
    let totExcNoturno = 0;
    
    resumo.forEach(item => {
        if (item.totalExcedente.total > 0) {
            encontrouExcedentes = true;
            
            // Incrementa os totais gerais
            totExc50 += item.totalExcedente.h50;
            totExc80 += item.totalExcedente.h80;
            totExc100 += item.totalExcedente.h100;
            totExcNoturno += item.totalExcedente.noturno;

            // Guarda os dados para exportação
            dadosExcedentesParaExportacao.push({
                colaborador: item.colaborador.nome,
                h50: item.totalExcedente.h50,
                h80: item.totalExcedente.h80,
                h100: item.totalExcedente.h100,
                noturno: item.totalExcedente.noturno,
                total: item.totalExcedente.total
            });

            corpo.innerHTML += `<tr>
                <td><i class="fas fa-user"></i> ${item.colaborador.nome}</td>
                <td>${formatarHora(item.totalExcedente.h50)}</td>
                <td>${formatarHora(item.totalExcedente.h80)}</td>
                <td>${formatarHora(item.totalExcedente.h100)}</td>
                <td>${formatarHora(item.totalExcedente.noturno)}</td>
                <td style="background: var(--accent); color: white; font-weight: bold;">${formatarHora(item.totalExcedente.total)}</td>
            </tr>`;
        }
    });

    // Atualiza os cards indicadores na tela
    document.getElementById('ind-exc-50').innerText = formatarHora(totExc50);
    document.getElementById('ind-exc-80').innerText = formatarHora(totExc80);
    document.getElementById('ind-exc-100').innerText = formatarHora(totExc100);
    document.getElementById('ind-exc-noturno').innerText = formatarHora(totExcNoturno);

    if (!encontrouExcedentes) {
        corpo.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum registo de horas pagas a mais encontrado.</td></tr>`;
    }
}

// ============================================
// FUNÇÕES DE EXPORTAÇÃO
// ============================================

async function gerarPDFExcedentes() {
    if (dadosExcedentesParaExportacao.length === 0) {
        alert("Não há dados de excedentes para exportar.");
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        
        doc.setFontSize(24); 
        doc.setTextColor(99, 102, 241); 
        doc.text("SerranaHoras - Relatório de Horas Pagas a Mais", 20, 20);
        
        doc.setFontSize(12); 
        doc.setTextColor(100, 100, 100); 
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 20, 35);
        
        const tableData = dadosExcedentesParaExportacao.map(r => [
            r.colaborador, 
            formatarHora(r.h50), 
            formatarHora(r.h80), 
            formatarHora(r.h100), 
            formatarHora(r.noturno), 
            formatarHora(r.total)
        ]);
        
        // Calcular totais para a última linha
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;
        dadosExcedentesParaExportacao.forEach(r => { 
            tot50 += r.h50; tot80 += r.h80; tot100 += r.h100; totNot += r.noturno; totGeral += r.total; 
        });
        
        tableData.push([
            'TOTAL GERAL', 
            formatarHora(tot50), 
            formatarHora(tot80), 
            formatarHora(tot100), 
            formatarHora(totNot), 
            formatarHora(totGeral)
        ]);
        
        doc.autoTable({ 
            startY: 45, 
            head: [['Colaborador', 'Excedente 50%', 'Excedente 80%', 'Excedente 100%', 'Excedente Noturno', 'Total a Mais']], 
            body: tableData, 
            theme: 'grid', 
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] }
        });
        
        doc.save(`horas_a_mais_${new Date().toISOString().slice(0,19)}.pdf`);
    } catch (e) { 
        console.error("Erro no PDF:", e);
        alert("Erro ao gerar PDF."); 
    }
}

async function gerarExcelExcedentes() {
    if (dadosExcedentesParaExportacao.length === 0) {
        alert("Não há dados de excedentes para exportar.");
        return;
    }

    try {
        const wb = XLSX.utils.book_new();
        
        const excelResumo = dadosExcedentesParaExportacao.map(r => ({
            'Colaborador': r.colaborador, 
            'Excedente 50%': formatarHora(r.h50), 
            'Excedente 80%': formatarHora(r.h80), 
            'Excedente 100%': formatarHora(r.h100), 
            'Excedente Noturno': formatarHora(r.noturno), 
            'Total Pago a Mais (h)': formatarHora(r.total)
        }));
        
        // Calcular totais para a última linha
        let tot50 = 0, tot80 = 0, tot100 = 0, totNot = 0, totGeral = 0;
        dadosExcedentesParaExportacao.forEach(r => { 
            tot50 += r.h50; tot80 += r.h80; tot100 += r.h100; totNot += r.noturno; totGeral += r.total; 
        });
        
        excelResumo.push({
            'Colaborador': 'TOTAL GERAL', 
            'Excedente 50%': formatarHora(tot50), 
            'Excedente 80%': formatarHora(tot80), 
            'Excedente 100%': formatarHora(tot100), 
            'Excedente Noturno': formatarHora(totNot), 
            'Total Pago a Mais (h)': formatarHora(totGeral)
        });
        
        const wsResumo = XLSX.utils.json_to_sheet(excelResumo);
        XLSX.utils.book_append_sheet(wb, wsResumo, "Horas a Mais");
        XLSX.writeFile(wb, `horas_a_mais_${new Date().toISOString().slice(0,19)}.xlsx`);
    } catch (e) { 
        console.error("Erro no Excel:", e);
        alert("Erro ao gerar Excel."); 
    }
}

document.addEventListener("DOMContentLoaded", initExcedentes);