// Configuração central do Supabase
const SUPABASE_URL = 'https://zxtozyquwbocxhkeyofx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OnrjJBW-cc285CTJW7SkIg_1nBjB5MT';

// Inicializar cliente Supabase
let supabaseClient = null;

async function initSupabase() {
    if (window.supabase && !supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase conectado com sucesso');
        return supabaseClient;
    } else if (supabaseClient) {
        return supabaseClient;
    } else {
        console.error('❌ Supabase não carregado. Verifique a internet ou CDN.');
        return null;
    }
}

// Funções do banco de dados
const Database = {
    // Colaboradores
    async getColaboradores() {
        const supabase = await initSupabase();
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('colaboradores')
            .select('*')
            .order('id', { ascending: true });
        if (error) {
            console.error('Erro ao buscar colaboradores:', error);
            return [];
        }
        return data;
    },

    async addColaborador(nome, cargo) {
        const supabase = await initSupabase();
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('colaboradores')
            .insert([{ nome, cargo }])
            .select();
        if (error) {
            console.error('Erro ao adicionar colaborador:', error);
            return null;
        }
        return data[0];
    },

    async deleteColaborador(id) {
        const supabase = await initSupabase();
        if (!supabase) return false;
        const { error } = await supabase
            .from('colaboradores')
            .delete()
            .eq('id', id);
        if (error) {
            console.error('Erro ao deletar colaborador:', error);
            return false;
        }
        return true;
    },

    // Lançamentos
    async getLancamentos(colaboradorId = null, mes = null) {
        const supabase = await initSupabase();
        if (!supabase) return [];
        
        let query = supabase.from('lancamentos').select('*');
        if (colaboradorId) query = query.eq('colaborador_id', colaboradorId);
        if (mes) query = query.eq('mes', mes);
        
        const { data, error } = await query;
        if (error) {
            console.error('Erro ao buscar lançamentos:', error);
            return [];
        }
        return data;
    },

    async upsertLancamento(lancamento) {
        const supabase = await initSupabase();
        if (!supabase) return null;
        
        const { data, error } = await supabase
            .from('lancamentos')
            .upsert(lancamento, { 
                onConflict: 'colaborador_id,mes',
                ignoreDuplicates: false 
            })
            .select();
        
        if (error) {
            console.error('Erro ao salvar lançamento:', error);
            return null;
        }
        return data;
    },

    // Resumo Geral com Matemática de Soma para Atrasos Indevidos e Horas Excedentes
    async getResumoGeral(colabsCache = null, lancCache = null) {
        const colaboradores = colabsCache || await Database.getColaboradores();
        const lancamentos = lancCache || await Database.getLancamentos();
        
        const resumo = colaboradores.map(colab => {
            const lancColab = lancamentos.filter(l => l.colaborador_id === colab.id);
            
            let totalGeral = { h50: 0, h80: 0, h100: 0, noturno: 0, atrasos: 0, total: 0 };
            let totalExcedente = { h50: 0, h80: 0, h100: 0, noturno: 0, total: 0 }; // NOVO OBJETO PARA HORAS A MAIS
            
            lancColab.forEach(lanc => {
                // Cálculo de dívidas da empresa para com o colaborador
                const falta50 = Math.max(0, (lanc.h50 || 0) - (lanc.pago50 || 0));
                const falta80 = Math.max(0, (lanc.h80 || 0) - (lanc.pago80 || 0));
                const falta100 = Math.max(0, (lanc.h100 || 0) - (lanc.pago100 || 0));
                const faltaNoturno = Math.max(0, (lanc.adicional_noturno || 0) - (lanc.pago_noturno || 0));
                const atrasos = lanc.atrasos || 0;
                
                // NOVO: Cálculo do que foi pago a mais (pago menos o que era devido)
                const exc50 = Math.max(0, (lanc.pago50 || 0) - (lanc.h50 || 0));
                const exc80 = Math.max(0, (lanc.pago80 || 0) - (lanc.h80 || 0));
                const exc100 = Math.max(0, (lanc.pago100 || 0) - (lanc.h100 || 0));
                const excNoturno = Math.max(0, (lanc.pago_noturno || 0) - (lanc.adicional_noturno || 0));
                
                const totalFalta = (falta50 + falta80 + falta100 + faltaNoturno) + atrasos;
                const totalExc = exc50 + exc80 + exc100 + excNoturno;
                
                // Soma devida
                totalGeral.h50 += falta50;
                totalGeral.h80 += falta80;
                totalGeral.h100 += falta100;
                totalGeral.noturno += faltaNoturno;
                totalGeral.atrasos += atrasos;
                totalGeral.total += totalFalta;

                // Soma excedente
                totalExcedente.h50 += exc50;
                totalExcedente.h80 += exc80;
                totalExcedente.h100 += exc100;
                totalExcedente.noturno += excNoturno;
                totalExcedente.total += totalExc;
            });
            
            return {
                colaborador: colab,
                totalGeral: totalGeral,
                totalExcedente: totalExcedente // RETORNA O NOVO OBJETO
            };
        });
        
        return resumo;
    }
};

// Exportar para uso global
window.Database = Database;
window.initSupabase = initSupabase;