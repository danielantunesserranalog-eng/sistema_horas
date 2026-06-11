async function verificarConexao() {
    const dbStatus = document.getElementById("dbStatus");
    const supabase = await window.initSupabase();
    if(!dbStatus) return;
    
    if (supabase) {
        dbStatus.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> Banco Conectado';
        dbStatus.style.color = "#10b981";
    } else {
        dbStatus.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i> Falha na Conexão';
        dbStatus.style.color = "#ef4444";
    }
}

function formatarHora(decimal) {
    if (!decimal || isNaN(decimal) || decimal <= 0) return "00:00";
    decimal = Math.max(0, decimal);
    const horas = Math.floor(decimal);
    const minutos = Math.round((decimal - horas) * 60);
    if (minutos === 60) return `${String(horas + 1).padStart(2, '0')}:00`;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function formatarHoraInput(decimal) {
    if (!decimal || isNaN(decimal) || decimal <= 0) return "";
    const horas = Math.floor(decimal);
    const minutos = Math.round((decimal - horas) * 60);
    if (minutos === 60) return `${String(horas + 1).padStart(2, '0')}:00`;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function getValSeguro(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}

function setValSeguro(id, valor) {
    const el = document.getElementById(id);
    if (el) el.value = valor;
}

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

async function atualizarStatsGlobais() {
    const colaboradores = await Database.getColaboradores();
    const lancamentos = await Database.getLancamentos();
    const resumo = await Database.getResumoGeral(colaboradores, lancamentos);
    const totalHoras = resumo.reduce((acc, item) => acc + item.totalGeral.total, 0);
    
    const divColab = document.getElementById("totalColaboradores");
    const divHoras = document.getElementById("totalHorasDevidas");
    
    if(divColab) divColab.innerText = colaboradores.length;
    if(divHoras) divHoras.innerText = formatarHora(totalHoras);
}