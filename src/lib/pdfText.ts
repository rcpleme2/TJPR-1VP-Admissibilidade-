import { extrairDataProtocolo, type ProtocoloDetectado } from '../../shared/protocolo';
import { montarMarkdown, pareceEscaneado } from '../../shared/textoPdf';

export interface PdfExtraido {
  texto: string;
  paginas: number;
  caracteres: number;
  escaneado: boolean;
  linhasRemovidas: number;
  protocolo: ProtocoloDetectado | null;
}

interface ItemTexto {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

/** Extrai o texto de um PDF no navegador (pdf.js carregado sob demanda) e o converte em Markdown enxuto. */
export async function extrairPdf(file: File, onProgresso?: (pagina: number, total: number) => void): Promise<PdfExtraido> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const linhasPorPagina: string[][] = [];
  const textoPorPagina: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const linhas: string[] = [];
      let atual = '';
      let ultimoY: number | null = null;
      for (const it of content.items as ItemTexto[]) {
        if (typeof it.str !== 'string') continue;
        const y = it.transform?.[5] ?? 0;
        const altura = Math.abs(it.transform?.[3] ?? 10) || 10;
        if (ultimoY !== null && Math.abs(y - ultimoY) > altura * 0.6) {
          linhas.push(atual);
          atual = '';
        }
        atual += it.str;
        ultimoY = y;
        if (it.hasEOL) {
          linhas.push(atual);
          atual = '';
          ultimoY = null;
        }
      }
      if (atual) linhas.push(atual);
      linhasPorPagina.push(linhas);
      textoPorPagina.push(linhas.join('\n'));
      page.cleanup();
      onProgresso?.(n, doc.numPages);
    }
  } finally {
    await task.destroy();
  }
  const md = montarMarkdown(linhasPorPagina);
  return {
    texto: md.texto,
    paginas: md.paginas,
    caracteres: md.caracteres,
    escaneado: pareceEscaneado(md),
    linhasRemovidas: md.linhasRepetidasRemovidas,
    protocolo: extrairDataProtocolo(textoPorPagina),
  };
}
