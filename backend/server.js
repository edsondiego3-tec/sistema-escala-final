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

// --- ROTAS DE SERVOS ---

// LISTAR (Apenas os ativos, ou seja, onde deletado_em é NULO)
app.get('/servos', async (req, res) => {
    const { ver_lixeira } = req.query; // Recebe parametro se quer ver lixeira
    let query = supabase.from('servos').select('*').order('nome');
    
    if (ver_lixeira === 'true') {
        query = query.not('deletado_em', 'is', null); // Só os excluídos
    } else {
        query = query.is('deletado_em', null); // Só os ativos
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ erro: error.message });
    res.json(data);
});

app.post('/servos', async (req, res) => {
    const { nome, ministerio, telefone } = req.body;
    try {
        const { error } = await supabase.from('servos').insert([{ nome, ministerio, telefone }]);
        if (error) throw error;
        res.json({ message: "Cadastrado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.put('/servos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, ministerio, telefone, senha, restaurar } = req.body;
    
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });

    try {
        let dadosParaAtualizar = {};
        
        // Se for comando de RESTAURAR
        if (restaurar) {
            dadosParaAtualizar = { deletado_em: null }; // Remove a data de exclusão
        } else {
            dadosParaAtualizar = { nome, ministerio, telefone };
        }

        const { error } = await supabase.from('servos').update(dadosParaAtualizar).eq('id', id);
        if (error) throw error;
        res.json({ message: restaurar ? "Servo restaurado!" : "Atualizado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETAR (Agora é SOFT DELETE: Apenas marca a data)
app.delete('/servos-cadastro/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    
    try {
        // Marca como deletado (não apaga de verdade)
        const { error } = await supabase.from('servos').update({ deletado_em: new Date() }).eq('id', id);
        if (error) throw error;
        res.json({ message: "Enviado para a lixeira!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// --- ESCALAS ---
app.get('/escalas/:data', async (req, res) => {
    const { data: lista } = await supabase.from('escalas')
        .select('*, servos(nome, telefone)')
        .eq('data', req.params.data)
        .is('deletado_em', null); // Não mostra escalas excluídas
    res.json(lista || []);
});

app.post('/escalar-multiplo', async (req, res) => {
    const { servo_ids, data, ministerio_nome, responsavel, senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });

    let salvos = 0;
    for (const id of servo_ids) {
        // Verifica se já existe ATIVO
        const { data: conflito } = await supabase.from('escalas').select('*').eq('servo_id', id).eq('data', data).is('deletado_em', null);
        if (!conflito || conflito.length === 0) {
            await supabase.from('escalas').insert([{ servo_id: id, data, ministerio_nome }]);
            salvos++;
        }
    }
    res.json({ mensagem: `Sucesso! ${salvos} escalados.` });
});

app.delete('/escalas/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    // Soft delete na escala também
    await supabase.from('escalas').update({ deletado_em: new Date() }).eq('id', id);
    res.json({ message: "Removido da escala!" });
});

// --- CALENDÁRIO ---
app.get('/eventos', async (req, res) => {
    const { data } = await supabase.from('eventos').select('*').is('deletado_em', null).order('data');
    res.json(data || []);
});

app.post('/eventos', async (req, res) => {
    const { titulo, data, ministerio, senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    await supabase.from('eventos').insert([{ titulo, data, ministerio }]);
    res.json({ message: "Evento criado!" });
});

app.delete('/eventos/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "🔒 Senha incorreta!" });
    await supabase.from('eventos').update({ deletado_em: new Date() }).eq('id', id);
    res.json({ message: "Evento apagado!" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));