# Controle de Dispositivos — UTIN Canoas

Sistema web de conferência anual de dispositivos (Chromebooks, tablets, e futuramente mesas e telas interativas) das ~89 unidades escolares da Secretaria Municipal da Educação de Canoas/RS. Controle de extravio: o time visita cada escola (aprox. 1 por dia) e marca o status de cada dispositivo encontrado.

Domínio em produção: **https://controle-dispositivos-utin.vercel.app**

## Stack

- Next.js 16.3.6, App Router, Turbopack, TypeScript, `src/` dir
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
└── src/
    ├── auth.ts                     (config do Auth.js: Google + trava de domínio)
    ├── proxy.ts                    (substitui middleware.ts no Next 16; protege páginas)
    ├── db/
    │   ├── index.ts                (Pool + drizzle)
    │   └── schema.ts               (todas as tabelas)
    ├── lib/
    │   ├── sync-chromebooks.ts     (lógica da sincronização via Admin SDK)
    │   ├── status.ts               (opções de status + validação, Chromebook e tablet)
    │   ├── telas.ts                (opções, validação e formatação das vistorias de telas)
    │   ├── relatorio.ts            (tipos do retrato da visita, código REL-AAAA-NNNN, resumos, textos fixos)
    │   ├── relatorio-dados.ts      (monta o retrato a partir do banco; conta pendentes)
    │   ├── relatorio-pdf.tsx       (PDF com @react-pdf/renderer)
    │   ├── drive.ts                (Service Account no Drive compartilhado: salva/baixa PDFs)
    │   └── gmail.ts                (envia e-mail em nome de quem está logado, via refresh token)
    └── app/
        ├── globals.css
        ├── layout.tsx
        ├── page.tsx                (home: lista as 89 escolas, barras de progresso + contagem de telas)
        ├── components/
        │   ├── Header.tsx
        │   ├── SeletorStatus.tsx       (dropdown de status — Chromebooks, 3 estados)
        │   ├── SeletorStatusTablet.tsx (dropdown de status — tablets, 4 estados)
        │   ├── CampoObservacoes.tsx    (log de observações dos tablets, acumulativo)
        │   ├── ListaChromebooks.tsx    (lista + busca por patrimônio)
        │   ├── ListaTablets.tsx        (lista + busca + aviso de IMEI duplicado)
        │   ├── ListaTelas.tsx          (telas da escola: última vistoria, histórico, edições)
        │   ├── FormularioVistoriaTela.tsx (formulário de vistoria — registrar e editar)
        │   ├── AbasDispositivos.tsx    (abas genéricas da página da escola)
        │   └── PainelRelatorio.tsx     (gerar relatório, abrir no Drive, enviar à escola)
        ├── entrar/page.tsx         (tela de login customizada)
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
escolas: id, nome (unique), categoria ('EMEF'|'EMEI'|'CEIA'|'Administrativo'), orgUnitPath (unique, nullable),
         email, diretorNome

chromebooks: id, googleDeviceId (unique), escolaId, assetId, serialNumber, model, notes,
             orgUnitPath, googleStatus, status ('localizado'|'nao_localizado'|'recolhido'),
             statusAtualizadoEm, statusAtualizadoPor, lastSyncedAt,
             ultimoSyncGoogle (lastSync do Admin SDK), ultimoUsuario (recentUsers[0])

statusHistorico: id, chromebookId, statusAnterior, statusNovo, alteradoPor, alteradoEm

tablets: id, patrimonio (unique), imei, escolaId,
         status ('localizado'|'nao_localizado'|'recolhido'|'baixado'),
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
```

Schema é aplicado via `npx drizzle-kit push` — **não há pasta de migrations versionada**, o projeto usa push direto no banco até agora.

## Infraestrutura já configurada

- **GCP**: projeto `controle-dispositivos`. Service Account `device-sync-service` com Domain-Wide Delegation (Client ID `112935184877576891103`), autorizada no Admin Console do Workspace só com o escopo `admin.directory.device.chromeos.readonly` (somente leitura). Tela de consentimento OAuth tipo "Interno". Cliente OAuth Web separado para o login (NextAuth) — Client Secret já foi rotacionado uma vez por ter aparecido numa captura de tela.
- **Neon**: projeto `controle-dispositivos`. Produção usa a connection string **com pooler** (`-pooler` no host).
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
```

## Decisões importantes (para não reabrir debate sem necessidade)

- Chromebooks e tablets são **tabelas separadas**, cada uma com seu próprio histórico — decisão deliberada de não abstrair cedo demais numa tabela genérica de "dispositivos".
- Sincronização de Chromebooks é **somente leitura**: nunca escreve de volta no Admin Console, e nunca sobrescreve `status`/`statusAtualizadoEm`/`statusAtualizadoPor` (esses só mudam pela ação do usuário na interface).
- Tablets não têm fonte de sincronização — os dados vêm só do import único da planilha. IMEI **não é único** no banco de propósito (existem duplicidades reais na planilha, por erro de digitação histórico); a interface sinaliza em vermelho, mas não bloqueia.
- Observações de tablet são **acumulativas** (um log, com data e autor por entrada), nunca sobrescritas.
- **Telas interativas não têm lista prévia** por escola: a tela é criada (e vinculada à escola) na primeira vistoria. Se o patrimônio já existir em outra escola, a interface pede confirmação e transfere a tela; as vistorias antigas continuam ligadas a ela. Aparecem em EMEF, EMEI e CEIA (não em Administrativo).
- Vistorias de tela são **editáveis**; cada edição grava só os campos alterados em `telaVistoriaHistorico`, e a interface mostra a última alteração (registro ou edição) de cada tela.
- Apps das telas são **texto livre** (o usuário adiciona um a um), sem lista fixa. Marcas são fixas.
- O formulário de referência da equipe (timetelas.netlify.app) tem recursos "Gemini" e export Excel que são **simulações** — não foram trazidos. Exportação para planilha fica para uma fase futura.
- **Relatório de visita**: só pode ser gerado quando todos os Chromebooks e tablets da escola têm status. Grava um **retrato congelado** em `visitas.retrato` — o PDF assinado corresponde a ele mesmo que os status mudem depois. Refazer na mesma escola/ano mantém o número e sobe a versão (`REL-2026-0042 v2`); a versão anterior continua no Drive.
- PDF salvo em `Relatórios de visitas/<ano>/` (pasta do ano criada sozinha), sem subpastas por escola. A Service Account entra no Drive compartilhado como **membro** (Administrador de conteúdo) — **sem** novo escopo na delegação de domínio.
- Assinatura: **a lápis no app do Drive no tablet** (diretor + pessoa do time), não assinatura eletrônica. O Drive salva a anotação **no mesmo arquivo** (testado), então "Enviar à escola" baixa a versão atual e anexa.
- E-mail sai **da conta de quem está logado** (escopo `gmail.send` no login, refresh token na tabela `tokensGoogle`), com cópia para a própria pessoa. Destino: `escolas.email` (padrão com sublinhado, `emef_x@`).
- Nomes de escola exigiram reconciliação manual entre três fontes (Admin Console, planilha de EMEIs, planilha de tablets) — ver o histórico completo em `/projects/.../areas/controle-dispositivos.md` na memória do Claude se for preciso entender alguma grafia específica.

## Pegadinhas já descobertas (não repetir o troubleshooting)

- **Next.js 16 renomeou `middleware.ts` para `proxy.ts`** (export `proxy`, não `middleware`).
- **`drizzle-kit push` via CLI local precisa do driver `pg`**, não do `@neondatabase/serverless` — a rede institucional bloqueia o handshake WebSocket que o driver serverless usa. O app em runtime na Vercel também usa `pg` (connection pooled), por consistência.
- **Vercel: se o Framework Preset não for detectado como Next.js**, o deploy fica "Ready" mas toda rota retorna 404 de plataforma, com zero log de runtime — confira `Settings → General → Framework Preset` antes de suspeitar de bug da plataforma.
- **Ordem de deploy com mudança de schema**: rode `npx drizzle-kit push` **antes** de dar push no código — todo push na `main` dispara deploy na Vercel, e a home quebra se consultar uma tabela que ainda não existe.
- **CEIA**: a tabela `escolas` guarda o nome completo (`CEIA Nordeste - Centro de Educação Inclusiva e Acessibilidade`), não a forma curta — já corrigido, mas vale lembrar se aparecer alguma fonte de dado nova usando o nome curto.

## Pendências / próximos passos possíveis

0. **Teste do relatório (06/10/2026)**: o CEIA Noroeste (id 46) está com e-mail temporário `time.google@canoasedu.rs.gov.br`. Depois do teste, voltar para `ceia_prof_analucia@canoasedu.rs.gov.br`, apagar as visitas de teste do banco (para a numeração oficial começar em `REL-2026-0001`) e os PDFs de teste do Drive.

1. Confirmar que o cron diário de sincronização está de fato disparando sozinho na Vercel (só testamos manualmente até agora).
2. **Fase 3**: telas interativas implementadas (vistorias por visita). **Mesas interativas ficaram para depois.**
3. Considerar agrupar/filtrar a home por categoria (EMEF/EMEI/CEIA/Administrativo), já que são 89 escolas na lista.
4. Decisão em aberto sobre o plano da Vercel: uso é profissional (não pessoal), o que tecnicamente exigiria o plano Pro pelos termos de uso do Hobby — ainda não resolvido.
5. ~~Remover o `tablets.csv` do repositório~~ — feito em 05/10/2026: removido de todo o histórico (filter-branch + force push). O commit antigo `7f39947` ainda fica acessível por SHA no cache do GitHub até o suporte deles purgar (chamado a abrir).
