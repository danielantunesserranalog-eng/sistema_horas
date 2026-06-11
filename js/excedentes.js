let colaboradoresGlobais = [];
let lancamentosGlobais = [];

async function initExcedentes() {
    await initSupabase();
    await verificarConexao();
    await atualizarStatsGlobais();
    
    colaboradoresGlobais = await Database.getColaboradores();
    lancamentosGlobais = await Database.getLancamentos();
    
    await carregarExcedentes(lancamentosGlobais);
}

async function carregarExcedentes(todosLancamentos) {
    const resumo = await Database.getResumoGeral(colaboradoresGlobais, todosLancamentos);
    const corpo = document.getElementById("excedentes-corpo");
    if (!corpo) return;
    
    corpo.innerHTML = '';
    let encontrouExcedentes = false;
    
    resumo.forEach(item => {
        if (item.totalExcedente.total > 0) {
            encontrouExcedentes = true;
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

    if (!encontrouExcedentes) {
        corpo.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum registo de horas pagas a mais encontrado.</td></tr>`;
    }
}

document.addEventListener("DOMContentLoaded", initExcedentes);