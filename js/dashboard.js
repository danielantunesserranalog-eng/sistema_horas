let colaboradoresGlobais = [];
let lancamentosGlobais = [];

async function initDashboard() {
    await initSupabase();
    await verificarConexao();
    
    colaboradoresGlobais = await Database.getColaboradores();
    lancamentosGlobais = await Database.getLancamentos();
    
    await atualizarStatsGlobais();
    await carregarResumo();
}

async function carregarResumo() {
    const resumo = await Database.getResumoGeral(colaboradoresGlobais, lancamentosGlobais);
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
            <td style="color:#ffffff; font-weight: bold;">${formatarHora(item.totalGeral.atrasos)}</td>
            <td style="background: var(--success); font-weight: bold;">${formatarHora(item.totalGeral.total)}</td>
            <td><button onclick="excluirColaborador(${item.colaborador.id})" class="btn-primary" style="background: var(--danger); padding: 5px 10px;"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
}

window.excluirColaborador = async function(id) {
    if (confirm("Tem certeza que deseja excluir este colaborador?")) {
        const success = await Database.deleteColaborador(id);
        if (success) {
            await initDashboard();
            alert("✅ Colaborador excluído com sucesso!");
        } else {
            alert("❌ Erro ao excluir colaborador");
        }
    }
};

document.addEventListener("DOMContentLoaded", initDashboard);