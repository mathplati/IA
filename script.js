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
      '', codigoPai, nome, 'UN', ncm, '0', preco, '0',
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
    function toggleCard(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
}

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
          '', codigoVar, nomeVar, 'UN', ncm, '0', preco, '0',
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

adicionarCor();
renderEstoques();
validarDimensoes();
