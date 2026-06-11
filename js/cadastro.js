let colaboradoresGlobais = [];

async function initCadastro() {
    await initSupabase();
    await verificarConexao();
    await atualizarStatsGlobais();
    await atualizarLista();
    
    document.getElementById("btnCadastrar").addEventListener("click", cadastrarColaborador);
}

async function atualizarLista() {
    colaboradoresGlobais = await Database.getColaboradores();
    const container = document.getElementById("listaNomes");
    if(!container) return;
    
    if (colaboradoresGlobais.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum colaborador cadastrado</div>';
        return;
    }
    
    container.innerHTML = colaboradoresGlobais.map(colab => `
        <div class="colab-badge">
            <i class="fas fa-user"></i> ${colab.nome} (${colab.cargo})
            <button onclick="excluirColaborador(${colab.id})" style="background: none; border: none; color: white; cursor: pointer; margin-left: 8px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join("");
}

async function cadastrarColaborador() {
    const nome = document.getElementById("nome").value.trim();
    const cargo = document.getElementById("cargo").value.trim();
    
    if (!nome || !cargo) {
        alert("Preencha todos os campos!");
        return;
    }
    
    const result = await Database.addColaborador(nome, cargo);
    if (result) {
        document.getElementById("nome").value = "";
        document.getElementById("cargo").value = "";
        await atualizarLista();
        await atualizarStatsGlobais();
        alert("✅ Colaborador cadastrado com sucesso!");
    } else {
        alert("❌ Erro ao cadastrar colaborador");
    }
}

window.excluirColaborador = async function(id) {
    if (confirm("Tem certeza que deseja excluir este colaborador?")) {
        const success = await Database.deleteColaborador(id);
        if (success) {
            await atualizarLista();
            await atualizarStatsGlobais();
            alert("✅ Colaborador excluído com sucesso!");
        } else {
            alert("❌ Erro ao excluir colaborador");
        }
    }
};

document.addEventListener("DOMContentLoaded", initCadastro);