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

    async getResumoGeral() {
        const colaboradores = await this.getColaboradores();
        const lancamentos = await this.getLancamentos();
        
        const resumo = colaboradores.map(colab => {
            const lancColab = lancamentos.filter(l => l.colaborador_id === colab.id);
            let marco = 0, abril = 0, maio = 0;
            
            lancColab.forEach(lanc => {
                const falta50 = (lanc.h50 || 0) - (lanc.pago50 || 0);
                const falta80 = (lanc.h80 || 0) - (lanc.pago80 || 0);
                const falta100 = (lanc.h100 || 0) - (lanc.pago100 || 0);
                const faltaNoturno = (lanc.adicional_noturno || 0) - (lanc.pago_noturno || 0);
                const totalFalta = Math.max(0, falta50) + Math.max(0, falta80) + 
                                   Math.max(0, falta100) + Math.max(0, faltaNoturno);
                
                if (lanc.mes === 'marco') marco = totalFalta;
                else if (lanc.mes === 'abril') abril = totalFalta;
                else if (lanc.mes === 'maio') maio = totalFalta;
            });
            
            return {
                colaborador: colab,
                marco, abril, maio,
                total: marco + abril + maio
            };
        });
        
        return resumo;
    }
};

// Exportar para uso global
window.Database = Database;
window.initSupabase = initSupabase;