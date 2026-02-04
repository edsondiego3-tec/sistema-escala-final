const express = require('express');
const cors = require('cors');
const path = require('path');
const supabase = require('./database');

const app = express();
const SENHA_COORDENADOR = 'admin123'; 

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

async function gravarHistorico(acao, detalhes, responsavel) {
    try { await supabase.from('historico').insert([{ acao, detalhes, responsavel }]); } catch (e) {}
}

// --- SERVOS (Agora com Telefone) ---
app.get('/servos', async (req, res) => {
    const { data, error } = await supabase.from('servos').select('*').order('nome');
    if (error) return res.status(500).json({ erro: error.message });
    res.json(data);
});

app.post('/servos', async (req, res) => {
    const { nome, ministerio, telefone } = req.body; // Recebe telefone
    try {
        const { error } = await supabase.from('servos').insert([{ nome, ministerio, telefone }]);
        if (error) throw error;
        res.json({ message: "Cadastrado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.put('/servos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, ministerio, telefone, senha } = req.body; // Recebe telefone
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    try {
        const { error } = await supabase.from('servos').update({ nome, ministerio, telefone }).eq('id', id);
        if (error) throw error;
        res.json({ message: "Atualizado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/servos-cadastro/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    try {
        await supabase.from('escalas').delete().eq('servo_id', id);
        const { error } = await supabase.from('servos').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: "Removido!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// --- ESCALAS (Traz o telefone junto) ---
app.get('/escalas/:data', async (req, res) => {
    // Busca o telefone do servo na hora de montar a escala
    const { data: lista, error } = await supabase.from('escalas').select('*, servos(nome, telefone)').eq('data', req.params.data);
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
    res.json({ mensagem: `Sucesso! ${salvos} escalados.` });
});

app.delete('/escalas/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    await supabase.from('escalas').delete().eq('id', id);
    res.json({ message: "Excluído!" });
});

// --- CALENDÁRIO ---
app.get('/eventos', async (req, res) => {
    const { data, error } = await supabase.from('eventos').select('*').order('data');
    res.json(data || []);
});

app.post('/eventos', async (req, res) => {
    const { titulo, data, ministerio, senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    try {
        const { error } = await supabase.from('eventos').insert([{ titulo, data, ministerio }]);
        if (error) throw error;
        res.json({ message: "Evento criado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/eventos/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    try { await supabase.from('eventos').delete().eq('id', id); res.json({ message: "Apagado!" }); } catch (e) { res.status(500).json({ erro: e.message }); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));