const express = require('express');
const cors = require('cors');
const path = require('path');
const supabase = require('./database');

const app = express();
const SENHA_COORDENADOR = 'admin123'; // <--- SUA SENHA

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

async function gravarHistorico(acao, detalhes, responsavel) {
    try { await supabase.from('historico').insert([{ acao, detalhes, responsavel }]); } 
    catch (e) { console.error(e); }
}

// --- ROTAS DE SERVOS (CADASTRO) ---

// 1. LISTAR
app.get('/servos', async (req, res) => {
    const { data, error } = await supabase.from('servos').select('*').order('nome');
    if (error) return res.status(500).json({ erro: error.message });
    res.json(data);
});

// 2. CADASTRAR
app.post('/servos', async (req, res) => {
    const { nome, ministerio } = req.body;
    try {
        const { error } = await supabase.from('servos').insert([{ nome, ministerio }]);
        if (error) throw error;
        res.json({ message: "Cadastrado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// 3. ATUALIZAR (MUDAR MINISTÉRIO/NOME) - COM SENHA
app.put('/servos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, ministerio, senha } = req.body;

    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });

    try {
        const { error } = await supabase.from('servos').update({ nome, ministerio }).eq('id', id);
        if (error) throw error;
        res.json({ message: "Servo atualizado com sucesso!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// 4. DELETAR SERVO DO CADASTRO - COM SENHA
app.delete('/servos-cadastro/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;

    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });

    try {
        // Primeiro apaga as escalas dele para não dar erro
        await supabase.from('escalas').delete().eq('servo_id', id);
        // Depois apaga o servo
        const { error } = await supabase.from('servos').delete().eq('id', id);
        
        if (error) throw error;
        res.json({ message: "Servo removido do sistema!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});


// --- ROTAS DE ESCALAS ---

app.get('/escalas/:data', async (req, res) => {
    const { data: lista, error } = await supabase.from('escalas').select('*, servos(nome)').eq('data', req.params.data);
    res.json(lista || []);
});

app.post('/escalar-multiplo', async (req, res) => {
    const { servo_ids, data, ministerio_nome, responsavel, senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });

    let salvos = 0;
    for (const id of servo_ids) {
        try {
            const { data: conflito } = await supabase.from('escalas').select('*').eq('servo_id', id).eq('data', data);
            if (!conflito || conflito.length === 0) {
                await supabase.from('escalas').insert([{ servo_id: id, data, ministerio_nome }]);
                salvos++;
            }
        } catch (e) {}
    }
    if (salvos > 0) await gravarHistorico('Escala em Massa', `${salvos} em ${ministerio_nome}`, responsavel);
    res.json({ mensagem: `Sucesso! ${salvos} escalados.` });
});

app.delete('/escalas/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    
    await supabase.from('escalas').delete().eq('id', id);
    res.json({ message: "Excluído!" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));