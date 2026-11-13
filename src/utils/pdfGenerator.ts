import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type RowInput, type UserOptions } from 'jspdf-autotable';
import type { AdmissibilityAnalysisResult } from '../types/admissibility';
import { cabecalhoSemTimbre } from '../../shared/minuta';
import { montarNotaTecnica, type Tom as NotaTom } from '../../shared/notaTecnica';

export interface PDFExportOptions {
  includeMinuta?: boolean;
  includeQuadro?: boolean;
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





const M = { esq: 22, dir: 22, topo: 24, base: 22 };

export function generateAdmissibilityPDF(data: AdmissibilityAnalysisResult, options: PDFExportOptions = { includeMinuta: true, includeQuadro: true }) {
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


  const { processo, minutaDecisao1VP: minuta } = data;

  const nt = montarNotaTecnica(data);
  const cor: Record<NotaTom, RGB> = { ok: OK, atencao: ATENCAO, obice: OBICE, neutro: TINTA_3 };
  const hoje = new Date();
  const dataExtenso = hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  // --- Cabeçalho -----------------------------------------------------------------------------------
  fonte('helvetica', 'normal', 8, TINTA_2);
  doc.text('Tribunal de Justiça do Estado do Paraná', M.esq, y);
  doc.text('Nota técnica de admissibilidade', W - M.dir, y, { align: 'right' });
  fonte('helvetica', 'normal', 8, TINTA_3);
  doc.text('1ª Vice-Presidência', M.esq, y + 4);
  doc.text(hoje.toLocaleDateString('pt-BR'), W - M.dir, y + 4, { align: 'right' });
  y += 8;
  filete(y);
  y += 11;

  // --- Identificação -------------------------------------------------------------------------------
  const recursos = [nt.temREsp && 'especial', nt.temRE && 'extraordinário'].filter(Boolean).join(' e ');
  const ident: Array<[string, string]> = [
    ['Processo', processo.numero || 'Não informado'],
    ['Matéria', processo.materia || 'Não identificada'],
    ['Recorrente', (processo.recorrentes || []).join('; ') || data.recursosAnalisados.map((r) => r.recorrente).filter(Boolean).join('; ') || 'Não identificado'],
    ['Recorrido', (processo.recorridos || []).join('; ') || 'Não identificado'],
    ['Órgão julgador', processo.origemOrgao || 'Não identificado'],
    [nt.temREsp && nt.temRE ? 'Recursos' : 'Recurso', recursos || 'Não identificado'],
  ];
  const colRot = 33;
  for (const [r, v] of ident) {
    fonte('times', 'bold', 11);
    doc.text(r, M.esq, y);
    fonte('times', 'normal', 11);
    const ls = doc.splitTextToSize(v, larg - colRot) as string[];
    doc.text(ls, M.esq + colRot, y);
    y += ls.length * 5 + 1;
  }
  y += 3;

  // --- Exame, na ordem: preliminar, extrínsecos, recursos, proposta ---------------------------------
  nt.secoes.forEach((sec, k) => {
    garantir(22);
    y += 5;
    fonte('times', 'bold', 12);
    doc.text(`${k + 1}. ${sec.titulo}`, M.esq, y);
    y += 6;
    fonte('times', 'normal', 11.5);
    texto(sec.texto, { entrelinha: 5.5, justificar: true });
  });

  if (nt.pendencias.length) {
    garantir(16);
    y += 4;
    fonte('times', 'bold', 12);
    doc.text('Pendências', M.esq, y);
    y += 6;
    fonte('helvetica', 'normal', 9.5, TINTA);
    for (const pz of nt.pendencias) {
      const ls = doc.splitTextToSize(pz, larg - 4.5) as string[];
      garantir(ls.length * 4.6);
      doc.setFillColor(...ATENCAO);
      doc.rect(M.esq, y - 2.3, 1.3, 1.3, 'F');
      fonte('helvetica', 'normal', 9.5, TINTA);
      doc.text(ls, M.esq + 4.5, y);
      y += ls.length * 4.6 + 1;
    }
  }

  garantir(24);
  y += 9;
  fonte('times', 'normal', 11.5);
  doc.text(`Curitiba, ${dataExtenso}.`, M.esq, y);
  y += 12;
  if (options.assessorName?.trim()) {
    doc.text(options.assessorName.trim(), M.esq, y);
    y += 5;
  }
  fonte('helvetica', 'normal', 8.5, TINTA_3);
  doc.text('Assessoria da 1ª Vice-Presidência', M.esq, y);

  // --- Anexo I: quadro de requisitos ---------------------------------------------------------------
  if (options.includeQuadro !== false && nt.quadro.length) {
    novaPagina();
    fonte('times', 'bold', 13.5);
    doc.text('Anexo I. Quadro de requisitos', M.esq, y);
    y += 6;
    const head = ['Requisito', ...(nt.temREsp ? ['Recurso especial'] : []), ...(nt.temRE ? ['Recurso extraordinário'] : [])];
    const ncol = head.length;
    const celula = (c: { texto: string; tom: NotaTom } | null) => ({ content: c?.texto ?? '—', styles: { textColor: c ? cor[c.tom] : TINTA_3 } });
    // Agrupa as linhas: cada grupo (título + requisitos) é desenhado junto, sem título órfão no pé da página.
    const grupos: Array<{ titulo: string; linhas: typeof nt.quadro }> = [];
    for (const l of nt.quadro) {
      if (l.grupo || grupos.length === 0) grupos.push({ titulo: l.grupo, linhas: [] });
      grupos.at(-1)!.linhas.push(l);
    }
    const colStatus = 30;
    grupos.forEach((g, k) => {
      const altura = 9 + g.linhas.length * 6.2;
      const quebra = y + altura > limite && altura < limite - M.topo;
      if (quebra) novaPagina();
      const body: RowInput[] = [
        ...(g.titulo ? [[{ content: g.titulo, colSpan: ncol, styles: { font: 'times' as const, fontStyle: 'bold' as const, fontSize: 10, cellPadding: { top: 3, bottom: 1.6, left: 0, right: 0 } } }]] : []),
        ...g.linhas.map((l) => [
          { content: l.ressalva ? `${l.requisito}\nRessalva: ${l.ressalva}` : l.requisito },
          ...(nt.temREsp ? [celula(l.resp)] : []),
          ...(nt.temRE ? [celula(l.re)] : []),
        ]),
      ];
      tabela(head, body, {
        showHead: k === 0 || quebra ? 'firstPage' : 'never',
        styles: { font: 'helvetica', fontSize: 8.5, textColor: TINTA, cellPadding: { top: 1.9, bottom: 2.1, left: 0, right: 3 }, valign: 'top', overflow: 'linebreak' },
        columnStyles: { 1: { cellWidth: colStatus }, 2: { cellWidth: colStatus } },
        rowPageBreak: 'avoid',
      });
      y -= 3;
    });
  }

  // --- Minuta --------------------------------------------------------------------------------------
  if (options.includeMinuta && minuta) {
    novaPagina();
    const meio = W / 2;
    fonte('helvetica', 'normal', 8, TINTA_3);
    doc.text('Anexo II. Minuta da decisão', M.esq, y);
    y += 9;
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
      y += 2;
    }

    secao('III. DISPOSITIVO');
    corpoMinuta(minuta.dispositivoFinal);

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
      doc.text('Nota técnica de admissibilidade', M.esq, 13);
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
  doc.save(fileName || `Nota_tecnica_${num}.pdf`);
}
