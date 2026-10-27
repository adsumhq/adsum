# Casa nova: `adsumhq` e `adsum.cin.ufpe.br`

O plano para tirar o Adsum da conta pessoal e publicá-lo no domínio do CIn,
sem que nenhum professor perca a base no caminho. Escrito em 01/10/2026, antes
de qualquer mudança no site: o que está aqui ainda não foi ao ar.

## A decisão

Combinado entre Willian Rupert e o Prof. Paulo Freitas em 29/09/2026: o Adsum
é um presente aos professores, aberto, para qualquer um no Brasil usar. Três
consequências:

- **O endereço é do CIn**, `adsum.cin.ufpe.br`. Um professor de outra
  universidade reconhece `cin.ufpe.br`; não reconhece um domínio pessoal. E o
  domínio da universidade não vence por falta de renovação.
- **O código sai da conta pessoal** para a organização `adsumhq`, com Willian
  e Paulo como donos. Quem quer contribuir enxerga um projeto, e o projeto
  não depende de uma conta só. Commits e o copyright do `LICENSE` continuam
  com quem os escreveu.
- **Os créditos aparecem**: Willian Rupert e Paulo Freitas, CIn UFPE.

Alternativas avaliadas: ficar em `willianrupert.github.io` (funciona, mas
amarra o projeto a uma pessoa) e `adsum.rlight.com.br` (domínio pessoal, que
troca "projeto de aluno" por "domínio desconhecido" e depende de renovação
anual). O `rlight.com.br` continua servindo de página pessoal que aponta para
cá. O nome `adsum` no GitHub pertence a uma conta inativa desde 2016; `hq` é
a convenção de "casa oficial do projeto".

## Por que é delicado: a origem prende os dados

IndexedDB, o handle da pasta, o service worker, o armazenamento persistente e
o PWA instalado pertencem à **origem**, não ao app. Em
`adsum.cin.ufpe.br` cada professor abre uma base vazia:

- **Chrome e Edge**: a pasta continua no disco. Escolhê-la de novo traz tudo
  de volta.
- **Safari e Firefox**: não há pasta. Sem levar os dados, o cadastro fica na
  origem antiga.
- **PWA instalado**: o service worker antigo serve o app do cache. Se o
  `sw.js` antigo responder com redirecionamento ou 404, a atualização falha
  e o app fica congelado na versão velha, calado.
- **O favorito do SIGAA** (v2) grava a origem dentro dele
  (`src/favorito/destino.ts`). Um favorito arrastado para a barra não se
  atualiza nunca.

Daí as três regras deste plano:

1. **A origem muda uma vez só.** Nada de endereço intermediário
   (`adsumhq.github.io/adsum/`), e o caminho do app (`/` ou `/app/`) se
   decide antes.
2. **Antes do favorito chegar aos professores.** Hoje só o Paulo usa o
   Adsum, e nenhum favorito foi distribuído. Mais barato não fica.
3. **O endereço antigo nunca dá 404.** Ele vira a ponte (abaixo).

## O que o GitHub faz, e o que não faz

Transferir o repositório preserva histórico, issues, estrelas e autoria, e
redireciona `github.com/willianrupert/adsum`, o `git clone` e o
`raw.githubusercontent.com`. **O GitHub Pages não é redirecionado**:
`willianrupert.github.io/adsum/` dá 404 no instante da transferência.

E recriar `willianrupert/adsum` para servir a ponte desliga os
redirecionamentos do repositório. Por isso todo endereço da conta pessoal
sai do código **antes** da transferência.

## Estado em 01/10/2026

- [x] Organização `adsumhq` criada, como "My personal account". "A business
  or institution" aceitaria termos corporativos em nome da UFPE, e isso não
  é decisão de formulário. Dá para converter depois, por quem puder assinar.
- [x] Domínio `adsum.cin.ufpe.br` adicionado para verificação na
  organização. Não clicar em Verify antes de o registro existir.
- [x] `cin.ufpe.br` tem registro CAA autorizando `letsencrypt.org`, que é o
  que o GitHub Pages usa para o HTTPS. O bloqueio mais comum em domínio de
  universidade não existe aqui. A confirmação só vem com o certificado
  emitido.
- [ ] GitHub do Paulo, para o convite de owner.
- [ ] Pedido à TI do CIn (DNS) e à Ascom (logo).
- [ ] Código da mudança, nesta branch.
- [ ] Janela da migração.

## Estado em 26/10/2026

- [x] O helpdesk do CIn (chamado #13178) criou o `CNAME`, certo. O `TXT` saiu
  com a zona duplicada no nome (`...adsum.cin.ufpe.br.cin.ufpe.br`, falta do
  ponto final no arquivo do BIND); a correção foi pedida no mesmo chamado.
- [x] O domínio está reivindicado: `adsumhq/pagina-provisoria` serve
  `adsum.cin.ufpe.br` com HTTPS, uma página sem script nem service worker que
  só aponta para o endereço de hoje. Com o `CNAME` apontando para o GitHub e
  nenhum site no domínio, outra conta podia tomá-lo. Na janela, o domínio
  sai dela antes de entrar no app, e ela é arquivada.
- [x] Itens 1 e 2 do código, abaixo.
- [ ] Verificar o domínio na organização, quando o `TXT` estiver certo.

## Estado em 27/10/2026

- [x] Item 3 do código, a ponte, com o ensaio de duas origens
  (`e2e/mudanca.spec.ts`) passando sobre a cópia real de um cofre. O porquê
  de cada escolha está no `04_historico.md`, 27/10/2026.

## O pedido ao CIn

O DNS de `cin.ufpe.br` é da TI do CIn (`dns1`, `dns2`, `dns3.cin.ufpe.br`).
O pedido vai pelo Paulo: pedido de docente anda mais rápido.

| Tipo | Nome | Valor |
|---|---|---|
| `CNAME` | `adsum.cin.ufpe.br` | `adsumhq.github.io` |
| `TXT` | `_github-pages-challenge-adsumhq.adsum.cin.ufpe.br` | `dfc47e2bde078959ae0b59471d850a` |

O valor do `TXT` não é segredo: ele fica público no DNS de qualquer jeito.
Junto com os registros:

- **DNS puro.** Sem proxy, firewall de aplicação ou certificado da UFPE na
  frente. Se o tráfego for interceptado, o GitHub não emite o certificado.
- **O registro não é apagado nem alterado sem falar com o Paulo.** Mudar a
  origem tira dos professores o acesso às bases deles.
- **O argumento:** nenhum servidor, custo ou manutenção para o CIn, e nenhum
  dado de aluno no lado da universidade. Tudo fica no computador do
  professor.

À Ascom do CIn, separado: podemos usar o logo do CIn na tela de créditos? Sem
permissão, fica o texto "CIn UFPE".

## O código da mudança

Tudo nesta branch, sem merge na `main` até a janela: qualquer push na `main`
reconstrói o site.

1. **Um ponto só para o endereço.** Feito: `src/nucleo/endereco.ts` guarda a
   origem, o caminho, o repositório e o link do guia, e o favorito, os
   Ajustes, o LEIA-ME, os testes, o e2e e os geradores do guia e do manual
   leem de lá. O `endereco.test.ts` falha se o endereço aparecer escrito à
   mão noutro arquivo do app. Ficam de fora o README, o `CLAUDE.md` e os
   `docs/`, que mudam à mão na janela.
2. **O `base` do Vite.** Feito: vem de `CAMINHO`, em `endereco.ts`, e não
   mais do nome do repositório no `publicar.yml`. No domínio próprio vira
   `/`, ou `/app/` se houver landing.
3. **A ponte.** Feito: `npm run build:ponte` gera `dist-ponte/`, que vai
   para `willianrupert.github.io/adsum/`. Os dois endereços vêm de `MUDANCA`,
   em `endereco.ts`; o ensaio os troca por origens locais com `ADSUM_MUDANCA`.
   O app recebe em `#/chegada` (`ui/Chegada.tsx`), só em base vazia. O
   desenho, como foi pensado:
   - avisa que o Adsum mudou para `adsum.cin.ufpe.br`;
   - **Levar meus dados**: abre o endereço novo e entrega a base por
     `postMessage`, de janela para janela, sem rede, com a origem conferida
     dos dois lados. Mesmo desenho do protocolo do favorito
     (`nucleo/lancar/`). O sal vai junto, como já vai no backup, e entra no
     chaveiro do endereço novo sem descartar nenhum;
   - **Baixar o backup**, para quem prefere o caminho manual;
   - serve um `sw.js` de verdade, para o PWA instalado se atualizar e mostrar
     o aviso em vez de congelar.

   Fica no ar por pelo menos um semestre. Não custa nada mantê-la.
4. **Créditos.** Uma linha no pé da tela de repouso, "Willian Rupert e Paulo
   Freitas · CIn UFPE", e um "Sobre o Adsum" em Ajustes. Nunca durante a
   chamada. O cartão de cada um (foto, papel, e-mail, LinkedIn, GitHub, Lattes)
   abre no `Sheet`. Fotos dentro do app, nunca puxadas de fora: fonte remota
   avisaria a outro servidor que o professor abriu o Adsum. Foto e contatos
   do Paulo entram com o sim dele. Isto reverte o "© 2026 Adsum" de
   `f25b58a`, e o porquê vai para o `04_historico.md`.
5. **Arquivos de comunidade:** `CONTRIBUTING.md` (as regras do `CLAUDE.md` e
   "como uma mudança chega à sala", e que dá para desenvolver sem dongle com o
   `LeitorSimulado`), `SECURITY.md` (sal e `auditoria/uids.csv` pedem canal
   privado), `CITATION.cff`, templates de issue (o de "falha em sala" já pede
   o `anonimizar_cofre.py`), `CODEOWNERS` e testes rodando em todo PR.

### Em discussão

- **O app fica em `/`**, decidido pelo autor em 26/10/2026: o mais simples.
  Sem landing na frente, `adsum.cin.ufpe.br` abre o próprio Adsum, e na
  janela `CAMINHO` (`src/nucleo/endereco.ts`) vira `/`. Quem ainda não
  conhece o Adsum o conhece pela `#/vitrine` e pelo guia. A ideia da landing
  (o que é, o que é preciso, uma ação "Abrir o Adsum", no visual do app com o
  CIn como assinatura) fica guardada; se um dia voltar, terá de morar noutro
  caminho, porque o do app não muda mais.
- **Windows e Linux.** O desenho não depende de sistema, mas nunca foi
  ensaiado neles. Até ser, o guia diz "Chrome ou Edge no computador".

## A janela da migração

Longe de aula, pelas regras do `CLAUDE.md`. Tudo de uma vez:

1. Registros do CIn no ar; domínio verificado na organização.
2. Merge desta branch, ainda no repositório pessoal, com o endereço novo já
   no código: `CASA = CIN` em `endereco.ts`.
3. Transferir `willianrupert/adsum` para `adsumhq`.
4. Recriar `willianrupert/adsum` e publicar a ponte nele: `npm run
   build:ponte` com `CASA` ainda em `PESSOAL` ou já em `CIN` (a ponte só lê
   `MUDANCA`), e o conteúdo de `dist-ponte/` no Pages do repositório novo.
5. Em `adsumhq/adsum`: Pages por GitHub Actions, domínio
   `adsum.cin.ufpe.br`, **Enforce HTTPS** assim que o certificado sair.
6. O ensaio.

Entre 3 e 4 o endereço antigo fica alguns minutos em 404. Quem estiver com o
app aberto não percebe: o service worker serve do cache, e uma falha ao
buscar o `sw.js` só adia a atualização.

## O ensaio

O do `07_ensaio_antes_da_aula.md`, com a cópia do cofre e o dongle, em
`adsum.cin.ufpe.br`, e mais:

- **Chrome**: escolher a pasta de novo e conferir que tudo voltou.
- **Safari**, com base só no navegador: Levar meus dados, e conferir turmas,
  vínculos e presenças contra o backup.
- **PWA instalado no endereço antigo**: abrir, ver o aviso da ponte, levar os
  dados. O caso do Chrome, sem o app instalado, já roda sozinho em
  `e2e/mudanca.spec.ts`; o app instalado e o Safari, ainda não.
- **O endereço antigo nunca dá 404**, nem em `#/vitrine`.
- **Os botões Manual e GitHub** abrem `adsumhq`.

## Se precisar voltar atrás

Antes do passo 3, desfazer é reverter o merge. Depois dele, o repositório
pode voltar para a conta pessoal, e o domínio sai das configurações do Pages.
O que não volta sozinho é a base de quem já levou os dados para o endereço
novo: por isso a ponte só **copia**, nunca apaga a base antiga.
