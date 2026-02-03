const express = require('express');
const cors = require('cors');
const path = require('path');
const supabase = require('./database'); // Sua conexão com o Supabase

const app = express();
const SENHA_COORDENADOR = 'admin123'; // <--- SUA SENHA MESTRA

app.use(express.json());
app.use(cors());

// --- CONFIGURAÇÃO PARA O SITE FUNCIONAR NA NUVEM (DEPLOY) ---
// 1. Diz ao servidor que a pasta 'frontend' tem os arquivos do site
app.use(express.static(path.join(__dirname, '../frontend')));

// 2. Se alguém acessar a raiz, entrega o site principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- FUNÇÃO AUXILIAR: GRAVAR HISTÓRICO ---
async function gravarHistorico(acao, detalhes, responsavel) {
    try {
        await supabase.from('historico').insert([{ acao, detalhes, responsavel }]);
    } catch (e) {
        console.error("Erro histórico:", e);
    }
}

// --- ROTAS DA API ---

// 1. LISTAR TODOS OS SERVOS
app.get('/servos', async (req, res) => {
    const { data, error } = await supabase.from('servos').select('*').order('nome');
    if (error) return res.status(500).json({ erro: error.message });
    res.json(data);
});

// 2. CADASTRAR NOVO SERVO
app.post('/servos', async (req, res) => {
    const { nome, ministerio } = req.body;
    if (!nome || !ministerio) return res.status(400).json({ erro: "Dados incompletos" });

    try {
        const { error } = await supabase.from('servos').insert([{ nome, ministerio }]);
        if (error) throw error;
        res.json({ message: "Cadastrado!" });
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

// 3. LISTAR ESCALA DO DIA
app.get('/escalas/:data', async (req, res) => {
    const { data: lista, error } = await supabase
        .from('escalas')
        .select('*, servos(nome)')
        .eq('data', req.params.data);
    if (error) return res.status(500).json({ erro: error.message });
    res.json(lista);
});

// 4. ESCALAR VÁRIOS (COM PROTEÇÃO DE SENHA)
app.post('/escalar-multiplo', async (req, res) => {
    // Agora recebe a SENHA também
    const { servo_ids, data, ministerio_nome, responsavel, senha } = req.body;

    // VERIFICAÇÃO DE SEGURANÇA
    if (senha !== SENHA_COORDENADOR) {
        return res.status(403).json({ erro: "🔒 Senha incorreta! A escala não foi salva." });
    }

    let salvos = 0;

    for (const id of servo_ids) {
        try {
            // Verifica se já existe para não duplicar
            const { data: conflito } = await supabase
                .from('escalas').select('*').eq('servo_id', id).eq('data', data);
            
            if (!conflito || conflito.length === 0) {
                await supabase.from('escalas').insert([{ servo_id: id, data, ministerio_nome }]);
                salvos++;
            }
        } catch (e) { console.error(e); }
    }

    if (salvos > 0) {
        await gravarHistorico('Escala em Massa', `${salvos} em ${ministerio_nome} dia ${data}`, responsavel);
    }

    res.json({ mensagem: `Sucesso! ${salvos} servos escalados.` });
});

// 5. EXCLUIR ESCALA (COM PROTEÇÃO DE SENHA)
app.delete('/escalas/:id', async (req, res) => {
    const { id } = req.params;
    const { senha, responsavel } = req.body;

    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });

    // Pega info antes de apagar (para o histórico)
    const { data: item } = await supabase.from('escalas').select('*, servos(nome)').eq('id', id).single();
    
    const { error } = await supabase.from('escalas').delete().eq('id', id);

    if (error) return res.status(500).json({ erro: "Erro ao excluir" });
    
    if (item) {
        await gravarHistorico('Exclusão', `${item.servos?.nome}`, responsavel);
    }

    res.json({ message: "Excluído!" });
});

// LIGA O SERVIDOR
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));