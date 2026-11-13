import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type RowInput, type UserOptions } from 'jspdf-autotable';
import { AdmissibilityAnalysisResult, ChecklistStatus } from '../types/admissibility';
import { MARCO_RELEVANCIA_BR } from '../../shared/regras';
import {
  avisosSobrestamento,
  obterSobrestamento,
  ROTULO_CONCLUSAO,
  ROTULO_ENQUADRAMENTO,
  ROTULO_ESPECIE,
  ROTULO_SITUACAO_TEMA,
  ROTULO_SUSPENSAO,
  rotuloTema,
} from '../../shared/sobrestamento';
import { cabecalhoSemTimbre } from '../../shared/minuta';
import { avisosPreparo, obterPreparo, ROTULO_PREPARO } from '../../shared/preparo';

export interface PDFExportOptions {
  includeMinuta?: boolean;
  includeAssessorNotes?: boolean;
  assessorName?: string;
}

type RGB = [number, number, number];

/* Mesma paleta da interface: tinta, cinzas e cor só para status. */
const TINTA: RGB = [24, 32, 44];
const TINTA_2: RGB = [70, 80, 98];
const TINTA_3: RGB = [104, 113, 132];
const LINHA: RGB = [214, 218, 224];
const LINHA_FORTE: RGB = [160, 167, 178];
const OK: RGB = [43, 100, 73];
const ATENCAO: RGB = [133, 89, 11];
const OBICE: RGB = [140, 42, 42];

const STATUS_ITEM: Record<ChecklistStatus, { t: string; c: RGB }> = {
  conforme: { t: 'Conforme', c: OK },
  nao_conforme: { t: 'Óbice', c: OBICE },
  atencao: { t: 'Verificar', c: ATENCAO },
  nao_aplicavel: { t: 'Não se aplica', c: TINTA_3 },
};

const STATUS_PRAZO: Record<string, { t: string; c: RGB }> = {
  tempestivo: { t: 'Tempestivo', c: OK },
  intempestivo: { t: 'Intempestivo', c: OBICE },
  tempestivo_se_prazo_dobro: { t: 'Só com prazo em dobro', c: ATENCAO },
  indeterminado: { t: 'Indeterminado', c: TINTA_3 },
};

const STATUS_PRECEDENTE: Record<string, string> = {
  confirmada: 'Confirmada na base',
  nao_encontrada_na_base: 'Fora da base',
  requer_conferencia: 'Conferir no portal',
  tribunal_indefinido: 'Tribunal indefinido',
  cancelada_ou_superada: 'Cancelada ou superada',
  inexistente: 'Provavelmente inexistente',
};

const CONFERENCIA: Record<string, string> = { pendente: 'Pendente', conferido: 'Conferido', divergente: 'Divergente', descartado: 'Descartado' };

const M = { esq: 22, dir: 22, topo: 24, base: 22 };

export function generateAdmissibilityPDF(data: AdmissibilityAnalysisResult, options: PDFExportOptions = { includeMinuta: true, includeAssessorNotes: true }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const larg = W - M.esq - M.dir;
  const limite = H - M.base;
  let y = M.topo;

  const fonte = (familia: 'helvetica' | 'times', estilo: 'normal' | 'bold' | 'italic' | 'bolditalic', tamanho: number, cor: RGB = TINTA) => {
    doc.setFont(familia, estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
  };
  const novaPagina = () => {
    doc.addPage();
    y = M.topo;
  };
  const garantir = (mm: number) => {
    if (y + mm > limite) novaPagina();
  };
  const filete = (yy: number, cor: RGB = LINHA, x0 = M.esq, x1 = W - M.dir) => {
    doc.setDrawColor(...cor);
    doc.setLineWidth(0.2);
    doc.line(x0, yy, x1, yy);
  };

  /** Parágrafos com quebra de linha e de página; justificados quando pedido (a última linha fica alinhada à esquerda). */
  const texto = (conteudo: string, o: { x?: number; largura?: number; entrelinha: number; justificar?: boolean; recuo?: number } ) => {
    const x = o.x ?? M.esq;
    const w = o.largura ?? larg;
    for (const paragrafo of (conteudo || '').split(/\n/)) {
      if (!paragrafo.trim()) {
        y += o.entrelinha * 0.6;
        continue;
      }
      const linhas: string[] = doc.splitTextToSize(paragrafo.trim(), w);
      linhas.forEach((linha, i) => {
        if (y > limite) novaPagina();
        const ultima = i === linhas.length - 1;
        if (o.justificar && !ultima) doc.text([linha, ''], x, y, { align: 'justify', maxWidth: w });
        else doc.text(linha, x, y);
        y += o.entrelinha;
      });
      y += o.entrelinha * 0.35;
    }
  };

  const titulo = (t: string, minimo = 28) => {
    garantir(minimo);
    y += 6;
    fonte('times', 'bold', 13.5);
    doc.text(t, M.esq, y);
    y += 2.6;
    filete(y, LINHA_FORTE);
    y += 6;
  };

  const rotuloValor = (rotulo: string, valor: string, cor: RGB = TINTA, corRotulo: RGB = TINTA_3) => {
    garantir(10);
    fonte('helvetica', 'normal', 7.5, corRotulo);
    doc.text(rotulo, M.esq, y);
    y += 4;
    fonte('helvetica', 'normal', 9.5, cor);
    texto(valor, { entrelinha: 4.4 });
    y += 1.2;
  };

  /** Tabela sóbria: sem fundo, cabeçalho em cinza e filetes horizontais. */
  const tabela = (head: string[], body: RowInput[], extra: Partial<UserOptions> = {}) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      theme: 'plain',
      margin: { left: M.esq, right: M.dir, top: M.topo, bottom: M.base },
      styles: { font: 'helvetica', fontSize: 8.5, textColor: TINTA, cellPadding: { top: 2.2, bottom: 2.4, left: 0, right: 3.5 }, valign: 'top', overflow: 'linebreak' },
      headStyles: { fontStyle: 'normal', fontSize: 7.5, textColor: TINTA_3, cellPadding: { top: 0, bottom: 2, left: 0, right: 3.5 } },
      didDrawCell: (c: CellHookData) => {
        if (c.column.index !== 0) return;
        const yy = c.cell.y + c.cell.height;
        filete(yy, c.section === 'head' ? LINHA_FORTE : LINHA, M.esq, W - M.dir);
      },
      ...extra,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  };

  const nota = (t: string, cor: RGB = TINTA_2) => {
    fonte('helvetica', 'normal', 8.5, cor);
    texto(t, { entrelinha: 4 });
  };

  const { processo, diagnosticoGeral: dg, minutaDecisao1VP: minuta } = data;

  // --- Identificação -------------------------------------------------------------------------------
  fonte('helvetica', 'normal', 8, TINTA_2);
  doc.text('Tribunal de Justiça do Estado do Paraná', M.esq, y);
  doc.text('Relatório de admissibilidade', W - M.dir, y, { align: 'right' });
  fonte('helvetica', 'normal', 8, TINTA_3);
  doc.text('1ª Vice-Presidência', M.esq, y + 4);
  doc.text(new Date().toLocaleDateString('pt-BR'), W - M.dir, y + 4, { align: 'right' });
  y += 8;
  filete(y);
  y += 11;

  if (processo.classe) {
    fonte('helvetica', 'normal', 8.5, TINTA_3);
    doc.text(processo.classe, M.esq, y);
    y += 6.5;
  }
  fonte('times', 'bold', 19);
  for (const l of doc.splitTextToSize(processo.materia || 'Matéria não identificada', larg) as string[]) {
    doc.text(l, M.esq, y);
    y += 7.6;
  }
  fonte('helvetica', 'normal', 10, TINTA_2);
  doc.text(processo.numero || 'Número do processo não informado', M.esq, y);
  y += 9;

  const meta: Array<[string, string]> = [
    ['Órgão julgador', processo.origemOrgao || 'Não identificado'],
    ['Publicação do acórdão', processo.dataPublicacaoAcordao || 'Não identificada'],
    ['Embargos de declaração', processo.houveEmbargosDeclaracao ? `Opostos${processo.dataPublicacaoEmbargos ? `, publicados em ${processo.dataPublicacaoEmbargos}` : ''}` : 'Não opostos'],
    ['Valor da causa', processo.valorCausa || 'Não informado'],
    ['Recorrente', (processo.recorrentes || []).join('; ') || 'Não identificado'],
    ['Recorrido', (processo.recorridos || []).join('; ') || 'Não identificado'],
  ];
  filete(y);
  y += 5.5;
  const colW = (larg - 8) / 2;
  for (let i = 0; i < meta.length; i += 2) {
    let alt = 0;
    [meta[i], meta[i + 1]].forEach((par, k) => {
      if (!par) return;
      const x = M.esq + k * (colW + 8);
      fonte('helvetica', 'normal', 7.5, TINTA_3);
      doc.text(par[0], x, y);
      fonte('helvetica', 'normal', 9);
      const ls = (doc.splitTextToSize(par[1], colW) as string[]).slice(0, 2);
      doc.text(ls, x, y + 4.2);
      alt = Math.max(alt, 4.2 + ls.length * 4);
    });
    y += alt + 3;
  }
  filete(y - 1);
  y += 2;

  // --- Sobrestamento -------------------------------------------------------------------------------
  const sob = obterSobrestamento(data);
  titulo('Preliminar: sobrestamento');
  rotuloValor('Conclusão', ROTULO_CONCLUSAO[sob.conclusao], sob.conclusao === 'nao_verificado' || sob.conclusao === 'sobrestar' ? ATENCAO : TINTA);
  if (sob.verificadoPor && sob.verificadoEm && sob.conclusao !== 'nao_verificado') {
    nota(`Registrado por ${sob.verificadoPor} em ${new Date(sob.verificadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`, TINTA_3);
  }
  if (sob.fundamentacao?.trim()) {
    y += 1;
    fonte('times', 'normal', 10.5);
    texto(sob.fundamentacao, { entrelinha: 5, justificar: true });
  }
  if (sob.temas.length) {
    y += 1;
    tabela(
      ['Tema', 'Questão', 'Enquadramento', 'Suspensão'],
      sob.temas.map((t) => [
        `${rotuloTema(t)}\n${ROTULO_ESPECIE[t.especie]}${t.origem === 'ia' ? ', indicado pela IA' : ''}`,
        [t.questao, t.decisaoAfetacao && `Afetação: ${t.decisaoAfetacao}`, t.abrangencia && `Abrangência: ${t.abrangencia}`, t.observacao].filter(Boolean).join('\n') || '—',
        { content: ROTULO_ENQUADRAMENTO[t.enquadramento], styles: { textColor: t.enquadramento === 'se_insere' ? ATENCAO : TINTA_2 } },
        { content: `${ROTULO_SUSPENSAO[t.suspensao]}\n${ROTULO_SITUACAO_TEMA[t.situacao]}`, styles: { textColor: t.suspensao === 'determinada' ? ATENCAO : TINTA_2 } },
      ]),
      { columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 30 }, 3: { cellWidth: 32 } } },
    );
  } else {
    nota('Nenhum tema registrado.', TINTA_3);
  }
  avisosSobrestamento(data).forEach((a) => nota(a, ATENCAO));

  // --- Diagnóstico ---------------------------------------------------------------------------------
  titulo('Admissibilidade');
  fonte('times', 'bold', 12.5);
  texto(dg.probabilidadeAdmissao, { entrelinha: 5.4 });
  y += 1.5;

  const exigeTopico = data.verificacoes?.relevancia.exigeTopicoCalculado ?? processo.exigeTopicoRelevancia;
  rotuloValor('Enquadramento no art. 1.030 do CPC', dg.incisoArt1030Principal);
  rotuloValor('Tópico de relevância', exigeTopico ? 'Exigido (Lei 15.484/2026)' : `Não exigido, acórdão anterior a ${MARCO_RELEVANCIA_BR}`);
  if (dg.isDecisaoMista && dg.recursoCabivelAdvertencia) rotuloValor('Decisão mista', dg.recursoCabivelAdvertencia, TINTA, OBICE);

  const obices = dg.principaisObicesIdentificados ?? [];
  if (obices.length) {
    garantir(10);
    fonte('helvetica', 'normal', 7.5, TINTA_3);
    doc.text('Óbices identificados', M.esq, y);
    y += 4.2;
    fonte('helvetica', 'normal', 9.5);
    for (const o of obices) {
      const ls = doc.splitTextToSize(o, larg - 4) as string[];
      garantir(ls.length * 4.4);
      doc.setFillColor(...OBICE);
      doc.rect(M.esq, y - 2.2, 1.2, 1.2, 'F');
      doc.text(ls, M.esq + 4, y);
      y += ls.length * 4.4 + 0.8;
    }
    y += 1;
  }

  garantir(14);
  y += 2;
  fonte('helvetica', 'normal', 7.5, TINTA_3);
  doc.text('Parecer', M.esq, y);
  y += 5;
  fonte('times', 'normal', 11);
  texto(dg.resumoParecer, { entrelinha: 5.2, justificar: true });

  // --- Recursos ------------------------------------------------------------------------------------
  if (data.recursosAnalisados.length) {
    titulo('Recursos em exame');
    tabela(
      ['Recurso', 'Recorrente', 'Alíneas', 'Dispositivos invocados'],
      data.recursosAnalisados.map((r) => [r.tipo, r.recorrente, (r.alineasConstitucionais || []).join(', ') || '—', (r.dispositivosInvocados || []).join('; ') || '—']),
      { columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 36 }, 2: { cellWidth: 28 } } },
    );
  }

  // --- Tempestividade ------------------------------------------------------------------------------
  if (data.verificacoes?.prazos.length) {
    titulo('Tempestividade');
    nota('Calculada pelo sistema, não pela IA: 15 dias úteis (CPC, arts. 219 e 1.003, § 5º), com feriados e recesso forense.', TINTA_3);
    y += 1;
    tabela(
      ['Recurso', 'Contagem desde', 'Prazo final', 'Interposição', 'Resultado'],
      data.verificacoes.prazos.map((p) => [
        p.recursoTipo,
        p.dataBase ?? '—',
        `${p.dataLimite ?? '—'}${p.dataLimiteDobro ? `\nem dobro: ${p.dataLimiteDobro}` : ''}`,
        p.dataInterposicao ?? '—',
        { content: `${STATUS_PRAZO[p.status]?.t ?? p.status}${p.observacao ? `\n${p.observacao}` : ''}`, styles: { textColor: STATUS_PRAZO[p.status]?.c ?? TINTA } },
      ]),
      { columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 26 }, 2: { cellWidth: 28 }, 3: { cellWidth: 24 } } },
    );
    nota(`Relevância. ${data.verificacoes.relevancia.observacao}`);
    data.verificacoes.avisos.forEach((a) => nota(a, ATENCAO));
  }

  // --- Preparo -------------------------------------------------------------------------------------
  const preparo = obterPreparo(data);
  if (preparo.length) {
    titulo('Preparo');
    const corPrep = (st: string): RGB => (st === 'nao_comprovado' ? OBICE : st === 'insuficiente' ? ATENCAO : st === 'a_verificar' ? TINTA_3 : OK);
    tabela(
      ['Recurso', 'Situação', 'Comprovação', 'Conferido'],
      preparo.map((p) => [
        p.recurso,
        { content: `${ROTULO_PREPARO[p.situacao]}${p.valorRecolhido ? `\n${p.valorRecolhido}` : ''}`, styles: { textColor: corPrep(p.situacao) } },
        [p.fundamento, p.observacao].filter(Boolean).join('\n') || '—',
        p.conferido ? 'Sim' : 'Não',
      ]),
      { columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 30 }, 3: { cellWidth: 18 } } },
    );
    avisosPreparo(preparo).forEach((a) => nota(a, ATENCAO));
  }

  // --- Checklist -----------------------------------------------------------------------------------
  titulo('Checklist', 70);
  const corpo: RowInput[] = [];
  for (const sec of data.checklistSecoes) {
    const tituloSec = sec.secaoTitulo.replace(new RegExp(`^${sec.secaoCodigo}[.)\\s–-]+`), '');
    corpo.push([{ content: `${sec.secaoCodigo}   ${tituloSec}`, colSpan: 4, styles: { font: 'times', fontStyle: 'bold', fontSize: 10.5, cellPadding: { top: 5, bottom: 2, left: 0, right: 0 } } }]);
    for (const it of sec.itens) {
      const st = STATUS_ITEM[it.status];
      const detalhe = [
        it.analiseTecnica,
        it.fundamentoLegal && `Fundamento: ${it.fundamentoLegal}`,
        it.trechoRelevante && `Trecho: “${it.trechoRelevante}”`,
        options.includeAssessorNotes && it.observacaoAssessor && `Ressalva do assessor: ${it.observacaoAssessor}`,
      ]
        .filter(Boolean)
        .join('\n');
      corpo.push([
        { content: it.id, styles: { textColor: TINTA_3 } },
        `${it.titulo}${it.novidade2026 ? '\nLei 15.484/2026' : ''}`,
        { content: st.t, styles: { textColor: st.c } },
        { content: detalhe, styles: { textColor: TINTA_2 } },
      ]);
    }
  }
  tabela(['Item', 'Requisito', 'Situação', 'Análise'], corpo, { columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 44 }, 2: { cellWidth: 21 } } });

  // --- Precedentes ---------------------------------------------------------------------------------
  if (data.precedentes?.length) {
    titulo('Precedentes citados');
    tabela(
      ['Precedente', 'Verificação automática', 'Conferência do assessor'],
      data.precedentes.map((c) => [
        c.rotulo,
        `${STATUS_PRECEDENTE[c.verificacao.status] ?? c.verificacao.status}${c.verificacao.coerencia === 'verificar' ? '; pertinência a verificar' : ''}`,
        { content: `${CONFERENCIA[c.conferencia.situacao]}${c.conferencia.observacao ? `. ${c.conferencia.observacao}` : ''}`, styles: { textColor: c.conferencia.situacao === 'divergente' ? OBICE : c.conferencia.situacao === 'conferido' ? OK : TINTA_2 } },
      ]),
      { columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 58 } } },
    );
  }

  // --- Responsável ---------------------------------------------------------------------------------
  garantir(18);
  y += 8;
  fonte('helvetica', 'normal', 8.5, TINTA_2);
  doc.text(`${options.assessorName?.trim() ? `Análise de ${options.assessorName.trim()}, ` : ''}em ${new Date().toLocaleDateString('pt-BR')}.`, M.esq, y);

  // --- Minuta --------------------------------------------------------------------------------------
  if (options.includeMinuta && minuta) {
    novaPagina();
    const meio = W / 2;
    fonte('helvetica', 'normal', 8, TINTA_2);
    doc.text('TRIBUNAL DE JUSTIÇA DO ESTADO DO PARANÁ', meio, y, { align: 'center', charSpace: 0.35 });
    y += 5.5;
    fonte('times', 'bold', 12);
    doc.text('1ª Vice-Presidência', meio, y, { align: 'center' });
    y += 10;

    fonte('times', 'normal', 10, TINTA_2);
    texto(cabecalhoSemTimbre(minuta.cabecalho), { entrelinha: 4.6 });
    y += 3;

    const secao = (t: string) => {
      garantir(20);
      y += 5;
      fonte('times', 'bold', 10.5);
      doc.text(t, meio, y, { align: 'center', charSpace: 0.4 });
      y += 7;
    };
    const corpoMinuta = (t: string, estilo: 'normal' | 'bold' = 'normal') => {
      fonte('times', estilo, 11);
      texto(t, { entrelinha: 5.3, justificar: true });
    };

    secao('I. RELATÓRIO');
    corpoMinuta(minuta.relatorio);

    secao('II. FUNDAMENTAÇÃO');
    for (const cap of minuta.capitulosFundamentacao) {
      garantir(22);
      y += 2;
      fonte('times', 'bold', 11);
      texto(cap.tituloCapitulo, { entrelinha: 5.2 });
      corpoMinuta(cap.conteudo);
      if (cap.recursoCabivel) {
        fonte('times', 'italic', 10.5, TINTA_2);
        texto(`Recurso cabível deste capítulo: ${cap.recursoCabivel}`, { entrelinha: 5 });
      }
      y += 2;
    }

    secao('III. DISPOSITIVO');
    corpoMinuta(minuta.dispositivoFinal);

    if (minuta.advertenciaRecursual?.trim()) {
      garantir(24);
      y += 4;
      const ini = { pagina: doc.getNumberOfPages(), y: y - 4 };
      fonte('times', 'normal', 10.5, TINTA);
      texto(minuta.advertenciaRecursual, { x: M.esq + 5, largura: larg - 5, entrelinha: 5, justificar: true });
      const fim = { pagina: doc.getNumberOfPages(), y: y - 4 };
      doc.setDrawColor(...(dg.isDecisaoMista ? OBICE : LINHA_FORTE));
      doc.setLineWidth(0.5);
      for (let pg = ini.pagina; pg <= fim.pagina; pg++) {
        doc.setPage(pg);
        doc.line(M.esq, pg === ini.pagina ? ini.y : M.topo - 4, M.esq, pg === fim.pagina ? fim.y : limite - 3);
      }
      doc.setLineWidth(0.2);
    }

    garantir(30);
    y += 18;
    filete(y, LINHA_FORTE, meio - 35, meio + 35);
    y += 5;
    fonte('times', 'normal', 10.5);
    doc.text('Desembargador 1º Vice-Presidente', meio, y, { align: 'center' });
    y += 4.5;
    fonte('helvetica', 'normal', 7.5, TINTA_3);
    doc.text('Competência delegada pela Presidência (RITJPR, art. 15, § 3º)', meio, y, { align: 'center' });
  }

  // --- Cabeçalho corrido e rodapé ------------------------------------------------------------------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i > 1) {
      fonte('helvetica', 'normal', 7.5, TINTA_3);
      doc.text('Relatório de admissibilidade', M.esq, 13);
      doc.text(processo.numero || '', W - M.dir, 13, { align: 'right' });
      filete(15);
    }
    fonte('helvetica', 'normal', 7.5, TINTA_3);
    doc.text('Rascunho elaborado com auxílio de IA, sujeito à revisão do assessor e do Desembargador.', M.esq, H - 11);
    doc.text(`${i} de ${total}`, W - M.dir, H - 11, { align: 'right' });
  }

  return doc;
}

export function downloadAdmissibilityPDF(data: AdmissibilityAnalysisResult, fileName?: string, options?: PDFExportOptions) {
  const doc = generateAdmissibilityPDF(data, options);
  const num = (data.processo.numero || 'sem-numero').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(fileName || `Admissibilidade_${num}.pdf`);
}
