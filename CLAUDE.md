# Controle de Dispositivos — UTIN Canoas

Sistema web de conferência anual de dispositivos (Chromebooks, tablets, e futuramente mesas e telas interativas) das ~89 unidades escolares da Secretaria Municipal da Educação de Canoas/RS. Controle de extravio: o time visita cada escola (aprox. 1 por dia) e marca o status de cada dispositivo encontrado.

Domínio em produção: **https://controle-dispositivos-utin.vercel.app**

## Stack

- Next.js 16.3.6, App Router, Turbopack, TypeScript, `src/` dir
- Node **24.x** em todo lugar: `engines` no `package.json` (a Vercel obedece e sobrepõe o painel), `@types/node` ^24 e Node local 24 — alinhados em 14/10/2026
- Testes: Vitest 5 (`devDependencies`); arquivos `*.test.ts` ao lado do arquivo testado
- Tailwind CSS v4 (tokens de tema via `@theme inline` em `globals.css`), identidade visual reaproveitada do Onboarding EJA (papel creme `--color-paper`, verde-petróleo `--color-teal`, terracota `--color-terracotta`, fontes Fraunces/Work Sans/IBM Plex Mono via `next/font`)
- Auth.js v5 (`next-auth@beta`), provedor Google, login restrito a `@canoasedu.rs.gov.br`
- Banco: Neon Postgres (serverless, free tier), driver `pg` (node-postgres) + Drizzle ORM — **não** usar `@neondatabase/serverless`, ver seção de pegadinhas
- Hospedagem: Vercel (Hobby)
- Fonte de dados dos Chromebooks: Google Admin SDK (Directory API), sincronização somente leitura
- Fonte de dados dos tablets: planilha `.csv` fornecida pela equipe, importada uma vez (não há sincronização automática — tablets não têm MDM)

## Estrutura de pastas

```
controle-dispositivos/
├── .env.local                      (nunca commitar)
├── drizzle.config.ts
├── vercel.json                     (cron do sync diário)
├── seed-escolas.ts                 (seed inicial: 46 EMEFs+CEIAs, já rodado)
├── seed-escolas2.ts                (seed: 39 EMEIs + 4 categorias administrativas, já rodado)
├── import-tablets.ts               (import único dos 5.001 tablets, já rodado; o tablets.csv foi removido do repo e do histórico — *.csv está no .gitignore)
├── seed-emails-escolas.ts          (e-mail institucional de cada escola, confere id+nome antes de gravar)
├── reset-dados-teste.ts           (reset dos dados de teste: prévia por padrão; --aplicar <endpoint-neon>)
├── seed-usuarios.ts                (contas autorizadas a entrar; só adiciona, nunca remove)
├── compilar-conferencia.ts         (compilado do fim do ano num PDF único: `npm run compilado:dev|producao`; só lê)
├── compilados/                     (saída do compilado; fora do git, tem e-mails de alunos)
└── src/
    ├── auth.ts                     (config do Auth.js: Google + trava de domínio)
    ├── proxy.ts                    (substitui middleware.ts no Next 16; protege páginas)
    ├── instrumentation.ts          (Sentry no servidor + onRequestError)
    ├── instrumentation-client.ts   (Sentry no navegador)
    ├── db/
    │   ├── index.ts                (Pool + drizzle)
    │   └── schema.ts               (todas as tabelas)
    ├── lib/
    │   ├── sync-chromebooks.ts     (lógica da sincronização via Admin SDK)
    │   ├── status.ts               (opções de status + validação, Chromebook e tablet)
    │   ├── grupos-escolas.ts       (abas da home: EMEF, EMEI e Outras Instituições)
    │   ├── conferencia.ts          (status da conferência da escola: opções, cores, quem tem)
    │   ├── telas.ts                (opções, validação e formatação das vistorias de telas)
    │   ├── relatorio.ts            (tipos do retrato da visita, código REL-AAAA-NNNN, resumos, textos fixos)
    │   ├── relatorio-dados.ts      (monta o retrato a partir do banco; conta pendentes)
    │   ├── relatorio-pdf.tsx       (PDF com @react-pdf/renderer)
    │   ├── drive.ts                (Service Account no Drive compartilhado: salva/baixa PDFs)
    │   ├── gmail.ts                (envia e-mail em nome de quem está logado, via refresh token)
    │   ├── acesso.ts               (emailAutorizado: lista de contas, com cache de 1 min)
    │   ├── usuario.ts              (exigirUsuario: sessão + lista, no início de cada server action)
    │   └── sentry-opcoes.ts        (opções comuns do Sentry: só erros, sem Replay, sem PII)
    └── app/
        ├── globals.css
        ├── layout.tsx
        ├── page.tsx                (home: 89 escolas em abas por grupo, barras de progresso + contagem de telas)
        ├── components/
        │   ├── Header.tsx
        │   ├── SeletorStatus.tsx       (checkbox "localizado" + dropdown de status; tipo chromebook|tablet)
        │   ├── FiltroStatus.tsx        (dropdown de filtro das listas de Chromebooks e tablets)
        │   ├── IdentificarUsuarioSentry.tsx (associa erros do navegador ao e-mail do usuário)
        │   ├── CampoObservacoes.tsx    (log de observações dos tablets, acumulativo)
        │   ├── ListaChromebooks.tsx    (lista + busca por patrimônio)
        │   ├── ListaTablets.tsx        (lista + busca + aviso de IMEI duplicado)
        │   ├── ReceberTablet.tsx       (traz para a escola um tablet de outra, pelo patrimônio)
        │   ├── TransferirTablet.tsx    (botão-ícone na linha do tablet + painel para mandar a outra escola)
        │   ├── AtualizarConsole.tsx    (botão "Atualizar do Console": sincroniza só a UO da escola)
        │   ├── SeletorConferencia.tsx  (dropdown do status da conferência da escola)
        │   ├── FiltroConferencia.tsx   (filtro da home pelo status da conferência)
        │   ├── BuscaDispositivo.tsx    (campo de busca da home: formulário GET para /buscar)
        │   ├── AvisoFoco.tsx           ("Mostrando só o dispositivo buscado · Mostrar todos" nas listas)
        │   ├── ListaExtraviados.tsx    (card dos extraviados: só exibição, busca no patrimônio e nas anotações)
        │   ├── ListaTelas.tsx          (telas da escola: última vistoria, histórico, edições)
        │   ├── FormularioVistoriaTela.tsx (formulário de vistoria — registrar e editar)
        │   ├── ObservacoesVisita.tsx   (aba "Observações": texto da visita que entra no relatório)
        │   ├── AbasDispositivos.tsx    (abas genéricas da página da escola)
        │   └── PainelRelatorio.tsx     (gerar relatório, abrir no Drive, enviar à escola)
        ├── entrar/page.tsx         (tela de login customizada)
        ├── buscar/page.tsx         (busca exata da home: patrimônio, nº de série ou IMEI; um resultado → vai direto)
        ├── escola/[id]/
        │   ├── page.tsx            (abas Chromebooks/Tablets/Telas da escola)
        │   ├── actions.ts          (server actions: status, observações e vistorias de telas)
        │   └── relatorio-actions.ts (server actions: gerar relatório e enviar à escola)
        └── api/
            ├── auth/[...nextauth]/route.ts
            └── sync/chromebooks/route.ts   (protegida por CRON_SECRET)
```

## Schema (Drizzle, Postgres via Neon)

```typescript
escolas: id, nome (unique), categoria ('EMEF'|'EMEI'|'CEIA'|'Administrativo'|'Extraviados'), orgUnitPath (unique, nullable),
         email, diretorNome, observacoes, observacoesAtualizadasEm, observacoesAtualizadasPor,
         consoleAtualizadoEm, statusConferencia (null='a_conferir'|'em_conferencia'|'aguardando_retorno'|'finalizado'),
         statusConferenciaEm, statusConferenciaPor

chromebooks: id, googleDeviceId (unique), escolaId, assetId, serialNumber, model, notes,
             orgUnitPath, googleStatus, status ('localizado'|'nao_localizado'|'recolhido'),
             statusAtualizadoEm, statusAtualizadoPor, lastSyncedAt,
             ultimoSyncGoogle (lastSync do Admin SDK), ultimoUsuario (recentUsers[0])

statusHistorico: id, chromebookId, statusAnterior, statusNovo, alteradoPor, alteradoEm

tablets: id, patrimonio (unique), imei, escolaId,
         status ('localizado'|'nao_localizado'|'recolhido'|'baixado'|'com_bo'),
         observacoes (texto acumulativo, tipo log), statusAtualizadoEm, statusAtualizadoPor

tabletStatusHistorico: id, tabletId, statusAnterior, statusNovo, alteradoPor, alteradoEm

telas: id, patrimonio (unique), escolaId, marca ('Smart Tech'|'Dahua'|'Quinyx'|'Outra'), criadoEm, criadoPor

telaVistorias: id, telaId, escolaId (escola onde a visita ocorreu), dataVisita (date), sala,
               funcionando ('sim'|'nao'|'somente_android'|'somente_ops'),
               emailInstalado ('sim'|'nao'|'nao_se_aplica'), internet ('cabo'|'wifi'|'nao'),
               atualizada ('sim'|'nao'|'em_andamento'), som ('sim'|'nao'|'com_chiado'),
               apps (text[]), medidasRealizadas, anotacoes,
               registradoPor, registradoEm, atualizadoPor, atualizadoEm

telaVistoriaHistorico: id, vistoriaId, alteracoes (jsonb { campo: { de, para } }), alteradoPor, alteradoEm

visitas: id, escolaId, ano, numero, versao (unique ano+numero+versao), retrato (jsonb congelado),
         diretorNome, geradoPor, geradoPorNome, geradoEm, driveFileId, driveUrl,
         enviadoPara, enviadoPor, enviadoEm

tokensGoogle: email (pk), refreshToken, atualizadoEm   (só servidor; usado para gmail.send)

usuariosAutorizados: email (pk, minúsculas), nome, criadoEm
```

Schema é aplicado via `npx drizzle-kit push` — **não há pasta de migrations versionada**, o projeto usa push direto no banco até agora.

## Infraestrutura já configurada

- **GCP**: projeto `controle-dispositivos`. Service Account `device-sync-service` com Domain-Wide Delegation (Client ID `112935184877576891103`), autorizada no Admin Console do Workspace só com o escopo `admin.directory.device.chromeos.readonly` (somente leitura). Tela de consentimento OAuth tipo "Interno". Cliente OAuth Web separado para o login (NextAuth) — Client Secret já foi rotacionado uma vez por ter aparecido numa captura de tela.
- **Neon**: projeto `controle-dispositivos`. Produção usa a connection string **com pooler** (`-pooler` no host). Branches: `production` (endpoint `ep-solitary-hill`), **`dev`** (`ep-solitary-term`, criada em 22/10/2026 a partir da produção já limpa; e-mails de todas as escolas trocados para `time.google@` para nenhum teste mandar e-mail a escola real) e `backup-pre-producao-2026-10-22` (não apagar).
- **Ambientes locais**: `.env.local` aponta para a branch **`dev`**. A string da produção fica só em `.env.producao` (ignorado pelo git) — para rodar algo em produção de propósito, definir `DATABASE_URL` a partir dele.
- **Fluxo de trabalho**: desenvolver e testar na branch `dev` do Git; o push gera a prévia fixa em https://controle-dispositivos-utin-git-dev-quitandirs-projects.vercel.app (banco `dev` do Neon, pasta de teste no Drive); o merge na `main` publica em produção. A prévia só nasce com commit novo: uma branch criada sobre um commit já enviado não gerou deploy.
- **Vercel**: projeto `controle-dispositivos-utin`. Cron diário (`vercel.json`) chama `/api/sync/chromebooks`. **O Framework Preset precisou ser corrigido manualmente para "Next.js"** — na importação inicial não foi detectado, causando 404 em todas as rotas.

### Variáveis de ambiente (nomes — valores só no `.env.local` e no painel da Vercel)
```
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_ADMIN_IMPERSONATE_EMAIL
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL        (só local; produção não precisa, Auth.js detecta sozinho)
DATABASE_URL         (produção: string com -pooler)
CRON_SECRET
DRIVE_PASTA_RELATORIOS_ID  (pasta "Relatórios de visitas" no Drive compartilhado "Time Google")
NEXT_PUBLIC_SENTRY_DSN     (sem ela o Sentry fica desligado — ex.: local)
SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN   (só no build da Vercel: envio de source maps)
```

## Decisões importantes (para não reabrir debate sem necessidade)

- Chromebooks e tablets são **tabelas separadas**, cada uma com seu próprio histórico — decisão deliberada de não abstrair cedo demais numa tabela genérica de "dispositivos".
- Sincronização de Chromebooks é **somente leitura**: nunca escreve de volta no Admin Console, e nunca sobrescreve `status`/`statusAtualizadoEm`/`statusAtualizadoPor` (esses só mudam pela ação do usuário na interface).
- **Chromebooks desprovisionados ficam fora da conferência** (desde 12/11/2026): o sync continua gravando todos, com `googleStatus = 'DEPROVISIONED'`, mas a lista da escola, os contadores da home e da escola, a contagem de pendentes e o retrato do relatório filtram com `chromebookNaConferencia()` (`src/db/filtros.ts`). Isso vale mesmo para os que já tinham sido conferidos. O status de conferência não é apagado, e o aparelho volta sozinho se for reprovisionado. `DISABLED` (perda ou roubo) continua aparecendo. Em 12/11/2026, a produção tinha 14 desprovisionados ligados a escolas, 4 deles já conferidos. Ao consultar chromebooks por escola, use esse filtro.
- **Card "Chromebooks extraviados"** (16/11/2026): é uma linha em `escolas` com a categoria `Extraviados`, ligada à UO `/Dispositivos/Extraviados`, e aparece em Outras Instituições. A página dele é **só de exibição**: mostra patrimônio, modelo, anotações do Console e última sincronização, sem status, abas, observações ou relatório. A busca procura no patrimônio e nas anotações, sem diferenciar acentos, para o time achar os extraviados da escola visitada. Quando um aparelho é localizado, o time o move para a UO da escola no Console, e ele sai do card na sincronização seguinte. A UO `/Extraviados 2.0` é de um teste e fica de fora. A UO `/Dispositivos/Inundados em maio de 2024` também fica fora do sistema.
- **Status `com_bo` dos tablets**, rótulo "Dispositivo com Boletim de Ocorrência" (16/11/2026): o extravio já foi informado à polícia. Conta como conferido. No PDF, entra numa coluna "Com BO" do resumo e numa seção própria; no e-mail, numa lista própria, sem as orientações de busca.
- **Transferência de tablets entre escolas** (16/11/2026): os tablets não têm UO; a "UO" é o `escolaId`, trocado pelo próprio sistema de dois jeitos: "Receber tablet de outra escola" (no topo da aba Tablets, pelo patrimônio, com confirmação mostrando a escola e o status atuais) e "Transferir para outra escola" (na linha do tablet). **O status nunca muda na transferência**, qualquer que seja, e o histórico de status também não. A transferência fica registrada no log de observações do tablet (`Transferido de X para Y`), sem tabela própria. O destino pode ser qualquer escola, exceto o card de extraviados. A aba Tablets aparece em toda escola, mesmo vazia, para poder receber. A action recusa se o tablet mudou de escola entre a tela e a confirmação. Relatórios já gerados não mudam (retrato congelado).
- **Transferir na lista de tablets é um botão quadrado só com ícone** (⇄), não uma frase (26/11/2026, a frase poluía a lista). Em telas grandes (`lg`), fica numa última coluna; até telas médias, embaixo do status, ao lado de "Ver / adicionar observações". O painel de escolher a escola abre embaixo da linha, na largura toda.
- **"Atualizar do Console"** (26/11/2026): botão na página de cada escola e no card dos extraviados que sincroniza **só a UO daquela unidade** (`sincronizarUO`, segundos em vez dos ~2,5 min da completa). Lê a UO e, para os aparelhos que estavam ligados à escola e não vieram, consulta um a um (`chromeosdevices.get`) onde estão agora. Aparelho excluído do Console (404) não é desligado nem apagado, como na sincronização completa: só entra na contagem. Continua só leitura e nunca mexe no status de conferência. `escolas.console_atualizado_em` guarda a última leitura (o cron completo atualiza todas as unidades com UO). Na API, `orgUnitPath` vai sem a barra inicial.
- **Status da conferência da escola** (26/11/2026): dropdown na página da escola, **só para EMEF e EMEI** (`CATEGORIAS_COM_STATUS_CONFERENCIA`; CEIA, setores e extraviados não têm). Valores: A conferir (padrão, `null` no banco), Em conferência, Aguardando retorno da escola, Finalizado. **Tudo manual**, sem mudança automática. **"Finalizado" exige um relatório do ano já enviado à escola** (a escola respondeu sobre os não localizados com fotos ou BO); a interface desabilita a opção e o servidor confere de novo. Grava quem e quando. Na home: card amarelado em "Aguardando retorno", verde-petróleo claro em "Finalizado", etiqueta com o status em todos, contagem de finalizadas nas abas EMEF/EMEI e filtro no endereço (`?grupo=emef&conferencia=finalizado`). O "Voltar" da escola volta para a aba, sem o filtro.
- **Busca de dispositivo na home** (26/11/2026): um campo só, **busca exata** (sem diferenciar maiúsculas), em patrimônio de Chromebook, tablet e tela, número de série do Chromebook e IMEI do tablet. Página `/buscar?q=`: com um resultado que aparece numa lista, redireciona para `/escola/<id>?aba=<chromebooks|tablets|telas>&foco=<id do aparelho>`, e a lista abre só com ele ("Mostrar todos" ou digitar na busca da lista desfaz). O foco vai pelo id, não pelo patrimônio, porque um Chromebook achado pelo nº de série pode não ter patrimônio. Mais de um resultado (o IMEI pode se repetir), nenhum, ou um que não aparece em lista (desprovisionado; UO fora do sistema, como "Inundados"; tablet ou tela sem escola): mostra a lista na própria página, com o aviso. Chromebook do card de extraviados abre o card.
- **Compilado do fim do ano** (`compilar-conferencia.ts`, rodado **só à mão**, quando o time decidir): um PDF único com uma capa-índice de todas as unidades (exceto extraviados) e, para cada uma, a **versão mais recente do relatório do ano baixada do Drive** (o PDF assinado a lápis). Se o Drive falhar, gera de novo a partir do retrato congelado (sem assinaturas) e avisa. Unidades sem relatório entram com a situação atual do sistema, sem assinaturas; sem dispositivos, só no índice. Precisa ser empacotado com o esbuild antes (o npm script faz isso), porque o `@react-pdf` só funciona como ESM. Ensaio no `dev` em 26/11/2026: 89 unidades, 433 páginas. **Depois do compilado vem zerar a conferência para 2027 — script ainda não feito; as regras serão combinadas quando o time avisar.**
- Tablets não têm fonte de sincronização — os dados vêm só do import único da planilha. IMEI **não é único** no banco de propósito (existem duplicidades reais na planilha, por erro de digitação histórico); a interface sinaliza em vermelho, mas não bloqueia.
- Observações de tablet são **acumulativas** (um log, com data e autor por entrada), nunca sobrescritas.
- **Telas interativas não têm lista prévia** por escola: a tela é criada (e vinculada à escola) na primeira vistoria. Se o patrimônio já existir em outra escola, a interface pede confirmação e transfere a tela; as vistorias antigas continuam ligadas a ela. Aparecem em EMEF, EMEI e CEIA (não em Administrativo).
- Vistorias de tela são **editáveis**; cada edição grava só os campos alterados em `telaVistoriaHistorico`, e a interface mostra a última alteração (registro ou edição) de cada tela.
- Apps das telas são **texto livre** (o usuário adiciona um a um), sem lista fixa. Marcas são fixas.
- O formulário de referência da equipe (timetelas.netlify.app) tem recursos "Gemini" e export Excel que são **simulações** — não foram trazidos. Exportação para planilha fica para uma fase futura.
- **Relatório de visita**: só pode ser gerado quando todos os Chromebooks e tablets da escola têm status. Grava um **retrato congelado** em `visitas.retrato` — o PDF assinado corresponde a ele mesmo que os status mudem depois. Refazer na mesma escola/ano mantém o número e sobe a versão (`REL-2026-0042 v2`); a versão anterior continua no Drive.
- PDF salvo em `Relatórios de visitas/<ano>/` (pasta do ano criada sozinha), sem subpastas por escola. A Service Account entra no Drive compartilhado como **membro** (Administrador de conteúdo) — **sem** novo escopo na delegação de domínio.
- Assinatura: **a lápis no app do Drive no tablet** (diretor + pessoa do time), não assinatura eletrônica. O Drive salva a anotação **no mesmo arquivo** (testado), então "Enviar à escola" baixa a versão atual e anexa.
- E-mail sai **da conta de quem está logado** (escopo `gmail.send` no login, refresh token na tabela `tokensGoogle`), com cópia para a própria pessoa e cópia oculta para `time.google@` (grupo do time); as respostas vão para `time.google@` (`Reply-To`). Destino: `escolas.email` (padrão com sublinhado, `emef_x@`).
- **Acesso restrito a uma lista** (`usuariosAutorizados`), mantida por script/SQL, sem tela. Conferida no login **e a cada navegação** (callback `authorized` do proxy), com cache de 1 min — remover alguém corta o acesso mesmo com sessão válida. `/entrar` trata "com sessão mas fora da lista" para não entrar em loop com o proxy.
- **Status "recolhido" do Chromebook aparece como "Aguardando tela"** (desde 09/11/2026): o aparelho fica com a UTIN esperando a escola comprar a tela para o reparo, o que pode levar mais de um ano. Só o rótulo mudou; o valor no banco continua `recolhido`, e nos tablets continua "Recolhido". No PDF, o rótulo é por tipo (`rotuloStatus`); o resumo e a seção "recolhidos pela UTIN" juntam os dois tipos.
- **Checkbox "localizado"** ao lado do dropdown: marcar grava `localizado`; desmarcar volta ao status anterior **segundo o histórico** (`reverterLocalizado*`), podendo voltar a `null` (não conferido).
- **Sentry**: só erros (`tracesSampleRate: 0`), **sem Session Replay** e `sendDefaultPii: false` — as telas mostram e-mails de alunos. Usuário identificado só pelo e-mail da equipe. Erros de login vão pelo `logger` do Auth.js; falhas de Drive/Gmail nas actions do relatório são capturadas explicitamente (elas devolvem `{ok:false}` em vez de lançar).
- Nomes de escola exigiram reconciliação manual entre três fontes (Admin Console, planilha de EMEIs, planilha de tablets) — ver o histórico completo em `/projects/.../areas/controle-dispositivos.md` na memória do Claude se for preciso entender alguma grafia específica.

## Pegadinhas já descobertas (não repetir o troubleshooting)

- **Next.js 16 renomeou `middleware.ts` para `proxy.ts`** (export `proxy`, não `middleware`).
- **`drizzle-kit push` via CLI local precisa do driver `pg`**, não do `@neondatabase/serverless` — a rede institucional bloqueia o handshake WebSocket que o driver serverless usa. O app em runtime na Vercel também usa `pg` (connection pooled), por consistência.
- **Vercel: se o Framework Preset não for detectado como Next.js**, o deploy fica "Ready" mas toda rota retorna 404 de plataforma, com zero log de runtime — confira `Settings → General → Framework Preset` antes de suspeitar de bug da plataforma.
- **Ordem de deploy com mudança de schema**: rode `npx drizzle-kit push` **antes** de dar push no código — todo push na `main` dispara deploy na Vercel, e a home quebra se consultar uma tabela que ainda não existe.
- **Nome da escola ≠ UO**: o sync liga cada Chromebook pela `org_unit_path`, nunca pelo nome. Corrigir o nome é seguro; mudar a UO exige trocar `org_unit_path` no mesmo dia em que a UO for renomeada no Admin Console, senão os aparelhos saem da escola na sincronização seguinte. Ex.: em 23/11/2026 o nome da escola id 16 virou "EMEF General Antônio de Souza **Netto**", mas a UO continua `.../Souza Neto`.
- **CEIA**: a tabela `escolas` guarda o nome completo (`CEIA Nordeste - Centro de Educação Inclusiva e Acessibilidade`), não a forma curta — já corrigido, mas vale lembrar se aparecer alguma fonte de dado nova usando o nome curto.

## Pendências / próximos passos possíveis

- ~~Ida a campo: segunda 26/10/2026~~ — **feita, sucesso**: todos os requisitos atendidos. A prática gerou a lista de novas implementações abaixo.
- ~~Fase 4, restante~~ — **feita em 04/11/2026**: branch `dev` no Git; `DATABASE_URL` e `DRIVE_PASTA_RELATORIOS_ID` separadas por ambiente na Vercel (Preview: branch `dev` do Neon e pasta de teste no Drive); URL fixa da prévia cadastrada no cliente OAuth. Testado de ponta a ponta na EMEI Bem-Me-Quer: login, status, relatório e e-mail em `time.google@`.

### Novas implementações (prioridade, vindas da ida a campo — fazer na branch `dev`)

1. ~~E-mail do relatório com cópia oculta (Cco) para o time~~ — feito em 04/11/2026 (`time.google@`, grupo do time; respostas também vão para lá).
2. ~~Novo corpo do texto do e-mail~~ — feito em 04/11/2026: patrimônios por tipo, orientação de 5 + 5 dias úteis e link da Delegacia Online; o PDF segue a mesma orientação (`relatorio.ts`). O e-mail tem versão texto e HTML (negrito marcado com `**` nos textos). Publicado em produção.
3. ~~Filtro dropdown por status~~ — feito em 04/11/2026 nas listas de tablets e de Chromebooks (`FiltroStatus.tsx`, `passaNoFiltro`). Com filtro ativo, o item some da lista ao mudar de status, de propósito: a lista encolhe conforme a conferência avança.
4. ~~Dividir a home por categoria~~ — feito em 04/11/2026: abas EMEF, EMEI e "Outras Instituições" (CEIA + Administrativo). A aba fica no endereço (`/?grupo=emei`), para sobreviver à ida e volta de uma escola; o link de voltar da escola aponta para o grupo dela (`grupos-escolas.ts`).
5. **Dois tablets na mesma escola** (adiado em 22/10): não há atualização em tempo real, e o `SeletorStatus` guarda o status no `useState` e ignora o valor novo vindo do servidor — o contador do topo atualiza, mas a lista fica desatualizada até recarregar. Proposta: (1) sincronizar o seletor com a prop quando ela mudar; (2) `router.refresh()` a cada ~30s e ao voltar o foco para o app. Última gravação vence; o histórico registra tudo.

6. **Observações da visita** (pedido do time em campo, 09/11/2026) — feito e publicado em produção (`ObservacoesVisita.tsx`, `salvarObservacoesEscola`). Nova aba "Observações" na escola, com **uma caixa de texto por escola**, salva no botão **Salvar** e editável quantas vezes for preciso durante a conferência. Limite de 2000 caracteres. Ao gerar o relatório, o texto entra no retrato congelado: no PDF, numa seção antes da declaração e das assinaturas; no e-mail, num bloco depois das orientações. Se estiver vazio, não aparece. Editar depois de gerar mostra um aviso e exige nova versão. O texto **continua salvo na escola** para os próximos relatórios do ano, sem botão de limpar. Se duas pessoas editarem ao mesmo tempo, o segundo salvamento é recusado e mostra o texto da outra pessoa. Por trás: colunas `observacoes`, `observacoes_atualizadas_em` e `observacoes_atualizadas_por` em `escolas`; `observacoes` opcional no `RetratoVisita`, porque os relatórios antigos não têm o campo.

### Demais pendências

0. ~~Reset dos dados de teste~~ — **feito em 22/10/2026** em produção (ensaiado antes na branch `ensaio-reset`). Backup no Neon: branch **`backup-pre-producao-2026-10-22`** (não apagar). Conferido por hash: dados do Workspace, cadastro dos tablets, tablets não alterados, escolas, usuários e tokens intactos; 63 tablets de teste voltaram a "não conferido"; 424 "baixado" preservados. Numeração de relatórios recomeça em REL-2026-0001. Detalhes do plano original: Ordem: ensaiar numa branch descartável do Neon → criar branch de backup → aplicar em produção → conferir. O script confere tudo antes do commit e faz rollback se algo divergir. **Antes: criar um branch no Neon como backup.** Um simples truncate dos históricos NÃO serve:
   - `chromebooks`: zerar `status`, `status_atualizado_em`, `status_atualizado_por` de todos (status só existe pelo uso do app; dados do Workspace intactos).
   - `tablets`: os alterados voltam ao status **original** = `status_anterior` do **primeiro** registro em `tablet_status_historico`; zerar `status_atualizado_em/por`. Preserva os 424 "baixado" que vieram da importação (enchente). Por isso o histórico só pode ser apagado **depois** deste passo.
   - `tablets.observacoes`: remover só as linhas acrescentadas pelo app (`[dd/mm/aaaa, hh:mm — email] ...`); manter a linha `[Importado da planilha original] ...` (4.900 tablets).
   - Apagar: `status_historico`, `tablet_status_historico`, `tela_vistoria_historico`, `tela_vistorias`, `telas` (todas são teste, inclusive a da mariah.luz@ na EMEF Carlos Drummond), `visitas`.
   - `escolas`: `diretor_nome` = null em todas; CEIA Noroeste (id 46) volta para `ceia_prof_analucia@canoasedu.rs.gov.br` (hoje está com `time.google@` para teste).
   - Manter: `escolas` (nomes/e-mails), `usuarios_autorizados`, `tokens_google`, dados do Workspace e importados.
   - ~~Fora do banco (manual): apagar PDFs de teste em Drive › Relatórios de visitas › 2026; resolver issues de teste no Sentry~~ — feito (confirmado em 03/11/2026).
0b. **Testes + defesa em profundidade** — **adiado (03/11/2026)**: fica para depois das novas implementações. **Progresso (14/10/2026):** Vitest instalado (exigiu alinhar Node/`@types/node` para 24); `src/lib/relatorio.test.ts` iniciado pelo próprio usuário com 5 testes de `codigoRelatorio`, todos passando — revisão pendente: nomes duplicados/vagos nos `it`, remover cópia comentada da função, padronizar aspas duplas e ponto e vírgula, fazer um teste falhar de propósito (etapa 3). Script `npm test` (modo watch) já criado. Próximas etapas: resto do `relatorio.ts` (`nomeArquivoRelatorio`, `resumoPorStatus`, `itensComStatus`), `telas.ts`, depois `acesso.ts` com `vi.mock` (aí será preciso configurar o alias `@/` no Vitest). Plano original: instalar Vitest (config com alias `@/`, script `npm test`) e escrever testes de unidade para `relatorio.ts` (código, nome de arquivo, `resumoPorStatus`, `itensComStatus`), `telas.ts` (`validarVistoria`, `formatarData`) e `acesso.ts` (com `vi.mock` do banco; domínio, maiúsculas, cache). ~~Criar `exigirUsuario()`~~ — feito em 14/10/2026 (`src/lib/usuario.ts`), usado nas 9 server actions. Actions que lançam erro (status, checkbox, observação) chamam direto; actions que devolvem `{ ok: false }` (telas, relatório) envolvem num try/catch — se lançassem, o componente quebraria e cairia no `global-error`. Falta testar o caso "removido da lista" e cobrir com teste. Depois: testes de integração (num branch do Neon) para o script de reset e para `reverterLocalizado*`; GitHub Actions rodando tsc + lint + testes a cada push.

1. ~~Confirmar o cron diário~~ — conferido em 20/10/2026: disparava, mas era **encerrado aos 60s** (maxDuration) depois de ~3.900 dos 11.629 aparelhos; os demais estavam sem atualizar desde 24/09. Corrigido: `maxDuration = 300` (máximo do Hobby com Fluid Compute), `fields` só com o necessário e busca da próxima página em paralelo com a gravação. Sync completa medida localmente: 157s (o Google responde ~100 aparelhos por página, ~1,3s cada). Alerta no Sentry se passar de 200s. **Ainda não conferido (03/11/2026):** olhar nos logs da Vercel quanto o cron leva lá.
2. **Fase 3**: telas interativas implementadas (vistorias por visita). **Mesas interativas ficaram para depois.**
3. ~~Considerar agrupar/filtrar a home por categoria~~ — virou o item 4 das novas implementações.
4. Decisão em aberto sobre o plano da Vercel: uso é profissional (não pessoal), o que tecnicamente exigiria o plano Pro pelos termos de uso do Hobby — ainda não resolvido.
5. ~~Remover o `tablets.csv` do repositório~~ — feito em 05/10/2026: removido de todo o histórico (filter-branch + force push). O commit antigo `7f39947` ainda fica acessível por SHA no cache do GitHub até o suporte deles purgar (chamado a abrir).
