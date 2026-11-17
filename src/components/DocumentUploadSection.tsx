import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { UploadedFileItem } from '../types/admissibility';
import { LIMITES } from '../../shared/schema';
import type { CasoResumo } from '../../shared/registro';
import { ArquivoCard } from './ArquivoCard';
import { extrairPdf } from '../lib/pdfText';
import { linksArrastados, temArquivos, temLinks, trazerLinks } from '../lib/extensao';
import { ROTULO_STATUS } from './CasoCabecalho';
import { detectarPapel, papelPeloConteudo } from '../../shared/classificacao';
import { detectarInjecao } from '../../shared/injecao';
import { Botao, campo, campoArea, campoSelect, dataHora, Folha, Rotulo, TituloSecao } from './ui';

interface DocumentUploadSectionProps {
  files: UploadedFileItem[];
  onAddFile: (fileItem: UploadedFileItem) => void;
  onRemoveFile: (id: string) => void;
  onUpdateRole: (id: string, role: UploadedFileItem['role']) => void;
  onUpdateFile: (id: string, patch: Partial<UploadedFileItem>) => void;
  notes: string;
  setNotes: (val: string) => void;
  appealType: string;
  setAppealType: (val: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onLoadSample: () => void;
  onError: (msg: string) => void;
  stageMessage: string;
  motor: { nome: string; pronto: boolean };
  onConfigurar: () => void;
  prazoForm: React.ReactNode;
  canAnalyze: boolean;
  pendencias: string[];
  casos: CasoResumo[];
  buscaCasos: string;
  onBuscaCasos: (q: string) => void;
  onOpenCaso: (id: string) => void;
  onDeleteCaso: (c: CasoResumo) => void;
  podeExcluir: (c: CasoResumo) => boolean;
  onCancel: () => void;
}

const PAPEIS = [
  { v: 'acordao' as const, r: 'Acórdão recorrido' },
  { v: 'acordao_embargos' as const, r: 'Acórdão (ED)' },
  { v: 'recurso_especial' as const, r: 'Recurso especial' },
  { v: 'recurso_extraordinario' as const, r: 'Recurso extraord.' },
  { v: 'guia_preparo' as const, r: 'Guia de custas' },
  { v: 'outro' as const, r: 'Outro documento' },
];

export const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  files,
  onAddFile,
  onRemoveFile,
  onUpdateRole,
  onUpdateFile,
  notes,
  setNotes,
  appealType,
  setAppealType,
  onAnalyze,
  isAnalyzing,
  onLoadSample,
  onError,
  stageMessage,
  motor,
  onConfigurar,
  prazoForm,
  canAnalyze,
  pendencias,
  casos,
  buscaCasos,
  onBuscaCasos,
  onOpenCaso,
  onDeleteCaso,
  podeExcluir,
  onCancel,
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelection = async (fileList: FileList | File[], roleOverride?: UploadedFileItem['role']) => {
    let quantidade = files.length;
    for (const file of Array.from(fileList)) {
      const ehPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!ehPdf) {
        onError(`"${file.name}" não é um PDF e foi ignorado.`);
        continue;
      }
      if (quantidade >= LIMITES.maxArquivos) {
        onError(`Limite de ${LIMITES.maxArquivos} arquivos por análise atingido.`);
        break;
      }
      if (file.size > 60 * 1048576) {
        onError(`"${file.name}" tem mais de 60 MB e não pode ser processado no navegador.`);
        continue;
      }
      quantidade++;
      const id = crypto.randomUUID();
      // o espaço escolhido manda; no espaço "Recursos", o nome ainda separa especial de extraordinário
      const peloNome = detectarPapel(file.name, roleOverride ?? 'recurso_especial');
      const ehRecurso = (p: string) => p === 'recurso_especial' || p === 'recurso_extraordinario';
      const papel = !roleOverride || (ehRecurso(roleOverride) && ehRecurso(peloNome)) ? peloNome : roleOverride;
      onAddFile({
        id,
        name: file.name,
        size: file.size,
        role: papel,
        label: file.name.replace(/\.[^/.]+$/, ''),
        arquivo: file,
        modo: 'texto',
        extraindo: true,
      });
      try {
        const r = await extrairPdf(file);
        if (r.escaneado || r.caracteres === 0) {
          onUpdateFile(id, {
            extraindo: false,
            modo: 'pdf',
            paginas: r.paginas,
            avisoExtracao: 'PDF sem camada de texto (escaneado): será enviado como PDF, com mais tokens. Se possível, use uma versão pesquisável.',
          });
        } else {
          const novoPapel = papelPeloConteudo(papel, r.texto);
          const alertas = detectarInjecao(r.texto, file.name);
          onUpdateFile(id, {
            ...(novoPapel !== papel ? { role: novoPapel, avisoClassificacao: 'Classificado como acórdão dos embargos: o texto decide embargos de declaração.' } : {}),
            ...(alertas.length ? { alertasInjecao: alertas } : {}),
            extraindo: false,
            modo: 'texto',
            paginas: r.paginas,
            textPreview: r.texto,
            caracteres: r.caracteres,
            linhasRemovidas: r.linhasRemovidas,
            protocolo: r.protocolo ?? undefined,
          });
        }
      } catch {
        onUpdateFile(id, {
          extraindo: false,
          modo: 'pdf',
          avisoExtracao: 'Não foi possível ler o texto deste PDF: será enviado o arquivo original.',
        });
      }
    }
  };

  const [trazendo, setTrazendo] = useState(0);

  /**
   * Arquivos ou links soltos: numa peça do índice (o tipo é o dela) ou em qualquer outro ponto da tela (o tipo vem do
   * nome e do conteúdo). Links de outro site são baixados pela extensão do Chrome ou, sem ela, pelo servidor.
   */
  const receber = async (dt: DataTransfer, papel?: UploadedFileItem['role']) => {
    if (dt.files && dt.files.length > 0) return handleFileSelection(dt.files, papel);
    const links = linksArrastados(dt);
    if (links.length === 0) return;
    setTrazendo((n) => n + links.length);
    await Promise.all(
      trazerLinks(links).map(async ({ link, arquivo }) => {
        try {
          await handleFileSelection([await arquivo], papel);
        } catch (e) {
          onError(`${link.nome || link.url}: ${(e as Error).message}`);
        } finally {
          setTrazendo((n) => n - 1);
        }
      }),
    );
  };
  const receberRef = useRef(receber);
  receberRef.current = receber;
  const profundidade = useRef(0);
  const [alvo, setAlvo] = useState<UploadedFileItem['role'] | null>(null);

  useEffect(() => {
    const aceita = (e: DragEvent) => temArquivos(e.dataTransfer) || temLinks(e.dataTransfer);
    const entrar = (e: DragEvent) => {
      if (!aceita(e)) return;
      profundidade.current++;
      setDragActive(true);
    };
    const sobre = (e: DragEvent) => {
      if (!aceita(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const sair = () => {
      profundidade.current = Math.max(0, profundidade.current - 1);
      if (profundidade.current === 0) {
        setDragActive(false);
        setAlvo(null);
      }
    };
    const soltar = (e: DragEvent) => {
      profundidade.current = 0;
      setDragActive(false);
      setAlvo(null);
      if (!e.dataTransfer || !aceita(e)) return;
      e.preventDefault();
      receberRef.current(e.dataTransfer);
    };
    window.addEventListener('dragenter', entrar);
    window.addEventListener('dragover', sobre);
    window.addEventListener('dragleave', sair);
    window.addEventListener('drop', soltar);
    return () => {
      window.removeEventListener('dragenter', entrar);
      window.removeEventListener('dragover', sobre);
      window.removeEventListener('dragleave', sair);
      window.removeEventListener('drop', soltar);
    };
  }, []);

  /** Soltar sobre uma peça do índice: o arquivo entra com o tipo dela. */
  const alvoDaPeca = (papel: UploadedFileItem['role']) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (alvo !== papel) setAlvo(papel);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      profundidade.current = 0;
      setDragActive(false);
      setAlvo(null);
      receber(e.dataTransfer, papel);
    },
  });

  const lista = (...papeis: UploadedFileItem['role'][]) => files.filter((f) => papeis.includes(f.role));
  const PECAS: Array<{ papel: UploadedFileItem['role']; titulo: string; dica: string; exigencia: 'obrigatória' | 'se houver' | 'opcional'; arquivos: UploadedFileItem[]; multiplo: boolean }> = [
    { papel: 'acordao', titulo: 'Acórdão recorrido', dica: 'O acórdão que julgou a apelação ou o agravo.', exigencia: 'obrigatória', arquivos: lista('acordao'), multiplo: false },
    { papel: 'acordao_embargos', titulo: 'Acórdão dos embargos de declaração', dica: 'Se houve embargos. Acórdão que acolhe ou rejeita embargos é reconhecido pelo texto.', exigencia: 'se houver', arquivos: lista('acordao_embargos'), multiplo: false },
    { papel: 'recurso_especial', titulo: 'Recursos', dica: 'Especial e extraordinário, juntos ou separados; o tipo vem do nome do arquivo.', exigencia: 'obrigatória', arquivos: lista('recurso_especial', 'recurso_extraordinario'), multiplo: true },
    { papel: 'guia_preparo', titulo: 'Guias de custas e comprovantes', dica: 'Nomes com preparo, custas, guia ou pagamento entram aqui sozinhos.', exigencia: 'se houver', arquivos: lista('guia_preparo'), multiplo: true },
    { papel: 'outro', titulo: 'Outros documentos', dica: 'Decisão de gratuidade, procuração, contrarrazões ou outra peça útil.', exigencia: 'opcional', arquivos: lista('outro'), multiplo: true },
  ];

  const anexar = (papel: UploadedFileItem['role'], multiplo: boolean, titulo: string) => (
    <label className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-toga transition-colors hover:bg-toga-claro focus-within:ring-2 focus-within:ring-toga/30">
      <Plus className="size-3.5" />
      Anexar
      <input
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiplo}
        aria-label={`Anexar: ${titulo}`}
        className="sr-only"
        onChange={async (e) => {
          if (e.target.files) await handleFileSelection(e.target.files, papel);
          e.target.value = '';
        }}
      />
    </label>
  );

  return (
    <div className="space-y-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <h1 className="font-serif text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-tinta">Novo exame</h1>
          <p className="mt-2 max-w-xl text-[15px] text-tinta-2">Anexe o acórdão recorrido, os recursos e, se houver, as guias de custas. O texto dos PDFs é lido aqui no navegador antes de qualquer envio.</p>

          <section aria-labelledby="autos-titulo" className="mt-8 overflow-hidden rounded-lg border border-linha bg-folha">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-linha px-5 py-3.5">
              <h2 id="autos-titulo" className="font-serif text-[19px] font-semibold text-tinta">
                Peças do exame
              </h2>
              <p className="text-[13px] text-tinta-3" aria-live="polite">
                {trazendo > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-toga">
                    <Loader2 className="size-3.5 animate-spin" />
                    Trazendo {trazendo === 1 ? '1 documento' : `${trazendo} documentos`}…
                  </span>
                ) : (
                  'Arraste PDFs ou links de outro site para uma peça ou para qualquer ponto da tela.'
                )}
              </p>
            </header>
            <ol className="divide-y divide-linha">
              {PECAS.map((p) => {
                const juntada = p.arquivos.length > 0;
                const sobre = dragActive && alvo === p.papel;
                return (
                  <li key={p.papel} {...alvoDaPeca(p.papel)} className={`relative transition-colors ${sobre ? 'bg-toga-claro' : ''}`}>
                    {/* lombada: a situação de cada peça na borda do índice */}
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-[3px] ${juntada ? 'bg-toga' : p.exigencia === 'obrigatória' ? 'bg-atencao/70' : 'bg-transparent'}`}
                    />
                    <div className="flex items-start gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5">
                          <h3 className="text-[15px] font-semibold text-tinta">{p.titulo}</h3>
                          <span className={`text-[12px] ${juntada ? 'text-ok' : p.exigencia === 'obrigatória' ? 'text-atencao' : 'text-tinta-3'}`}>
                            {juntada ? (p.arquivos.length === 1 ? 'juntada' : `${p.arquivos.length} arquivos`) : p.exigencia === 'obrigatória' ? 'pendente' : p.exigencia}
                          </span>
                        </div>
                        {!juntada && <p className="mt-0.5 text-[13px] text-tinta-3">{p.dica}</p>}
                      </div>
                      {anexar(p.papel, p.multiplo, p.titulo)}
                    </div>
                    {juntada && (
                      <ul className="mx-5 mb-2 divide-y divide-linha border-t border-linha">
                        {p.arquivos.map((file) => (
                          <ArquivoCard key={file.id} file={file} papeis={PAPEIS} onUpdateRole={onUpdateRole} onRemove={onRemoveFile} onUpdate={onUpdateFile} />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {dragActive && (
            <div aria-hidden className="pointer-events-none fixed inset-3 z-40 flex items-end justify-center rounded-xl border-2 border-dashed border-toga/60 bg-toga/[0.04] pb-8">
              <p className="rounded-full bg-toga px-4 py-2 text-sm font-medium text-white shadow-lg">
                {alvo ? `Solte para juntar como: ${PECAS.find((x) => x.papel === alvo)?.titulo}` : 'Solte para juntar; o tipo de cada peça é reconhecido pelo nome e pelo texto'}
              </p>
            </div>
          )}

          <div className="mt-10 space-y-8">
            <div>
              <Rotulo htmlFor="notas" dica="opcional">
                Observações para a análise
              </Rotulo>
              <textarea
                id="notas"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: gratuidade deferida em 1º grau; feriado municipal comprovado no mov. 15.2"
                rows={3}
                className={`${campoArea} resize-y`}
              />
            </div>
          </div>
        </div>

        <aside className="lg:pt-[5.5rem]">
          <Folha as="div" className="space-y-5 p-5 lg:sticky lg:top-6">
            {prazoForm}

            <div className="border-t border-linha pt-5">
              <Rotulo htmlFor="foco">Recursos a examinar</Rotulo>
              <select id="foco" value={appealType} onChange={(e) => setAppealType(e.target.value)} className={campoSelect}>
                <option value="auto">Identificar automaticamente</option>
                <option value="resp">Recurso especial (STJ)</option>
                <option value="re">Recurso extraordinário (STF)</option>
                <option value="ambos">Ambos, em conjunto</option>
              </select>
            </div>

            <div className="flex items-baseline justify-between gap-3 border-t border-linha pt-4 text-[13px]">
              <span className="text-tinta-3">
                Motor: <span className="text-tinta">{motor.nome}</span>
                {!motor.pronto && <span className="text-atencao">, sem chave</span>}
              </span>
              <button type="button" onClick={onConfigurar} className="font-medium text-toga underline-offset-2 hover:underline">
                {motor.pronto ? 'Alterar' : 'Configurar'}
              </button>
            </div>

            <div className="space-y-3 border-t border-linha pt-5">

              {isAnalyzing ? (
                <div role="status" aria-live="polite" className="space-y-2.5">
                  <Botao variante="primario" disabled className="w-full !opacity-100">
                    <Loader2 className="size-4 animate-spin" />
                    Analisando
                  </Botao>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-tinta-3">{stageMessage || 'Iniciando…'}</span>
                    <button type="button" onClick={onCancel} className="text-tinta-2 underline underline-offset-2 hover:text-tinta">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Botao variante="primario" disabled={!canAnalyze} onClick={onAnalyze} className="w-full">
                    Analisar admissibilidade
                  </Botao>
                  {pendencias.length > 0 && (
                    <div className="text-[13px] text-tinta-3">
                      <p>Para analisar, falta:</p>
                      <ul className="mt-1 space-y-0.5">
                        {pendencias.map((p) => (
                          <li key={p} className="flex gap-2">
                            <span aria-hidden className="mt-[7px] h-px w-2 shrink-0 bg-tinta-3" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            <button type="button" disabled={isAnalyzing} onClick={onLoadSample} className="text-[13px] text-tinta-3 underline-offset-2 hover:text-tinta hover:underline disabled:opacity-50">
              Abrir um caso de exemplo
            </button>
          </Folha>
        </aside>
      </div>

      <section aria-labelledby="registros-titulo">
        <div className="flex flex-col gap-3 border-b border-linha pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <TituloSecao id="registros-titulo">Registros da equipe</TituloSecao>
            <p className="mt-1 text-[13px] text-tinta-3">Guardam apenas os dados extraídos e as revisões; os PDFs nunca são gravados.</p>
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tinta-3" />
            <input
              type="search"
              aria-label="Buscar registros por número, matéria ou autor"
              value={buscaCasos}
              onChange={(e) => onBuscaCasos(e.target.value)}
              placeholder="Número, matéria ou autor"
              className={`${campo} pl-8`}
            />
          </div>
        </div>

        {casos.length === 0 ? (
          <p className="py-6 text-sm text-tinta-3">{buscaCasos ? 'Nenhum registro corresponde à busca.' : 'Nenhum registro ainda. As análises feitas aparecem aqui.'}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sr-only sm:not-sr-only">
              <tr className="text-left text-[13px] text-tinta-3">
                <th className="py-2.5 pr-4 font-normal">Processo</th>
                <th className="hidden py-2.5 pr-4 font-normal md:table-cell">Situação</th>
                <th className="hidden py-2.5 pr-4 font-normal sm:table-cell">Última alteração</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-linha border-t border-linha sm:border-t-0">
              {casos.map((c) => (
                <tr key={c.id} className="group">
                  <td className="py-3 pr-4 align-top">
                    <button type="button" onClick={() => onOpenCaso(c.id)} className="num text-left font-medium text-toga hover:underline underline-offset-2">
                      {c.numeroProcesso}
                    </button>
                    <span className="mt-0.5 block text-[13px] text-tinta-3 sm:hidden">
                      {ROTULO_STATUS[c.status]}, {c.atualizadoPor.nome}, {dataHora(c.atualizadoEm)}
                    </span>
                  </td>
                  <td className="hidden py-3 pr-4 align-top text-tinta-2 md:table-cell">{ROTULO_STATUS[c.status]}</td>
                  <td className="hidden py-3 pr-4 align-top text-tinta-2 sm:table-cell">
                    {c.atualizadoPor.nome} <span className="num text-tinta-3">em {dataHora(c.atualizadoEm)}, versão {c.versao}</span>
                  </td>
                  <td className="py-2 text-right align-top">
                    {podeExcluir(c) && (
                      <button
                        type="button"
                        onClick={() => onDeleteCaso(c)}
                        aria-label={`Excluir registro ${c.numeroProcesso}`}
                        className="rounded-md p-1.5 text-tinta-3 opacity-60 transition hover:bg-obice-fundo hover:text-obice group-hover:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
