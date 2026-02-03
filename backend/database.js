const { createClient } = require('@supabase/supabase-js');

// 1. AQUI ESTÁ A URL QUE EU PEGUEI DA SUA IMAGEM (NÃO MEXA)
const supabaseUrl = 'https://zxnycqwxbxzfzfjsvcqv.supabase.co';

// 2. AQUI VOCÊ COLA A CHAVE 'ANON' QUE COPIOU NO SITE
// Apague o texto abaixo e cole sua chave entre as aspas
const supabaseKey = 'sb_publishable_0KQtY8yxyJAyn-XEryTDzw_8N5OmHwQ';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;