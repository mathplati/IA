require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const categoriasRegras = require('./categorias-regras');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas arquivos de imagem'), false);
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
  return data.data.image?.url || data.data.url;
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
    headers: { 'x-api-key': apiKey, ...form.getHeaders() },
    body: form
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Falha no PhotoRoom: ' + res.status + ' — ' + errText.slice(0, 200));
  }
  return Buffer.from(await res.arrayBuffer());
}

function extrairCodigoTitulo(titulo) {
  if (!titulo) return '';
  const m = String(titulo).match(/(\d{2,5}[-.]?\d{0,5}[-.]?[A-Za-z0-9]{0,8})/);
  return m ? m[1] : '';
}

function extrairMarcaTitulo(titulo) {
  if (!titulo) return '';
  const marcas = [
    'Nike', 'Adidas', 'Via Marte', 'Beira Rio', 'Moleca', 'Havaianas', 'Rider',
    'Modare', 'Usaflex', 'Ferracini', 'Piccadilly', 'Vizzano', 'Molekinha',
    'Molekinho', 'Cartago', 'Grendene', 'Olympikus', 'Mizuno', 'Asics',
    'Puma', 'Fila', 'Dakota', 'Ramarim', 'Azaleia', 'Comfortflex', 'Bottero'
  ];
  const t = titulo.toLowerCase();
  for (const marca of marcas) {
    if (t.includes(marca.toLowerCase())) return marca;
  }
  return '';
}

function limparFinalDescricao(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/Todos os produtos anunciados são originais[\s\S]*$/i, '')
    .replace(/Somos dedicados a fornecer produtos originais[\s\S]*$/i, '')
    .replace(/Somos especialistas em calçados femininos[\s\S]*$/i, '')
    .trim();
}

app.post('/processar-fotos', upload.array('fotos', 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhuma foto enviada' });
    }
    const urls = [];
    for (const file of req.files) {
      const processado = await processarComPhotoroom(file.buffer, file.originalname);
      const url = await uploadImagem(
        processado,
        file.originalname.replace(/\.\w+$/, '') + '.jpg'
      );
      urls.push(url);
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
      urls.push(await uploadImagem(file.buffer, file.originalname));
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
    if (!tituloBase) return res.status(400).json({ error: 'Título base obrigatório' });

    const prompt = `Você é especialista em anúncios de calçados para Mercado Livre e Shopee (Brasil).
PRODUTO INFORMADO:
"${tituloBase}"

PASSO OBRIGATÓRIO — PESQUISA REAL:
1. Pesquise na internet anúncios reais deste produto (Mercado Livre, Shopee, Dafiti, Amazon, site oficial da marca).
2. Use o código/modelo + marca para achar o produto certo.
3. Extraia APENAS características REAIS encontradas nos anúncios.

REGRAS RÍGIDAS:
- NÃO invente material. Se não achar nos anúncios, NÃO coloque.
- NÃO use cor no título.
- Máximo 60 caracteres por título (55 a 60).
- Linguagem natural de anúncio ML/Shopee.

ESTRUTURA DOS 3 TÍTULOS:
1. Tipo + Marca + Código + Característica principal
2. Tipo + Marca + Código + Outra característica
3. Tipo + Característica + Marca + Código

Responda APENAS JSON válido:
{
  "titulos": ["titulo1", "titulo2", "titulo3"],
  "descricoes": ["descricao1", "descricao2", "descricao3"],
  "pesquisa": "resumo curto do que encontrou"
}`;

    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4',
        input: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search' }],
        temperature: 0.5
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro na API xAI');

    let content = '';
    if (typeof data.output_text === 'string') content = data.output_text;
    else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === 'output_text' || part.type === 'text') content += part.text || '';
          }
        }
      }
    } else if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta inválida da IA');
    const parsed = JSON.parse(jsonMatch[0]);

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

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/preencher-campos', async (req, res) => {
  try {
    const { categoria, tituloBase, cores = [], generoHint = '' } = req.body;
    if (!categoria) return res.status(400).json({ error: 'Categoria obrigatória' });

    const regraCat = categoriasRegras.categorias[categoria];
    if (!regraCat) {
      return res.json({ campos: [], aviso: 'Categoria sem regras mapeadas. Preencha manualmente no Bling.' });
    }
    if (regraCat.preencher === 'nunca') {
      return res.json({ campos: [], aviso: 'Esta categoria não preenche campos customizados.' });
    }

    const codigo = extrairCodigoTitulo(tituloBase);
    const marca = extrairMarcaTitulo(tituloBase);
    const coresStr = (cores || []).map(c => c.nome || c).filter(Boolean).join(', ');

    const camposRegra = Object.entries(regraCat)
      .filter(([k]) => k !== 'preencher')
      .map(([nome, regra]) => ({ nome, regra }));

    const prompt = `Você preenche campos customizados de produto no Bling (calçados BR).

PRODUTO:
Título: ${tituloBase || ''}
Código extraído: ${codigo || '(não achou)'}
Marca extraída: ${marca || '(não achou)'}
Cores do anúncio: ${coresStr || '(não informado)'}
Gênero hint: ${generoHint || ''}
Categoria Bling: ${categoria}

CAMPOS E REGRAS (obrigatório respeitar):
${camposRegra.map(c => `- "${c.nome}": ${c.regra}`).join('\n')}

SIGNIFICADO DAS REGRAS:
- codigo_titulo → use o código do produto
- ia_titulo / ia → tente preencher com base no título e pesquisa real
- ia_pesquisa → pesquise o modelo na internet e use material/característica real
- ia_se_certeza → só preencha se tiver certeza; senão vazio
- cores_anuncio → use a cor principal das cores informadas
- nunca / vazio → deixe string vazia ""
- Brasil / Masculino / Feminino / Casual / Não / com embalagem adicional → valor fixo exato

REGRAS GERAIS:
- Nunca invente material
- Se não souber, valor ""
- País de origem quando for preencher: Brasil
- Produto personalizado quando existir: Não

Responda APENAS JSON:
{
  "campos": [
    { "nome": "nome exato do campo", "valor": "valor ou vazio" }
  ],
  "pesquisa": "resumo curto do que usou"
}`;

    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4',
        input: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search' }],
        temperature: 0.2
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro xAI campos');

    let content = '';
    if (typeof data.output_text === 'string') content = data.output_text;
    else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === 'output_text' || part.type === 'text') content += part.text || '';
          }
        }
      }
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('IA não retornou JSON de campos');
    const parsed = JSON.parse(jsonMatch[0]);

    const finais = [];
    for (const { nome, regra } of camposRegra) {
      let valor = '';
      const encontrado = (parsed.campos || []).find(c => c.nome === nome);
      if (regra === 'nunca' || regra === 'vazio') valor = '';
      else if (regra === 'codigo_titulo') valor = codigo;
      else if (regra === 'Brasil') valor = 'Brasil';
      else if (regra === 'Masculino') valor = 'Masculino';
      else if (regra === 'Feminino') valor = 'Feminino';
      else if (regra === 'Casual') valor = 'Casual';
      else if (regra === 'Não') valor = 'Não';
      else if (regra === 'com embalagem adicional') valor = 'com embalagem adicional';
      else if (regra === 'cores_anuncio') valor = coresStr.split(',')[0]?.trim() || (encontrado?.valor || '');
      else if (regra === 'ia_titulo') valor = encontrado?.valor || marca || '';
      else valor = encontrado?.valor || '';

      if (String(regra).includes('tamanho') || /tamanho/i.test(nome)) {
        if (categoriasRegras.regras_gerais.tamanho === 'nunca') valor = '';
      }
      if (/shopee/i.test(nome) && /marca/i.test(nome) && categoriasRegras.regras_gerais.marca_shopee === 'nunca') {
        valor = '';
      }

      finais.push({ nome, valor: valor == null ? '' : String(valor), regra });
    }

    res.json({ campos: finais, pesquisa: parsed.pesquisa || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/teste-campos', async (req, res) => {
  try {
    let token = accessToken || process.env.BLING_ACCESS_TOKEN;
    const url = 'https://www.bling.com.br/Api/v3/campos-customizados/modulos/98309';
    let r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    if (r.status === 401) {
      const ok = await refreshBlingToken();
      if (!ok) return res.status(401).json({ error: 'Token expirado e refresh falhou' });
      token = accessToken;
      r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });
    }
    res.json({ status: r.status, data: await r.json() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/enviar-campos-bling', async (req, res) => {
  try {
    const { codigoPai, campos = [] } = req.body;
    if (!codigoPai) return res.status(400).json({ error: 'codigoPai obrigatório' });
    if (!campos.length) return res.status(400).json({ error: 'Nenhum campo para enviar' });

    function normalizar(s) {
      return String(s || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    }

    const busca = await blingRequest(
      `https://www.bling.com.br/Api/v3/produtos?codigo=${encodeURIComponent(codigoPai)}`
    );
    const buscaData = await busca.json();
    const produto = buscaData?.data?.[0];
    if (!produto?.id) {
      return res.status(404).json({
        error: 'Produto não encontrado no Bling com esse SKU. Importe a planilha primeiro.'
      });
    }

    const listaCamposRes = await blingRequest(
      'https://www.bling.com.br/Api/v3/campos-customizados/modulos/98309'
    );
    const listaCampos = await listaCamposRes.json();
    const camposBling = listaCampos?.data || [];

    const mapa = {};
    for (const c of camposBling) {
      mapa[normalizar(c.nome)] = { id: c.id, nome: c.nome };
    }

    const camposPayload = [];
    const naoEncontrados = [];
    const enviadosDebug = [];

    for (const item of campos) {
      const nome = String(item.nome || '').trim();
      const valor = String(item.valor || '').trim();
      if (!nome || !valor) continue;

      const key = normalizar(nome);
      let match = mapa[key];

      if (!match) {
        const key2 = Object.keys(mapa).find(k => k.includes(key) || key.includes(k));
        if (key2) match = mapa[key2];
      }

      if (!match) {
        naoEncontrados.push(nome);
        continue;
      }

      let idValor = null;
      try {
        const detRes = await blingRequest(
          `https://www.bling.com.br/Api/v3/campos-customizados/${match.id}`
        );
        const det = await detRes.json();
        const opcoes = det?.data?.opcoes || [];
        if (opcoes.length) {
          const valorN = normalizar(valor);
          const op = opcoes.find(o => normalizar(o.nome) === valorN)
            || opcoes.find(o => normalizar(o.nome).includes(valorN) || valorN.includes(normalizar(o.nome)));
          if (op && op.id) idValor = op.id;
        }
      } catch (e) {
        console.log('Sem opções para', match.nome);
      }

      if (idValor) {
        camposPayload.push({
          idCampoCustomizado: match.id,
          idValorCampoCustomizado: idValor
        });
        enviadosDebug.push({ nome: match.nome, valor, tipo: 'lista', idValor });
      } else {
        camposPayload.push({
          idCampoCustomizado: match.id,
          valor: valor
        });
        enviadosDebug.push({ nome: match.nome, valor, tipo: 'texto' });
      }
    }

    if (!camposPayload.length) {
      return res.status(400).json({
        error: 'Nenhum campo válido para enviar',
        naoEncontrados,
        dica: 'Os nomes do site não bateram com os nomes no Bling.'
      });
    }

    const putRes = await blingRequest(
      `https://www.bling.com.br/Api/v3/produtos/${produto.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ camposCustomizados: camposPayload })
      }
    );
    const putData = await putRes.json();

    if (!putRes.ok) {
      console.error('Erro PUT produto:', putData);
      return res.status(putRes.status).json({
        error: putData?.error?.message || 'Falha ao atualizar produto no Bling',
        detalhe: putData,
        enviadosDebug
      });
    }

    res.json({
      success: true,
      produtoId: produto.id,
      enviados: camposPayload.length,
      naoEncontrados,
      enviadosDebug
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
