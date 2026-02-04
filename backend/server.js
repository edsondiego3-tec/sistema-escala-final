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

// --- ROTAS GENÉRICAS DE LIXEIRA ---
// Listar Lixo
app.get('/lixeira/:tipo', async (req, res) => {
    const { tipo } = req.params; // 'servos', 'eventos', 'escalas'
    // Busca tudo que TEM data de exclusão (ou seja, está no lixo)
    const { data, error } = await supabase.from(tipo).select('*').not('deletado_em', 'is', null);
    if(error) return res.status(500).json({erro: error.message});
    res.json(data);
});

// Restaurar do Lixo
app.post('/restaurar/:tipo/:id', async (req, res) => {
    const { tipo, id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta" });

    // "Desapaga" removendo a data de exclusão
    const { error } = await supabase.from(tipo).update({ deletado_em: null }).eq('id', id);
    if(error) return res.status(500).json({erro: error.message});
    res.json({ message: "Restaurado com sucesso!" });
});

// Esvaziar Lixo (Apagar de verdade)
app.delete('/lixeira/:tipo/:id', async (req, res) => {
    const { tipo, id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta" });

    const { error } = await supabase.from(tipo).delete().eq('id', id);
    if(error) return res.status(500).json({erro: error.message});
    res.json({ message: "Item excluído permanentemente!" });
});


// --- SERVOS (Modificado para Soft Delete) ---
app.get('/servos', async (req, res) => {
    // Só traz quem NÃO foi deletado
    const { data, error } = await supabase.from('servos').select('*').is('deletado_em', null).order('nome');
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
    const { nome, ministerio, telefone, senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });
    try {
        const { error } = await supabase.from('servos').update({ nome, ministerio, telefone }).eq('id', id);
        if (error) throw error;
        res.json({ message: "Atualizado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// "Apagar" Servo = Mover para Lixeira
app.delete('/servos-cadastro/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });
    try {
        // Marca hora da exclusão
        const { error } = await supabase.from('servos').update({ deletado_em: new Date() }).eq('id', id);
        if (error) throw error;
        res.json({ message: "Enviado para a Lixeira!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// --- ESCALAS ---
app.get('/escalas/:data', async (req, res) => {
    const { data: lista, error } = await supabase
        .from('escalas')
        .select('*, servos(nome, telefone)')
        .eq('data', req.params.data)
        .is('deletado_em', null); // Só traz escalas ativas
    res.json(lista || []);
});

app.post('/escalar-multiplo', async (req, res) => {
    const { servo_ids, data, ministerio_nome, responsavel, senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });

    let salvos = 0;
    for (const id of servo_ids) {
        try {
            const { data: conflito } = await supabase.from('escalas').select('*').eq('servo_id', id).eq('data', data).is('deletado_em', null);
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
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });
    // Soft Delete na escala
    await supabase.from('escalas').update({ deletado_em: new Date() }).eq('id', id);
    res.json({ message: "Escala removida!" });
});

// --- CALENDÁRIO ---
app.get('/eventos', async (req, res) => {
    const { data, error } = await supabase.from('eventos').select('*').is('deletado_em', null).order('data');
    res.json(data || []);
});

app.post('/eventos', async (req, res) => {
    const { titulo, data, ministerio, senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });
    try {
        const { error } = await supabase.from('eventos').insert([{ titulo, data, ministerio }]);
        if (error) throw error;
        res.json({ message: "Evento criado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/eventos/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });
    // Soft Delete no evento
    try { await supabase.from('eventos').update({ deletado_em: new Date() }).eq('id', id); res.json({ message: "Evento enviado para lixeira!" }); } 
    catch (e) { res.status(500).json({ erro: e.message }); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));