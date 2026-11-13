import { parseData, formatBR } from './prazos';

export interface ProtocoloDetectado {
  data: string; // dd/mm/aaaa
  pagina: number;
  trecho: string;
  /** Sistema cujo carimbo foi reconhecido. */
  sistema: 'projudi' | 'generico';
  /** Tipo de movimento/petição informado no carimbo (ex.: "RECURSO ESPECIAL"). */
  movimento?: string;
  /** Referência do carimbo (ex.: "Recurso 0010045-96.2026.8.16.0045 · mov. 1.1"). */
  referencia?: string;
}

/**
 * Projudi (TJPR): em TODAS as páginas da petição há um carimbo com duas linhas, por exemplo:
 *   PROJUDI - Recurso: 0010045-96.2026.8.16.0045 - Ref. mov. 1.1 - Assinado digitalmente por ...
 *   20/07/2026: JUNTADA DE PETIÇÃO DE RECURSO ESPECIAL. Arq: Petição
 * A data da segunda linha é a do protocolo/juntada da petição.
 */
const PROJUDI_DATA = /(\d{2}\/\d{2}\/\d{4})\s*:\s*JUNTADA\s+DE\s+([^.\n]{3,100}?)\s*\.\s*(?:Arq\b|$)/i;
const PROJUDI_REF = /PROJUDI\s*-\s*(Recurso|Processo)\s*:\s*([\d.\-]{15,30})\s*-\s*Ref\.\s*mov\.\s*([\d.]+)/i;

const ROTULOS =
  /(protocolad[oa]\s+em|data\s+do\s+protocolo|protocolo\s*(?:n[º°o.]*\s*\S+\s*)?(?:em|:)|recebid[oa]\s+em|peticionad[oa]\s+em|data\s+de\s+interposi[çc][ãa]o)/i;
const DATA = /(\d{2}\/\d{2}\/\d{4})/;

function projudi(paginas: string[]): ProtocoloDetectado | null {
  const contagem = new Map<string, { n: number; pagina: number; trecho: string; movimento: string }>();
  let referencia: string | undefined;
  paginas.forEach((txt, i) => {
    for (const linha of txt.split('\n')) {
      const m = linha.match(PROJUDI_DATA);
      if (m && parseData(m[1])) {
        const atual = contagem.get(m[1]);
        if (atual) atual.n++;
        else contagem.set(m[1], { n: 1, pagina: i + 1, trecho: linha.replace(/\s+/g, ' ').trim().slice(0, 160), movimento: m[2].trim().replace(/^PETI[ÇC][ÃA]O\s+(?:INICIAL\s+)?DE\s+/i, '') });
      }
      const r = linha.match(PROJUDI_REF);
      if (r && !referencia) referencia = `${r[1]} ${r[2]} · mov. ${r[3]}`;
    }
  });
  if (contagem.size === 0) return null;
  // o carimbo se repete em todas as páginas: vale a data mais frequente
  const [data, v] = [...contagem.entries()].sort((a, b) => b[1].n - a[1].n || a[1].pagina - b[1].pagina)[0];
  return { data: formatBR(parseData(data)!), pagina: v.pagina, trecho: v.trecho, sistema: 'projudi', movimento: v.movimento, referencia };
}

/**
 * Procura a data do protocolo no texto extraído da petição recursal.
 * 1) carimbo do Projudi ("dd/mm/aaaa: JUNTADA DE PETIÇÃO DE ..."), repetido em cada página;
 * 2) linhas com rótulo explícito ("Protocolado em", "Data do protocolo"...), preferindo as páginas das pontas.
 * Retorna null se nada for encontrado (o usuário informa a data manualmente).
 */
export function extrairDataProtocolo(paginas: string[]): ProtocoloDetectado | null {
  const p = projudi(paginas);
  if (p) return p;

  type C = { data: Date; pagina: number; trecho: string; peso: number };
  const achados: C[] = [];
  paginas.forEach((txt, i) => {
    const pagina = i + 1;
    const lines = txt.split('\n');
    lines.forEach((linha, k) => {
      if (!ROTULOS.test(linha)) return;
      const janela = `${linha} ${lines[k + 1] ?? ''}`;
      const m = janela.match(DATA);
      if (!m) return;
      const d = parseData(m[1]);
      if (!d) return;
      const extremo = pagina <= 2 || pagina >= paginas.length - 1;
      achados.push({ data: d, pagina, trecho: janela.replace(/\s+/g, ' ').trim().slice(0, 160), peso: (DATA.test(linha) ? 2 : 0) + (extremo ? 1 : 0) });
    });
  });
  if (achados.length === 0) return null;
  achados.sort((a, b) => b.peso - a.peso || a.pagina - b.pagina);
  const m = achados[0];
  return { data: formatBR(m.data), pagina: m.pagina, trecho: m.trecho, sistema: 'generico' };
}

/** O movimento do carimbo é compatível com o papel atribuído ao arquivo? null = não dá para dizer. */
export function movimentoCompativel(papel: 'recurso_especial' | 'recurso_extraordinario', movimento?: string): boolean | null {
  if (!movimento) return null;
  const mv = movimento.toUpperCase();
  if (/ESPECIAL/.test(mv)) return papel === 'recurso_especial';
  if (/EXTRAORDIN/.test(mv)) return papel === 'recurso_extraordinario';
  return null;
}
