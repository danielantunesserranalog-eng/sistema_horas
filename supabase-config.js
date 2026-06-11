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

    // Agora usa cache para ser ultra rápido e não travar
    async getResumoGeral(colabsCache = null, lancCache = null) {
        const colaboradores = colabsCache || await Database.getColaboradores();
        const lancamentos = lancCache || await Database.getLancamentos();
        
        const resumo = colaboradores.map(colab => {
            const lancColab = lancamentos.filter(l => l.colaborador_id === colab.id);
            
            let totalGeral = { h50: 0, h80: 0, h100: 0, noturno: 0, total: 0 };
            
            lancColab.forEach(lanc => {
                const falta50 = Math.max(0, (lanc.h50 || 0) - (lanc.pago50 || 0));
                const falta80 = Math.max(0, (lanc.h80 || 0) - (lanc.pago80 || 0));
                const falta100 = Math.max(0, (lanc.h100 || 0) - (lanc.pago100 || 0));
                const faltaNoturno = Math.max(0, (lanc.adicional_noturno || 0) - (lanc.pago_noturno || 0));
                const totalFalta = falta50 + falta80 + falta100 + faltaNoturno;
                
                totalGeral.h50 += falta50;
                totalGeral.h80 += falta80;
                totalGeral.h100 += falta100;
                totalGeral.noturno += faltaNoturno;
                totalGeral.total += totalFalta;
            });
            
            return {
                colaborador: colab,
                totalGeral: totalGeral
            };
        });
        
        return resumo;
    }
};

// Exportar para uso global
window.Database = Database;
window.initSupabase = initSupabase;