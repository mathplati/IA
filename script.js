let cores = [];
let titulosGerados = [];
let descricoesGeradas = [];
let tituloSelecionado = '';
let descricaoSelecionada = '';
let estoques = {};
let camposCustomizados = [];

const grades = {
  mulher: [33, 34, 35, 36, 37, 38, 39, 40],
  homem: [37, 38, 39, 40, 41, 42, 43, 44, 45],
  adolescente: [26, 27, 28, 29, 30, 31, 32, 33],
  infantil: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  'havaianas-infantil': ['17/18', '19/20', '21/22', '23/24', '25/26']
};

const departamentos = {
  mulher: 'Feminino',
  homem: 'Masculino',
  adolescente: 'Infantil',
  infantil: 'Infantil',
  'havaianas-infantil': 'Infantil',
  custom: 'Feminino'
};

const passos = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];

document.getElementById('tipoTamanho').addEventListener('change', () => {
  const tipo = document.getElementById('tipoTamanho').value;
  document.getElementById('tamanhosCustomWrap').style.display =
    tipo === 'custom' ? 'block' : 'none';
  renderEstoques();
});

document.getElementById('tamanhosCustom')?.addEventListener('input', renderEstoques);

function abrirModalDimensoes() {
  document.getElementById('modalDimensoes').style.display = 'flex';
  validarDimensoes();
}

function fecharModalDimensoes() {
  document.getElementById('modalDimensoes').style.display = 'none';
  validarDimensoes();
}

function dimensoesCompletas() {
  const campos = ['pesoLiquido', 'pesoBruto', 'largura', 'altura', 'profundidade'];
  return campos.every(id => {
    const v = document.getElementById(id).value;
    return v !== '' && !isNaN(Number(v)) && Number(v) >= 0;
  });
}

function validarDimensoes() {
  const btn = document.getElementById('btnDimensoes');
  if (!btn) return;
  if (dimensoesCompletas()) {
    btn.classList.remove('incompleto');
    btn.classList.add('completo');
    btn.textContent = '✓ Peso e dimensões OK';
  } else {
    btn.classList.remove('completo');
    btn.classList.add('incompleto');
    btn.textContent = 'Ver peso e dimensões';
  }
}

function getDimensoes() {
  return {
    pesoLiquido: document.getElementById('pesoLiquido').value || '0',
    pesoBruto: document.getElementById('pesoBruto').value || '0',
    largura: document.getElementById('largura').value || '0',
    altura: document.getElementById('altura').value || '0',
    profundidade: document.getElementById('profundidade').value || '0'
  };
}

function getTamanhosBase() {
  const tipo = document.getElementById('tipoTamanho').value;
  if (tipo === 'custom') {
    return document.getElementById('tamanhosCustom').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  }
  return (grades[tipo] || []).map(String);
}

function getTamanhos() {
  return getTamanhosBase().map(t => {
    if (String(t).includes('/')) return String(t);
    if (String(t).toUpperCase().includes('BR')) return String(t);
    return `${t} BR`;
  });
}

function renderEstoques() {
  const container = document.getElementById('listaEstoques');
  if (!container) return;
  const tamanhos = getTamanhos();
  const coresValidas = cores.filter(c => c.nome.trim());
  if (!tamanhos.length) {
    container.innerHTML = '<p style="color:var(--muted)">Escolha a grade de tamanho.</p>';
    return;
  }
  if (!coresValidas.length) {
    container.innerHTML = '<p style="color:var(--muted)">Adicione pelo menos uma cor para definir estoque.</p>';
    return;
  }
  coresValidas.forEach(cor => {
    if (!estoques[cor.nome]) estoques[cor.nome] = {};
    tamanhos.forEach(tam => {
      if (estoques[cor.nome][tam] === undefined) estoques[cor.nome][tam] = 0;
    });
  });
  let html = `
    <table class="estoque-table">
      <thead>
        <tr>
          <th>Tamanho</th>
          ${coresValidas.map(c => `<th>${c.nome}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;
  tamanhos.forEach(tam => {
    html += `<tr><td><strong>${tam}</strong></td>`;
    coresValidas.forEach(cor => {
      const val = estoques[cor.nome][tam] ?? 0;
      html += `
        <td>
          <input type="number" min="0" max="100" value="${val}"
            onchange="setEstoque('${cor.nome.replace(/'/g, "\\'")}', '${tam}', this.value)" />
        </td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

function setEstoque(corNome, tam, valor) {
  if (!estoques[corNome]) estoques[corNome] = {};
  estoques[corNome][tam] = Math.max(0, Math.min(100, Number(valor) || 0));
}

function adicionarCor(nome = '', sku = '') {
  const id = Date.now() + Math.random();
  cores.push({ id, nome, sku, arquivos: [] });
  renderCores();
  renderFotosPorCor();
  renderEstoques();
}

function removerCor(id) {
  cores = cores.filter(c => c.id !== id);
  renderCores();
  renderFotosPorCor();
  renderEstoques();
}

function renderCores() {
  const container = document.getElementById('listaCores');
  if (!container) return;
  container.innerHTML = '';
  cores.forEach((cor, index) => {
    const div = document.createElement('div');
    div.className = 'cor-item';
    div.innerHTML = `
      <div class="field" style="margin:0">
        <label>Cor ${index === 0 ? '(principal / pai)' : ''}</label>
        <input type="text" value="${cor.nome}" placeholder="Ex: Preto"
          onchange="atualizarNomeCor(${index}, this.value)" />
      </div>
      <div class="field" style="margin:0">
        <label>SKU da cor (sufixo)</label>
        <input type="text" value="${cor.sku}" placeholder="Ex: i9 ou E1T"
          onchange="cores[${index}].sku = this.value" />
      </div>
      <button type="button" onclick="removerCor(${cor.id})">Remover</button>
    `;
    container.appendChild(div);
  });
}

function atualizarNomeCor(index, novoNome) {
  const antigo = cores[index].nome;
  cores[index].nome = novoNome;
  if (antigo && estoques[antigo] && novoNome && antigo !== novoNome) {
    estoques[novoNome] = estoques[antigo];
    delete estoques[antigo];
  }
  renderFotosPorCor();
  renderEstoques();
}

function renderFotosPorCor() {
  const container = document.getElementById('fotosPorCor');
  if (!container) return;
  container.innerHTML = '';
  if (cores.length === 0) {
    container.innerHTML = '<p style="color:var(--muted)">Adicione uma cor primeiro.</p>';
    return;
  }
  cores.forEach((cor, index) => {
    const bloco = document.createElement('div');
    bloco.style.marginBottom = '24px';
    bloco.innerHTML = `
      <h3 style="font-size:1rem;margin-bottom:10px;color:var(--text)">
        Fotos — ${cor.nome || 'Cor ' + (index + 1)}
        ${index === 0 ? '<span style="color:var(--bling-green);font-size:0.8rem"> (produto pai)</span>' : ''}
      </h3>
      <div class="dropzone" id="dropzone-${index}">
        <div class="dropzone-icon">📷</div>
        <p>Arraste fotos de <strong>${cor.nome || 'esta cor'}</strong> ou clique</p>
        <small>Qualquer formato • vira JPEG 1300x1300 com margem 1%</small>
        <input type="file" accept="image/*" multiple hidden />
      </div>
      <div class="fotos-preview" id="preview-${index}"></div>
    `;
    container.appendChild(bloco);
    const dropzone = document.getElementById(`dropzone-${index}`);
    const input = dropzone.querySelector('input[type=file]');
    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      adicionarArquivosCor(index, e.dataTransfer.files);
    });
    input.addEventListener('change', (e) => {
      adicionarArquivosCor(index, e.target.files);
      e.target.value = '';
    });
    renderPreviewCor(index);
  });
}

function adicionarArquivosCor(corIndex, fileList) {
  const novos = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  for (const file of novos) {
    if (cores[corIndex].arquivos.length >= 4) break;
    if (file.size > 25 * 1024 * 1024) {
      mostrarStatus(`Arquivo ${file.name} muito grande (máx 25MB).`, 'erro');
      continue;
    }
    cores[corIndex].arquivos.push(file);
  }
  renderPreviewCor(corIndex);
}

function removerFotoCor(corIndex, fotoIndex) {
  cores[corIndex].arquivos.splice(fotoIndex, 1);
  renderPreviewCor(corIndex);
}

function renderPreviewCor(corIndex) {
  const container = document.getElementById(`preview-${corIndex}`);
  if (!container) return;
  container.innerHTML = '';
  cores[corIndex].arquivos.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const div = document.createElement('div');
    div.className = 'foto-card';
    div.innerHTML = `
      <img src="${url}" alt="Foto ${i + 1}" />
      <span class="badge">${i + 1}</span>
      <button class="remove-btn" onclick="removerFotoCor(${corIndex}, ${i})" title="Remover">×</button>
    `;
    container.appendChild(div);
  });
}

function mostrarStatus(msg, tipo = 'carregando', alvo = 'status') {
  const el = document.getElementById(alvo);
  if (!el) return;
  el.className = `status ${tipo}`;
  el.innerHTML = msg;
}

function nomeArquivoSeguro(nome) {
  return String(nome)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'produto_bling';
}

async function gerarConteudo() {
  const tituloBase = document.getElementById('tituloBase').value.trim();
  if (!tituloBase) {
    mostrarStatus('Preencha o título base primeiro.', 'erro', 'statusIA');
    return;
  }
  mostrarStatus('Gerando títulos e descrições com Grok...', 'carregando', 'statusIA');
  try {
    const res = await fetch('/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tituloBase })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    titulosGerados = data.titulos || [];
    descricoesGeradas = data.descricoes || [];
    document.getElementById('resultadoIA').style.display = 'block';
    const titulosDiv = document.getElementById('opcoesTitulos');
    titulosDiv.innerHTML = '';
    titulosGerados.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'opcao';
      div.innerHTML = `<strong>${t}</strong><small>${t.length} caracteres</small>`;
      div.onclick = () => {
        document.querySelectorAll('#opcoesTitulos .opcao').forEach(el => el.classList.remove('selecionada'));
        div.classList.add('selecionada');
        tituloSelecionado = t;
      };
      if (i === 0) {
        div.classList.add('selecionada');
        tituloSelecionado = t;
      }
      titulosDiv.appendChild(div);
    });
    const descDiv = document.getElementById('opcoesDescricoes');
    descDiv.innerHTML = '';
    descricoesGeradas.forEach((d, i) => {
      const div = document.createElement('div');
      div.className = 'opcao';
      div.innerHTML = d.replace(/\n/g, '<br>');
      div.onclick = () => {
        document.querySelectorAll('#opcoesDescricoes .opcao').forEach(el => el.classList.remove('selecionada'));
        div.classList.add('selecionada');
        descricaoSelecionada = d;
      };
      if (i === 0) {
        div.classList.add('selecionada');
        descricaoSelecionada = d;
      }
      descDiv.appendChild(div);
    });
    mostrarStatus('Conteúdo gerado! Escolha título e descrição.', 'sucesso', 'statusIA');
  } catch (err) {
    mostrarStatus('Erro ao gerar: ' + err.message, 'erro', 'statusIA');
  }
}

async function preencherCamposCustomizados() {
  const categoria = document.getElementById('categoria').value;
  const tituloBase = document.getElementById('tituloBase').value.trim();
  const tipoGrade = document.getElementById('tipoTamanho').value;
  const generoHint = departamentos[tipoGrade] || '';
  if (!categoria) {
    mostrarStatus('Escolha a categoria primeiro.', 'erro', 'statusCampos');
    return;
  }
  mostrarStatus('Preenchendo campos customizados com Grok...', 'carregando', 'statusCampos');
  try {
    const res = await fetch('/preencher-campos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria,
        tituloBase,
        cores: cores.map(c => ({ nome: c.nome })),
        generoHint
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    camposCustomizados = data.campos || [];
    renderCamposCustomizados();
    if (data.aviso) {
      mostrarStatus(data.aviso, 'sucesso', 'statusCampos');
    } else {
      mostrarStatus(
        `Campos preenchidos (${camposCustomizados.filter(c => c.valor).length} com valor). Revise e ajuste se quiser.`,
        'sucesso',
        'statusCampos'
      );
    }
  } catch (err) {
    mostrarStatus('Erro campos: ' + err.message, 'erro', 'statusCampos');
  }
}

function renderCamposCustomizados() {
  const box = document.getElementById('camposCustomBox');
  const lista = document.getElementById('listaCamposCustom');
  if (!box || !lista) return;
  if (!camposCustomizados.length) {
    box.style.display = 'none';
    lista.innerHTML = '';
    return;
  }
  box.style.display = 'block';
  lista.innerHTML = camposCustomizados.map((c, i) => `
    <div class="field">
      <label>${c.nome}</label>
      <input type="text" value="${(c.valor || '').replace(/"/g, '&quot;')}"
        onchange="camposCustomizados[${i}].valor = this.value" />
    </div>
  `).join('');
}

function getCamposCustomTexto() {
  return camposCustomizados
    .filter(c => c.valor && String(c.valor).trim())
    .map(c => `${c.nome}: ${c.valor}`)
    .join(' | ');
}

async function enviarCamposBling() {
  const codigoPai = document.getElementById('codigoPai').value.trim();
  if (!codigoPai) {
    mostrarStatus('Preencha o SKU base (código pai).', 'erro', 'statusCampos');
    return;
  }
  const preenchidos = camposCustomizados.filter(c => c.valor && String(c.valor).trim());
  if (!preenchidos.length) {
    mostrarStatus('Nenhum campo com valor para enviar.', 'erro', 'statusCampos');
    return;
  }
  mostrarStatus('Enviando campos customizados para o Bling...', 'carregando', 'statusCampos');
  try {
    const res = await fetch('/enviar-campos-bling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoPai, campos: preenchidos })
    });
    const data = await res.json();
    if (data.error) {
      let extra = '';
      if (data.naoEncontrados?.length) {
        extra = '<br>Não encontrados: ' + data.naoEncontrados.join(', ');
      }
      throw new Error(data.error + extra);
    }
    let msg = `✅ ${data.enviados} campo(s) enviados pro produto ID ${data.produtoId}`;
    if (data.naoEncontrados?.length) {
      msg += `<br>Não achou no Bling: ${data.naoEncontrados.join(', ')}`;
    }
    mostrarStatus(msg, 'sucesso', 'statusCampos');
  } catch (err) {
    mostrarStatus('Erro ao enviar: ' + err.message, 'erro', 'statusCampos');
  }
}

async function uploadFotosCor(arquivos) {
  if (!arquivos || arquivos.length === 0) return [];
  const formData = new FormData();
  arquivos.forEach(file => formData.append('fotos', file));
  const res = await fetch('/processar-fotos', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.urls || [];
}

async function gerarExcel() {
  const nome = tituloSelecionado || document.getElementById('tituloBase').value.trim();
  const codigoPai = document.getElementById('codigoPai').value.trim();
  const preco = document.getElementById('preco').value;
  const precoFmt = String(preco).replace('.', ',');
  const descricao = descricaoSelecionada || '';
  const categoria = document.getElementById('categoria').value || '';
  const ncm = document.getElementById('ncm').value || '6402.99.90';
  const tipoGrade = document.getElementById('tipoTamanho').value;
  const departamento = departamentos[tipoGrade] || 'Feminino';
  const dim = getDimensoes();
  const tamanhos = getTamanhos();
  const coresValidas = cores.filter(c => c.nome.trim());
  const infoAdicional = getCamposCustomTexto();

  if (!nome || !codigoPai || !preco || !coresValidas.length || !tamanhos.length) {
    mostrarStatus('Preencha os dados antes de gerar o Excel.', 'erro');
    return;
  }
  try {
    mostrarStatus('Processando fotos (PhotoRoom) e gerando planilha...', 'carregando');
    const coresComUrls = [];
    for (const cor of coresValidas) {
      const fotosUrls = await uploadFotosCor(cor.arquivos);
      coresComUrls.push({
        nome: cor.nome,
        sku: (cor.sku || '').trim(),
        fotosUrls
      });
    }

    const headers = [
      'ID', 'Código', 'Descrição', 'Unidade', 'NCM', 'Origem', 'Preço', 'Valor IPI fixo',
      'Observações', 'Situação', 'Estoque', 'Preço de custo', 'Cód no fornecedor',
      'Fornecedor', 'Localização', 'Estoque maximo', 'Estoque minimo', 'Peso líquido (Kg)',
      'Peso bruto (Kg)', 'GTIN/EAN', 'GTIN/EAN da embalagem', 'Largura do Produto',
      'Altura do Produto', 'Profundidade do produto', 'Data Validade',
      'Descrição do Produto no Fornecedor', 'Descrição Complementar', 'Itens p/ caixa',
      'Produto Variação', 'Tipo Produção', 'Classe de enquadramento do IPI',
      'Código da lista de serviços', 'Tipo do item', 'Grupo de Tags/Tags', 'Tributos',
      'Código Pai', 'Código Integração', 'Grupo de produtos', 'Marca', 'CEST', 'Volumes',
      'Descrição Curta', 'Cross-Docking', 'URL Imagens Externas', 'Link Externo',
      'Meses Garantia no Fornecedor', 'Clonar dados do pai', 'Condição do produto',
      'Frete Grátis', 'Número FCI', 'Vídeo', 'Departamento', 'Unidade de medida',
      'Preço de compra', 'Valor base ICMS ST para retenção', 'Valor ICMS ST para retenção',
      'Valor ICMS próprio do substituto', 'Categoria do produto', 'Informações Adicionais'
    ];

    const rows = [];
    const fotosPai = (coresComUrls[0]?.fotosUrls || []).join('|');

    rows.push([
      '', codigoPai, nome, 'UN', ncm, '0', precoFmt, '0',
      '', 'Ativo', '0', '0', '',
      '', '', '0', '0', String(dim.pesoLiquido).replace('.', ','),
      String(dim.pesoBruto).replace('.', ','), '', '', String(dim.largura).replace('.', ','),
      String(dim.altura).replace('.', ','), String(dim.profundidade).replace('.', ','), '',
      '', '', '2',
      'Produto', 'Terceiros', '',
      '', 'Mercadoria para Revenda', '', '0',
      '', '0', '', '', '28.059.00', '1',
      descricao, '0', fotosPai, '',
      '0', 'Não', 'NOVO',
      'NÃO', '', '', departamento, 'Centímetro',
      '0', '0', '0',
      '0', categoria, infoAdicional
    ]);

    coresComUrls.forEach(cor => {
      const fotosCor = (cor.fotosUrls || []).join('|');
      tamanhos.forEach(tam => {
        const tamNumero = String(tam).replace(/\s*BR\s*/i, '').trim();
        const codigoVar = cor.sku
          ? `${tamNumero}-${codigoPai}-${cor.sku}`
          : `${tamNumero}-${codigoPai}`;
        const nomeVar = `Tamanho:${tam};Cor:${cor.nome}`;
        const estoque = (estoques[cor.nome] && estoques[cor.nome][tam] !== undefined)
          ? estoques[cor.nome][tam]
          : 0;

        rows.push([
          '', codigoVar, nomeVar, 'UN', ncm, '0', precoFmt, '0',
          '', 'Ativo', String(estoque), '0', '',
          '', '', '0', '0', String(dim.pesoLiquido).replace('.', ','),
          String(dim.pesoBruto).replace('.', ','), '', '', String(dim.largura).replace('.', ','),
          String(dim.altura).replace('.', ','), String(dim.profundidade).replace('.', ','), '',
          '', '', '2',
          'Variação', 'Terceiros', '',
          '', 'Mercadoria para Revenda', '', '0',
          codigoPai, '0', '', '', '28.059.00', '1',
          descricao, '0', fotosCor, '',
          '0', 'Sim', 'NOVO',
          'NÃO', '', '', departamento, 'Centímetro',
          '0', '0', '0',
          '0', categoria, infoAdicional
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const nomeArquivo = nomeArquivoSeguro(nome) + '.xlsx';
    XLSX.writeFile(wb, nomeArquivo);

    mostrarStatus(
      `✅ Planilha gerada: <strong>${nomeArquivo}</strong><br>
       Variações: <strong>${rows.length - 1}</strong><br>
       Campos custom: <strong>${camposCustomizados.filter(c => c.valor).length}</strong> preenchidos`,
      'sucesso'
    );
  } catch (err) {
    mostrarStatus('Erro: ' + err.message, 'erro');
  }
}

/* ===== WIZARD ===== */
function abrirPasso(id) {
  passos.forEach(pid => {
    const el = document.getElementById(pid);
    if (!el) return;
    el.classList.toggle('open', pid === id);
  });
  const alvo = document.getElementById(id);
  if (alvo) {
    setTimeout(() => {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }
}

function limparErros() {
  document.querySelectorAll('.field.erro').forEach(el => el.classList.remove('erro'));
  document.querySelectorAll('.dica-erro').forEach(el => el.remove());
  const aviso = document.getElementById('avisoValidacao');
  if (aviso) aviso.remove();
}

function marcarErro(inputId, msg) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const field = input.closest('.field');
  if (!field) return;
  field.classList.add('erro');
  const dica = document.createElement('small');
  dica.className = 'dica-erro';
  dica.textContent = msg;
  field.appendChild(dica);
}

function validarPasso(stepId) {
  limparErros();
  const faltando = [];

  if (stepId === 'step1') {
    if (!document.getElementById('tituloBase').value.trim()) {
      faltando.push('Título base');
      marcarErro('tituloBase', 'Ex: Tênis Air Jordan 1 Low');
    }
    if (!document.getElementById('codigoPai').value.trim()) {
      faltando.push('SKU base');
      marcarErro('codigoPai', 'Ex: 06036-048');
    }
    const preco = document.getElementById('preco').value;
    if (!preco || Number(preco) <= 0) {
      faltando.push('Preço');
      marcarErro('preco', 'Informe um preço válido');
    }
    if (!getTamanhos().length) {
      faltando.push('Grade de tamanho');
      marcarErro('tipoTamanho', 'Escolha a grade');
    }
  }

  if (stepId === 'step2') {
    if (!cores.some(c => c.nome && c.nome.trim())) {
      faltando.push('Pelo menos uma cor com nome');
    }
  }

  return faltando;
}

function mostrarAvisoPasso(stepId, faltando, onContinuar) {
  const body = document.querySelector(`#${stepId} .card-body`);
  if (!body) return;
  let box = document.getElementById('avisoValidacao');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'avisoValidacao';
  box.className = 'aviso-validacao';
  box.innerHTML = `
    <strong>Faltam informações</strong>
    <ul>${faltando.map(f => `<li>${f}</li>`).join('')}</ul>
    <div class="btn-row">
      <button type="button" class="btn secondary" id="btnCorrigir">Corrigir</button>
      <button type="button" class="btn primary" id="btnSeguirMesmo">Continuar mesmo assim</button>
    </div>
  `;
  body.appendChild(box);
  document.getElementById('btnCorrigir').onclick = () => box.remove();
  document.getElementById('btnSeguirMesmo').onclick = () => {
    box.remove();
    onContinuar();
  };
}

function continuarPasso(stepAtual) {
  const idx = passos.indexOf(stepAtual);
  const faltando = validarPasso(stepAtual);
  if (faltando.length) {
    mostrarAvisoPasso(stepAtual, faltando, () => {
      if (idx < passos.length - 1) abrirPasso(passos[idx + 1]);
    });
    return;
  }
  if (idx < passos.length - 1) abrirPasso(passos[idx + 1]);
}

function toggleCard(id) {
  abrirPasso(id);
}

function toggleCard(id) {
  abrirPasso(id);
}

function precoConta(base, extra) {
  const n = Number(String(base).replace(',', '.')) || 0;
  return (n + extra).toFixed(2).replace('.', ',');
}

function exportarBling() {
  const sku = (document.getElementById('skuExport').value || document.getElementById('codigoPai').value || '').trim();
  const preco = document.getElementById('preco').value;
  const tituloBase = document.getElementById('tituloBase').value.trim();

  if (!sku) {
    mostrarStatus('Preencha o SKU pai no passo 6 (ou no passo 1).', 'erro', 'statusExport');
    return;
  }

  const t1 = (titulosGerados[0] || tituloSelecionado || tituloBase || '');
  const t2 = (titulosGerados[1] || t1);
  const t3 = (titulosGerados[2] || t1);
  const d1 = (descricoesGeradas[0] || descricaoSelecionada || '');
  const d2 = (descricoesGeradas[1] || d1);
  const d3 = (descricoesGeradas[2] || d1);

  const payload = {
    skuPai: sku,
    contas: [
      { nome: 'Anelo', ml: 'Aneloshoes Mercadolivre', shopee: 'Aneloshoes Shopee', titulo: t1, descricao: d1, preco: precoConta(preco, 0) },
      { nome: 'B&B', ml: 'B&B Mercadolivre', shopee: 'B&B Shopee', titulo: t2, descricao: d2, preco: precoConta(preco, 10) },
      { nome: 'Beleza', ml: 'Beleza Expressa Mercadolivre', shopee: 'Loja Beleza Expressa SHOPEE', titulo: t3, descricao: d3, preco: precoConta(preco, 20) }
    ]
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'exportar-bling.json';
  a.click();

  mostrarStatus('Arquivo exportar-bling.json baixado. Esse arquivo o robô do PC vai usar.', 'sucesso', 'statusExport');
}

adicionarCor();
renderEstoques();
validarDimensoes();
abrirPasso('step1');
