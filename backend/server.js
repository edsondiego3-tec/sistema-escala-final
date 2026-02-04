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

// --- ROTAS DA LIXEIRA (NOVAS) ---

// 1. Listar o que está no lixo
app.get('/lixeira/:tipo', async (req, res) => {
    const { tipo } = req.params; // 'servos' ou 'eventos'
    // Traz itens onde deletado_em NÃO é nulo
    const { data, error } = await supabase.from(tipo).select('*').not('deletado_em', 'is', null);
    if(error) return res.status(500).json({erro: error.message});
    res.json(data);
});

// 2. Restaurar (Tirar do lixo)
app.post('/restaurar/:tipo/:id', async (req, res) => {
    const { tipo, id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta" });

    // Limpa a data de exclusão
    const { error } = await supabase.from(tipo).update({ deletado_em: null }).eq('id', id);
    if(error) return res.status(500).json({erro: error.message});
    res.json({ message: "Item restaurado com sucesso!" });
});

// 3. Exclusão Permanente (Do lixo para o nada)
app.delete('/lixeira/:tipo/:id', async (req, res) => {
    const { tipo, id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta" });

    const { error } = await supabase.from(tipo).delete().eq('id', id);
    if(error) return res.status(500).json({erro: error.message});
    res.json({ message: "Excluído permanentemente." });
});


// --- ROTAS DE SERVOS (Soft Delete) ---
app.get('/servos', async (req, res) => {
    // Só mostra quem NÃO está deletado
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
    if (senha && senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });
    
    // Atualização simples (sem senha para importador as vezes, ou com senha via interface)
    // Para simplificar no importador, se não mandar senha, assume que é atualização em massa segura
    // Mas no frontend vamos manter a senha para edições manuais.
    
    try {
        const { error } = await supabase.from('servos').update({ nome, ministerio, telefone }).eq('id', id);
        if (error) throw error;
        res.json({ message: "Atualizado!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE AGORA É SOFT DELETE
app.delete('/servos-cadastro/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });
    
    try {
        // Marca hora da morte, mas não mata
        const { error } = await supabase.from('servos').update({ deletado_em: new Date() }).eq('id', id);
        if (error) throw error;
        res.json({ message: "Enviado para a Lixeira!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});


// --- ROTAS DE EVENTOS (Soft Delete) ---
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
    
    try {
        await supabase.from('eventos').update({ deletado_em: new Date() }).eq('id', id);
        res.json({ message: "Evento na lixeira!" });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});


// --- ROTAS DE ESCALAS (Essas podem ser delete real ou soft, vamos manter delete real por enquanto para não complicar a visualização, ou soft se preferir segurança total) ---
// Vamos manter delete REAL para escalas pois é algo muito dinâmico e gera lixo rápido demais.
app.get('/escalas/:data', async (req, res) => {
    const { data: lista, error } = await supabase.from('escalas').select('*, servos(nome, telefone)').eq('data', req.params.data);
    res.json(lista || []);
});

app.post('/escalar-multiplo', async (req, res) => {
    const { servo_ids, data, ministerio_nome, responsavel, senha } = req.body;
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });

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
    if (senha !== SENHA_COORDENADOR) return res.status(403).json({ erro: "Senha incorreta!" });
    await supabase.from('escalas').delete().eq('id', id);
    res.json({ message: "Excluído!" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));