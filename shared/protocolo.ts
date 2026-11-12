import { parseData, formatBR } from './prazos';

export interface ProtocoloDetectado {
  data: string; // dd/mm/aaaa
  pagina: number;
  trecho: string;
}

const ROTULOS =
  /(protocol(?:ad[oa]|o)|data\s+do\s+protocolo|recebid[oa]\s+em|peticionad[oa]\s+em|juntad[oa]\s+em|data\s+de\s+interposi[çc][ãa]o|assinad[oa]\s+eletronicamente\s+em|distribu[ií]d[oa]\s+em)/i;
const DATA = /(\d{2}\/\d{2}\/\d{4})/;

/**
 * Procura, no texto extraído da petição recursal, a data do carimbo/certidão de protocolo.
 * Prioriza linhas com rótulo explícito ("Protocolado em", "Data do protocolo"...) e as primeiras
 * e últimas páginas, onde ficam os carimbos. Retorna null se nada for encontrado.
 */
export function extrairDataProtocolo(paginas: string[]): ProtocoloDetectado | null {
  type C = { data: Date; pagina: number; trecho: string; peso: number };
  const achados: C[] = [];
  paginas.forEach((txt, i) => {
    const pagina = i + 1;
    const lines = txt.split('\n');
    lines.forEach((linha, k) => {
      if (!ROTULOS.test(linha)) return;
      // a data pode estar na mesma linha ou na seguinte
      const janela = `${linha} ${lines[k + 1] ?? ''}`;
      const m = janela.match(DATA);
      if (!m) return;
      const d = parseData(m[1]);
      if (!d) return;
      const explicito = /protocol|interposi/i.test(linha);
      const extremo = pagina <= 2 || pagina >= paginas.length - 1;
      achados.push({ data: d, pagina, trecho: janela.replace(/\s+/g, ' ').trim().slice(0, 160), peso: (explicito ? 2 : 0) + (extremo ? 1 : 0) });
    });
  });
  if (achados.length === 0) return null;
  achados.sort((a, b) => b.peso - a.peso || a.pagina - b.pagina);
  const m = achados[0];
  return { data: formatBR(m.data), pagina: m.pagina, trecho: m.trecho };
}
