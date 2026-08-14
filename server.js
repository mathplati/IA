require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem'), false);
    }
  }
});

let accessToken = process.env.BLING_ACCESS_TOKEN;
let refreshToken = process.env.BLING_REFRESH_TOKEN;

async function refreshBlingToken() {
  const credentials = Buffer.from(
    `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${credentials}`
    },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`
  });

  const data = await res.json();
  if (data.access_token) {
    accessToken = data.access_token;
    refreshToken = data.refresh_token || refreshToken;
    console.log('Token Bling renovado');
    return true;
  }
  console.error('Erro ao renovar token:', data);
  return false;
}

async function blingRequest(url, options = {}) {
  options.headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  let res = await fetch(url, options);
  if (res.status === 401) {
    const ok = await refreshBlingToken();
    if (!ok) throw new Error('Não foi possível renovar o token do Bling');
    options.headers.Authorization = `Bearer ${accessToken}`;
    res = await fetch(url, options);
  }
  return res;
}

async function uploadImagem(buffer, filename) {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error('IMGBB_API_KEY não configurada no .env');

  const base64 = buffer.toString('base64');
  const form = new FormData();
  form.append('image', base64);
  form.append('name', filename || 'foto.jpg');

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });

  const data = await res.json();
  if (!data.success || !data.data?.url) {
    console.error('ImgBB erro:', data);
    throw new Error(data.error?.message || 'Falha no upload ImgBB');
  }

  const directUrl = data.data.image?.url || data.data.url;
  console.log('Upload ImgBB:', directUrl);
  return directUrl;
}

async function processarComPhotoroom(buffer, filename) {
  const apiKey = process.env.PHOTOROOM_API_KEY;
  if (!apiKey) throw new Error('PHOTOROOM_API_KEY não configurada no .env');

  const form = new FormData();
  form.append('imageFile', buffer, { filename: filename || 'foto.jpg' });
  form.append('removeBackground', 'true');
  form.append('background.color', 'FFFFFF');
  form.append('outputSize', '1300x1300');
  form.append('padding', '0.01');
  form.append('export.format', 'jpeg');

  const res = await fetch('https://image-api.photoroom.com/v2/edit', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      ...form.getHeaders()
    },
    body: form
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('PhotoRoom erro:', errText);
    throw new Error('Falha no PhotoRoom: ' + res.status + ' — ' + errText.slice(0, 200));
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

app.post('/processar-fotos', upload.array('fotos', 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhuma foto enviada' });
    }

    const urls = [];
    for (const file of req.files) {
      console.log('Processando:', file.originalname);
      const processado = await processarComPhotoroom(file.buffer, file.originalname);
      const url = await uploadImagem(
        processado,
        file.originalname.replace(/\.\w+$/, '') + '.jpg'
      );
      urls.push(url);
      console.log('OK:', url);
    }

    res.json({ success: true, urls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/upload-fotos', upload.array('fotos', 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhuma foto enviada' });
    }

    const urls = [];
    for (const file of req.files) {
      const url = await uploadImagem(file.buffer, file.originalname);
      urls.push(url);
    }

    res.json({ success: true, urls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/gerar', async (req, res) => {
  try {
    const { tituloBase } = req.body;
    if (!tituloBase) {
      return res.status(400).json({ error: 'Título base obrigatório' });
    }

    const prompt = `Você é especialista em anúncios de calçados para Mercado Livre e Shopee (Brasil).

PRODUTO INFORMADO:
"${tituloBase}"

PASSO OBRIGATÓRIO — PESQUISA REAL:
1. Pesquise na internet anúncios reais deste produto (Mercado Livre, Shopee, Dafiti, Amazon, site oficial da marca).
2. Use o código/modelo + marca para achar o produto certo.
3. Extraia APENAS características REAIS encontradas nos anúncios:
   - Tipo de calçado (tênis, bota, sandália, chinelo, slip-on, etc.)
   - Material do cabedal (só se aparecer de verdade)
   - Características fortes (cano alto, salto, plataforma, tratorado, zíper, elástico, etc.)
   - Público (feminino/masculino/infantil)
   - Diferenciais reais de conforto do modelo

REGRAS RÍGIDAS:
- NÃO invente material. Se não achar "EVA" nos anúncios, NÃO coloque EVA.
- NÃO repita a mesma palavra-chave nos 3 títulos.
- NÃO use cor no título.
- Máximo 60 caracteres por título (obrigatório entre 55 a 60 caracteres).
- Linguagem natural de anúncio ML/Shopee.

ESTRUTURA DOS 3 TÍTULOS (variar a ordem):
1. Tipo + Marca + Código + Característica principal
2. Tipo + Marca + Código + Outra característica
3. Tipo + Característica + Marca + Código

NO FINAL DE CADA DESCRIÇÃO, use EXATAMENTE estes blocos fixos (sem alterar nenhuma palavra):

Descrição 1 — finalize com:
Todos os produtos anunciados são originais enviados na sua caixa.
Adquiridos diretamente das fábricas e seus distribuidores.
Produto com garantia.

Dúvidas?
Entre em contato conosco fazendo uma pergunta abaixo.

Descrição 2 — finalize com:
Somos dedicados a fornecer produtos originais de alta qualidade, com estilo, conforto e durabilidade. 
Cada venda é cuidadosamente preparada para atender às necessidades dos nossos clientes, 
proporcionando uma experiência única de compra.
    
    Envio em até 24 horas

Descrição 3 — finalize com:
Somos especialistas em calçados femininos, masculinos e infantis, 
oferecendo o que há de melhor em qualidade, tendência e preço justo.
Aqui você encontra desde os clássicos até os lançamentos das marcas mais queridas do Brasil!

Responda APENAS JSON válido, sem markdown e sem texto fora:
{
  "titulos": ["titulo1", "titulo2", "titulo3"],
  "descricoes": ["descricao1 completa com bloco final 1", "descricao2 completa com bloco final 2", "descricao3 completa com bloco final 3"],
  "pesquisa": "resumo curto do que encontrou de verdade (materiais e características reais)"
}`;

    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4',
        input: [
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          { type: 'web_search' }
        ],
        temperature: 0.5
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('xAI erro:', data);
      throw new Error(data.error?.message || 'Erro na API xAI');
    }

    let content = '';
    if (typeof data.output_text === 'string') {
      content = data.output_text;
    } else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === 'output_text' || part.type === 'text') {
              content += part.text || '';
            }
          }
        }
      }
    } else if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Resposta bruta:', content);
      throw new Error('Resposta inválida da IA');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Garante os blocos finais EXATOS (caso a IA altere)
    const bloco1 = `Todos os produtos anunciados são originais enviados na sua caixa.
Adquiridos diretamente das fábricas e seus distribuidores.
Produto com garantia.

Dúvidas?
Entre em contato conosco fazendo uma pergunta abaixo.`;

    const bloco2 = `Somos dedicados a fornecer produtos originais de alta qualidade, com estilo, conforto e durabilidade. 
Cada venda é cuidadosamente preparada para atender às necessidades dos nossos clientes, 
proporcionando uma experiência única de compra.
    
    Envio em até 24 horas`;

    const bloco3 = `Somos especialistas em calçados femininos, masculinos e infantis, 
oferecendo o que há de melhor em qualidade, tendência e preço justo.
Aqui você encontra desde os clássicos até os lançamentos das marcas mais queridas do Brasil!`;

    if (Array.isArray(parsed.descricoes) && parsed.descricoes.length >= 3) {
      parsed.descricoes[0] = limparFinalDescricao(parsed.descricoes[0]) + '\n\n' + bloco1;
      parsed.descricoes[1] = limparFinalDescricao(parsed.descricoes[1]) + '\n\n' + bloco2;
      parsed.descricoes[2] = limparFinalDescricao(parsed.descricoes[2]) + '\n\n' + bloco3;
    }

    console.log('Pesquisa:', parsed.pesquisa || '(sem resumo)');
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function limparFinalDescricao(texto) {
  if (!texto) return '';
  // Remove finais antigos genéricos para não duplicar
  return String(texto)
    .replace(/Todos os produtos anunciados são originais[\s\S]*$/i, '')
    .replace(/Somos dedicados a fornecer produtos originais[\s\S]*$/i, '')
    .replace(/Somos especialistas em calçados femininos[\s\S]*$/i, '')
    .trim();
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});