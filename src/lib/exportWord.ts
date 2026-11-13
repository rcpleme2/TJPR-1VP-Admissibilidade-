import type { MinutaDecisao1VP } from '../types/admissibility';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

/** Gera um .doc (HTML aceito pelo Word) editável com a minuta, marcada como rascunho. */
export function baixarMinutaWord(minuta: MinutaDecisao1VP, numeroProcesso: string) {
  const caps = minuta.capitulosFundamentacao
    .map(
      (c) =>
        `<h3>${esc(c.tituloCapitulo)} <small>(${esc(c.incisoArt1030)})</small></h3><p>${esc(c.conteudo)}</p>` +
        (c.recursoCabivel ? `<p><i>Recurso cabível: ${esc(c.recursoCabivel)}</i></p>` : ''),
    )
    .join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Minuta</title>
<style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5}h1,h2{text-align:center}p{text-align:justify}.rascunho{color:#b91c1c;text-align:center;font-weight:bold}</style></head><body>
<p class="rascunho">RASCUNHO GERADO COM AUXÍLIO DE IA — REVISÃO OBRIGATÓRIA ANTES DE ASSINAR</p>
<h2>PODER JUDICIÁRIO DO ESTADO DO PARANÁ<br/>1ª VICE-PRESIDÊNCIA</h2>
<p>${esc(minuta.cabecalho)}</p>
<h3>I. RELATÓRIO</h3><p>${esc(minuta.relatorio)}</p>
<h3>II. FUNDAMENTAÇÃO</h3>${caps}
<h3>III. DISPOSITIVO</h3><p>${esc(minuta.dispositivoFinal)}</p>
${minuta.advertenciaRecursual ? `<p><b>${esc(minuta.advertenciaRecursual)}</b></p>` : ''}
</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `minuta-${(numeroProcesso || 'processo').replace(/[^\d.\-]/g, '')}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
