const fetch = require('node-fetch');

const CONTAS = {
  beleza: {
    id: 'beleza',
    nome: 'Beleza',
    env: {
      access: ['BLING_BELEZA_ACCESS_TOKEN', 'BLING_ACCESS_TOKEN'],
      refresh: ['BLING_BELEZA_REFRESH_TOKEN', 'BLING_REFRESH_TOKEN'],
      clientId: ['BLING_BELEZA_CLIENT_ID', 'BLING_CLIENT_ID'],
      clientSecret: ['BLING_BELEZA_CLIENT_SECRET', 'BLING_CLIENT_SECRET']
    }
  },
  bb: {
    id: 'bb',
    nome: 'Calçados B&B',
    env: {
      access: ['BLING_BB_ACCESS_TOKEN'],
      refresh: ['BLING_BB_REFRESH_TOKEN'],
      clientId: ['BLING_BB_CLIENT_ID', 'BLING_CLIENT_ID'],
      clientSecret: ['BLING_BB_CLIENT_SECRET', 'BLING_CLIENT_SECRET']
    }
  }
};

const tokens = {};

function envFirst(keys) {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
  }
  return '';
}

function initConta(contaId) {
  const cfg = CONTAS[contaId];
  if (!cfg) throw new Error('Conta inválida');
  if (!tokens[contaId]) {
    tokens[contaId] = {
      access: envFirst(cfg.env.access),
      refresh: envFirst(cfg.env.refresh),
      clientId: envFirst(cfg.env.clientId),
      clientSecret: envFirst(cfg.env.clientSecret)
    };
  }
  return tokens[contaId];
}

function ncmLimpo(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function ncmValido(valor) {
  return ncmLimpo(valor).length === 8;
}

function inferirNcm(texto) {
  const t = String(texto || '').toLowerCase();
  if (/bolsa|carteira|mochila/.test(t)) return '42022100';
  if (/bota|coturno/.test(t)) return '64029190';
  if (/chinelo|havaiana|slide|slide/.test(t)) return '64022000';
  if (/sand[aá]lia|papete|rasteira|tamanco/.test(t)) return '64029990';
  if (/t[eê]nis|slip.?on/.test(t)) return '64029990';
  if (/sapato|scarpin|sapatilha|mocassim|mule|plataforma/.test(t)) return '64029990';
  return '';
}

async function refreshToken(contaId) {
  const t = initConta(contaId);
  if (!t.clientId || !t.clientSecret || !t.refresh) {
    throw new Error(`Tokens da conta ${CONTAS[contaId].nome} incompletos no .env`);
  }
  const credentials = Buffer.from(`${t.clientId}:${t.clientSecret}`).toString('base64');
  const res = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${credentials}`
    },
    body: `grant_type=refresh_token&refresh_token=${t.refresh}`
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Falha ao renovar token ${CONTAS[contaId].nome}: ${JSON.stringify(data)}`);
  }
  t.access = data.access_token;
  if (data.refresh_token) t.refresh = data.refresh_token;
  return t.access;
}

async function bling(contaId, url, options = {}) {
  const t = initConta(contaId);
  if (!t.access) await refreshToken(contaId);
  options.headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${t.access}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  let res = await fetch(url, options);
  if (res.status === 401) {
    await refreshToken(contaId);
    options.headers.Authorization = `Bearer ${tokens[contaId].access}`;
    res = await fetch(url, options);
  }
  return res;
}

async function listarPendentes(contaId) {
  const notas = [];
  let pagina = 1;
  while (pagina <= 20) {
    const res = await bling(
      contaId,
      `https://www.bling.com.br/Api/v3/nfe?pagina=${pagina}&limite=100&tipo=1&situacao=1`
    );
    const data = await res.json();
    const lista = data?.data || [];
    if (!res.ok) throw new Error(data?.error?.message || 'Erro ao listar NF-e');
    notas.push(...lista);
    if (lista.length < 100) break;
    pagina += 1;
  }
  return notas;
}

function ncmDoItem(item) {
  return ncmLimpo(
    item.classificacaoFiscal ||
    item.ncm ||
    item.codigoNcm ||
    item.tributacao?.ncm
  );
}

function ncmDoProduto(prod) {
  return ncmLimpo(
    prod?.tributacao?.ncm ||
    prod?.ncm ||
    prod?.classificacaoFiscal
  );
}

async function ncmDoCadastro(contaId, codigo) {
  if (!codigo) return '';
  const res = await bling(
    contaId,
    `https://www.bling.com.br/Api/v3/produtos?codigo=${encodeURIComponent(codigo)}`
  );
  const data = await res.json();
  const id = data?.data?.[0]?.id;
  if (!id) return ncmDoProduto(data?.data?.[0] || {});
  const det = await bling(contaId, `https://www.bling.com.br/Api/v3/produtos/${id}`);
  const detData = await det.json();
  return ncmDoProduto(detData?.data || {});
}

async function montarPendentesSemNcm(contaIds) {
  const ids = contaIds && contaIds.length ? contaIds : Object.keys(CONTAS);
  const resultado = [];

  for (const contaId of ids) {
    if (!CONTAS[contaId]) continue;
    const lista = await listarPendentes(contaId);
    for (const resumo of lista) {
      const detRes = await bling(contaId, `https://www.bling.com.br/Api/v3/nfe/${resumo.id}`);
      const det = await detRes.json();
      const nota = det?.data;
      if (!nota) continue;
      const itens = nota.itens || [];
      const faltando = [];
      for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        if (ncmValido(ncmDoItem(item))) continue;
        const codigo = item.codigo || item.produto?.codigo || '';
        let sugerido = await ncmDoCadastro(contaId, codigo);
        if (!ncmValido(sugerido)) {
          sugerido = inferirNcm(`${item.descricao || ''} ${codigo}`);
        }
        faltando.push({
          index: i,
          codigo,
          descricao: item.descricao || '',
          ncmAtual: ncmDoItem(item),
          ncmSugerido: sugerido
        });
      }
      if (!faltando.length) continue;
      resultado.push({
        contaId,
        contaNome: CONTAS[contaId].nome,
        notaId: nota.id || resumo.id,
        numero: nota.numero || resumo.numero,
        serie: nota.serie || resumo.serie,
        cliente: nota.contato?.nome || resumo.contato?.nome || '',
        dataEmissao: nota.dataEmissao || resumo.dataEmissao || '',
        itens: faltando
      });
    }
  }
  return resultado;
}

function formatNcm(valor) {
  const d = ncmLimpo(valor);
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

function dataOperacaoValida(nota) {
  const raw = String(nota.dataOperacao || '');
  if (raw && !raw.startsWith('0000')) return raw;
  const em = String(nota.dataEmissao || '');
  return em ? `${em.slice(0, 10)} 00:00:00` : '';
}

function payloadAtualizacao(nota, itensAlvo) {
  const itens = (nota.itens || []).map((item, idx) => {
    const alvo = itensAlvo.find(x => Number(x.index) === idx);
    const ncm = alvo && ncmValido(alvo.ncm)
      ? formatNcm(alvo.ncm)
      : (item.classificacaoFiscal || '');
    return {
      codigo: item.codigo || '',
      descricao: item.descricao || '',
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade || 1,
      valor: item.valor || 0,
      tipo: item.tipo || 'P',
      classificacaoFiscal: ncm,
      origem: item.origem == null ? 0 : item.origem,
      cfop: item.cfop || ''
    };
  });

  const contato = nota.contato || {};
  return {
    id: nota.id,
    tipo: nota.tipo || 1,
    numero: nota.numero,
    serie: nota.serie,
    dataOperacao: dataOperacaoValida(nota),
    contato: {
      id: contato.id,
      nome: contato.nome,
      numeroDocumento: contato.numeroDocumento
    },
    naturezaOperacao: { id: (nota.naturezaOperacao || {}).id },
    itens
  };
}

  
async function preencherNotas(contaId, notasPayload) {
  const saida = [];
  for (const alvo of notasPayload) {
    try {
      const detRes = await bling(contaId, `https://www.bling.com.br/Api/v3/nfe/${alvo.notaId}`);
      const det = await detRes.json();
      const nota = det?.data;
      if (!nota) {
        saida.push({ notaId: alvo.notaId, ok: false, erro: 'Nota não encontrada' });
        continue;
      }
      if (Number(nota.situacao) !== 1 && Number(nota.tipo) !== undefined && Number(nota.situacao) !== 1) {
        saida.push({ notaId: alvo.notaId, numero: nota.numero, ok: false, erro: 'Nota não está pendente' });
        continue;
      }
      if (nota.situacao && Number(nota.situacao) !== 1) {
        saida.push({ notaId: alvo.notaId, numero: nota.numero, ok: false, erro: 'Nota não está pendente' });
        continue;
      }

      const body = payloadAtualizacao(nota, alvo.itens || []);
      const putRes = await bling(
        contaId,
        `https://www.bling.com.br/Api/v3/nfe/${alvo.notaId}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
      const putData = await putRes.json();
      if (!putRes.ok) {
        saida.push({
          notaId: alvo.notaId,
          numero: nota.numero,
          ok: false,
          erro: putData?.error?.message || putData?.error?.description || 'Falha no PUT',
          detalhe: putData
        });
        continue;
      }

      const envRes = await bling(
        contaId,
        `https://www.bling.com.br/Api/v3/nfe/${alvo.notaId}/enviar?enviarEmail=false`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      const envData = await envRes.json();
      if (!envRes.ok) {
        saida.push({
          notaId: alvo.notaId,
          numero: nota.numero,
          ok: false,
          erro: 'NCM gravado, mas o envio falhou: ' +
            (envData?.error?.message || envData?.error?.description || String(envRes.status)),
          detalhe: envData
        });
        continue;
      }

      saida.push({
        notaId: alvo.notaId,
        numero: nota.numero,
        ok: true,
        enviado: true,
        itens: (alvo.itens || []).length
      });
    } catch (err) {
      saida.push({ notaId: alvo.notaId, ok: false, erro: err.message });
    }
  }
  return saida;
}

module.exports = {
  CONTAS,
  montarPendentesSemNcm,
  preencherNotas
};
