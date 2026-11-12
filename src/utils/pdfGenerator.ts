import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdmissibilityAnalysisResult, ChecklistItem } from '../types/admissibility';
import { MARCO_RELEVANCIA_BR } from '../../shared/regras';

export interface PDFExportOptions {
  includeMinuta?: boolean;
  includeAssessorNotes?: boolean;
  assessorName?: string;
}

export function generateAdmissibilityPDF(
  data: AdmissibilityAnalysisResult,
  options: PDFExportOptions = { includeMinuta: true, includeAssessorNotes: true }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header Colors
  const tjNavy: [number, number, number] = [24, 43, 73];
  const tjGold: [number, number, number] = [184, 134, 11];
  const textDark: [number, number, number] = [33, 37, 41];
  const textMuted: [number, number, number] = [100, 116, 139];
  const bgLight: [number, number, number] = [248, 250, 252];

  let currentY = 16;

  /** Escreve texto quebrando linhas e páginas (evita estouro de página em textos longos). */
  const escrever = (texto: string, lineH: number) => {
    const linhas: string[] = doc.splitTextToSize(texto || '', contentWidth);
    for (const l of linhas) {
      if (currentY > pageHeight - 18) {
        doc.addPage();
        currentY = 18;
      }
      doc.text(l, margin, currentY);
      currentY += lineH;
    }
  };

  // --- HEADER BAR ---
  doc.setFillColor(...tjNavy);
  doc.rect(margin, currentY, contentWidth, 24, 'F');

  // Gold accent strip
  doc.setFillColor(...tjGold);
  doc.rect(margin, currentY + 23, contentWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PODER JUDICIÁRIO DO ESTADO DO PARANÁ', pageWidth / 2, currentY + 7, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('1ª VICE-PRESIDÊNCIA — JUÍZO DE ADMISSIBILIDADE RECURSAL', pageWidth / 2, currentY + 13, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(220, 230, 242);
  doc.text('CHECKLIST TÉCNICO & EXAME DE REQUISITOS (ATUALIZADO LEI 15.484/2026)', pageWidth / 2, currentY + 19, { align: 'center' });

  currentY += 32;

  // --- PROCESSO IDENTIFICAÇÃO ---
  doc.setFillColor(...bgLight);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 38, 2, 2, 'FD');

  doc.setTextColor(...tjNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DADOS DO PROCESSO & DA DECISÃO RECORRIDA', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textDark);

  const col1X = margin + 4;
  const col2X = margin + 85;

  doc.text(`Autos nº: ${data.processo.numero || 'Não informado'}`, col1X, currentY + 12);
  doc.text(`Origem: ${data.processo.origemOrgao || 'TJPR'}`, col1X, currentY + 17);
  doc.text(`Matéria: ${data.processo.materia || 'Cível/Geral'}`, col1X, currentY + 22);
  doc.text(`Valor da Causa: ${data.processo.valorCausa || 'Não informado'}`, col1X, currentY + 27);

  doc.text(`Publ. Acórdão: ${data.processo.dataPublicacaoAcordao || 'N/I'}`, col2X, currentY + 12);
  doc.text(`Embargos Declaratórios: ${data.processo.houveEmbargosDeclaracao ? `Sim (Publ: ${data.processo.dataPublicacaoEmbargos || 'Sim'})` : 'Não opostos'}`, col2X, currentY + 17);
  
  // Marco temporal highlight
  doc.setFont('helvetica', 'bold');
  if (data.processo.exigeTopicoRelevancia) {
    doc.setTextColor(180, 83, 9); // Amber
    doc.text('Marco 2026: Exige Tópico de Relevância (art. 1.035-A CPC)', col2X, currentY + 23);
  } else {
    doc.setTextColor(71, 85, 105);
    doc.text(`Marco 2026: anterior a ${MARCO_RELEVANCIA_BR} (tópico facultativo)`, col2X, currentY + 23);
  }
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text(`Recorrentes: ${(data.processo.recorrentes || []).join(', ') || 'N/I'}`, col1X, currentY + 33);

  currentY += 43;

  // --- DIAGNÓSTICO E SAÍDA DO ART. 1.030 ---
  doc.setFillColor(data.diagnosticoGeral.isDecisaoMista ? 254 : 240, data.diagnosticoGeral.isDecisaoMista ? 242 : 249, data.diagnosticoGeral.isDecisaoMista ? 242 : 255);
  doc.setDrawColor(data.diagnosticoGeral.isDecisaoMista ? 248 : 199, data.diagnosticoGeral.isDecisaoMista ? 113 : 210, data.diagnosticoGeral.isDecisaoMista ? 113 : 254);
  doc.roundedRect(margin, currentY, contentWidth, 34, 2, 2, 'FD');

  doc.setTextColor(data.diagnosticoGeral.isDecisaoMista ? 153 : 30, data.diagnosticoGeral.isDecisaoMista ? 27 : 58, data.diagnosticoGeral.isDecisaoMista ? 27 : 138);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`ENQUADRAMENTO PRINCIPAL: ${data.diagnosticoGeral.probabilidadeAdmissao.toUpperCase()}`, margin + 4, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);

  const wrapParecer = doc.splitTextToSize(
    `Síntese: ${data.diagnosticoGeral.resumoParecer}`,
    contentWidth - 8
  );
  doc.text(wrapParecer.slice(0, 3), margin + 4, currentY + 12);

  // Alerta de recurso cabível
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 18, 60); // Red
  const wrapRecurso = doc.splitTextToSize(
    `Sistema Recursal / Erro Grosseiro: ${data.diagnosticoGeral.recursoCabivelAdvertencia}`,
    contentWidth - 8
  );
  doc.text(wrapRecurso.slice(0, 2), margin + 4, currentY + 26);

  currentY += 39;

  // --- RECURSOS ANALISADOS BOX ---
  if (data.recursosAnalisados && data.recursosAnalisados.length > 0) {
    doc.setTextColor(...tjNavy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('RECURSOS INTERPOSTOS EM EXAME', margin, currentY);
    currentY += 4;

    const appealRows = data.recursosAnalisados.map((rec) => [
      rec.tipo,
      rec.recorrente,
      (rec.alineasConstitucionais || []).join(', ') || 'N/I',
      (rec.dispositivosInvocados || []).join('; ') || 'N/I',
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Recurso', 'Recorrente', 'Alínea(s) CF', 'Dispositivos Infraconstitucionais / CF']],
      body: appealRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: textDark },
      headStyles: { fillColor: tjNavy, textColor: [255, 255, 255], fontStyle: 'bold' },
      didDrawPage: () => {},
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- CHECKLIST SECTIONS TABLE ---
  doc.setTextColor(...tjNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TABELA EXAUSTIVA DO CHECKLIST TÉCNICO (SEÇÕES A a J)', margin, currentY);
  currentY += 4;

  const tableBody: any[] = [];

  data.checklistSecoes.forEach((sec) => {
    // Add section header row
    tableBody.push([
      {
        content: `${sec.secaoTitulo.toUpperCase()}`,
        colSpan: 3,
        styles: { fillColor: [226, 232, 240], fontStyle: 'bold', textColor: tjNavy, fontSize: 8 },
      },
    ]);

    sec.itens.forEach((it: ChecklistItem) => {
      let statusFormatted = 'CONFORME';
      let statusColor: [number, number, number] = [22, 101, 52]; // green

      if (it.status === 'nao_conforme') {
        statusFormatted = 'NÃO CONFORME';
        statusColor = [185, 28, 28]; // red
      } else if (it.status === 'atencao') {
        statusFormatted = 'ATENÇÃO';
        statusColor = [180, 83, 9]; // amber
      } else if (it.status === 'nao_aplicavel') {
        statusFormatted = 'NÃO APLICÁVEL';
        statusColor = [100, 116, 139]; // slate
      }

      const itemTitleText = `${it.titulo} ${it.novidade2026 ? ' [LEI 15.484/2026]' : ''}`;
      let detailText = it.analiseTecnica || '';
      if (it.fundamentoLegal) {
        detailText += `\nBase Legal: ${it.fundamentoLegal}`;
      }
      if (it.trechoRelevante) {
        detailText += `\nTrecho/Certidão: "${it.trechoRelevante}"`;
      }
      if (options.includeAssessorNotes && it.observacaoAssessor) {
        detailText += `\n[Nota do Assessor]: ${it.observacaoAssessor}`;
      }

      tableBody.push([
        {
          content: it.id,
          styles: { halign: 'center', fontStyle: 'bold', textColor: textDark, cellWidth: 12 },
        },
        {
          content: `${itemTitleText}\n\nStatus: ${statusFormatted}`,
          styles: { fontStyle: 'bold', textColor: statusColor, cellWidth: 50 },
        },
        {
          content: detailText,
          styles: { textColor: textDark },
        },
      ]);
    });
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Ref.', 'Item do Checklist & Avaliação', 'Análise Técnica, Fundamentação & Trecho dos Autos']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.5, valign: 'top' },
    headStyles: { fillColor: tjNavy, textColor: [255, 255, 255], fontStyle: 'bold' },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // --- PRAZOS CALCULADOS ---
  if (data.verificacoes && data.verificacoes.prazos.length > 0) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...tjNavy);
    doc.text('TEMPESTIVIDADE E MARCO DA RELEVÂNCIA (CALCULADOS PELO SISTEMA)', margin, currentY);
    currentY += 3;
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Recurso', 'Base', 'Último dia (15 d.u.)', 'Em dobro', 'Interposição', 'Resultado']],
      body: data.verificacoes.prazos.map((p) => [
        p.recursoTipo,
        p.dataBase ?? '—',
        p.dataLimite ?? '—',
        p.dataLimiteDobro ?? '—',
        p.dataInterposicao ?? '—',
        `${p.status.replace(/_/g, ' ')}\n${p.observacao}`,
      ]),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, valign: 'top' },
      headStyles: { fillColor: tjNavy, textColor: [255, 255, 255] },
    });
    currentY = (doc as any).lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    escrever(`Relevância (REsp): ${data.verificacoes.relevancia.observacao}`, 3.8);
    data.verificacoes.avisos.forEach((a) => escrever(`Aviso: ${a}`, 3.8));
    currentY += 6;
  }

  // --- VERIFICAÇÃO DE PRECEDENTES ---
  if (data.precedentes && data.precedentes.length > 0) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...tjNavy);
    doc.text('VERIFICAÇÃO DE SÚMULAS, TEMAS E PRECEDENTES CITADOS', margin, currentY);
    currentY += 3;
    const situacao: Record<string, string> = { pendente: 'pendente', conferido: 'conferido', divergente: 'DIVERGENTE', descartado: 'descartado' };
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Precedente', 'Verificação automática', 'Conferência do assessor']],
      body: data.precedentes.map((c) => [
        c.rotulo,
        `${c.verificacao.status.replace(/_/g, ' ')}${c.verificacao.coerencia === 'verificar' ? ' (pertinência a verificar)' : ''}`,
        `${situacao[c.conferencia.situacao]}${c.conferencia.observacao ? ' — ' + c.conferencia.observacao : ''}`,
      ]),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, valign: 'top' },
      headStyles: { fillColor: tjNavy, textColor: [255, 255, 255] },
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- MINUTA DA DECISÃO SUGERIDA (SE HABILITADA) ---
  if (options.includeMinuta && data.minutaDecisao1VP) {
    doc.addPage();
    currentY = 18;

    doc.setFillColor(...tjNavy);
    doc.rect(margin, currentY, contentWidth, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('MINUTA SUGERIDA DA DECISÃO DE ADMISSIBILIDADE (1ª VICE-PRESIDÊNCIA TJPR)', pageWidth / 2, currentY + 9, { align: 'center' });

    currentY += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...tjNavy);
    doc.text('I. CABEÇALHO & RELATÓRIO', margin, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    escrever(data.minutaDecisao1VP.relatorio, 4);
    currentY += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...tjNavy);
    doc.text('II. FUNDAMENTAÇÃO EM CAPÍTULOS AUTÔNOMOS (CPC, ART. 1.030)', margin, currentY);
    currentY += 5;

    data.minutaDecisao1VP.capitulosFundamentacao.forEach((cap) => {
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 18;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(cap.tituloCapitulo, margin, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...textDark);
      escrever(cap.conteudo, 3.8);
      currentY += 2;

      if (cap.recursoCabivel) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9);
        doc.text(`Recurso cabível deste capítulo: ${cap.recursoCabivel}`, margin, currentY);
        currentY += 5;
      }
      currentY += 2;
    });

    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...tjNavy);
    doc.text('III. DISPOSITIVO E ADVERTÊNCIA RECURSAL OBRIGATÓRIA', margin, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    escrever(data.minutaDecisao1VP.dispositivoFinal, 3.8);
    currentY += 4;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(190, 18, 60);
    escrever(data.minutaDecisao1VP.advertenciaRecursual ?? '', 3.8);
  }

  // --- FOOTER ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text(
      `RASCUNHO COM AUXÍLIO DE IA • TJPR 1ª VP • Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  return doc;
}

export function downloadAdmissibilityPDF(
  data: AdmissibilityAnalysisResult,
  fileName?: string,
  options?: PDFExportOptions
) {
  const doc = generateAdmissibilityPDF(data, options);
  const cleanNum = (data.processo.numero || 'relatorio-admissibilidade').replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalName = fileName || `Checklist_Admissibilidade_1VP_TJPR_${cleanNum}.pdf`;
  doc.save(finalName);
}
