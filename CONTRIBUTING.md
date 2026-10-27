# Contribuir com o Adsum

Obrigado pelo interesse. O Adsum é usado em sala, na chamada de turmas de
verdade, e um defeito aparece na frente de quarenta alunos, não num teste. Por
isso o ritmo aqui é o da sala: escrever código é barato, validar não é.

## Antes de começar

Leia o [`CLAUDE.md`](CLAUDE.md). Ele não é só para assistentes de IA: é onde
estão as regras que não se quebram, com o porquê de cada uma. As que mais
pegam quem chega:

- **Dado real de turma nunca entra no repositório**, que é público. Nome,
  matrícula, login, e-mail, print do SIGAA: nada disso vira teste, exemplo ou
  imagem. Os testes usam gente inventada na forma exata da página real.
- **Só o UID público do crachá.** Nada de autenticar setor nem de tocar em
  Crypto1.
- **Os eventos só crescem.** A porta `Repositorio` não ganha
  `atualizarEvento` nem `removerEvento`.
- **Nenhum dado sai do computador** sem um gesto do professor. Não existe
  telemetria, analytics, fonte remota nem CDN.
- **Esquema do Dexie ganha versão nova**, nunca edição de uma `version(n)` já
  publicada.

Documentação, comentários e identificadores de domínio são em português. O
mapa do código está em [`docs/10_codigo.md`](docs/10_codigo.md), e o índice
dos documentos em [`docs/README.md`](docs/README.md).

## Rodar sem hardware

```bash
npm install
npm run dev
```

Ligue o **modo de ensaio** nos Ajustes: aparece o leitor simulado, e as teclas
<kbd>espaço</kbd> (próximo crachá), <kbd>N</kbd> (crachá novo) e <kbd>P</kbd>
(crachá do professor) fazem as vezes do dongle.

## Testar

```bash
npm test             # domínio, adaptadores, telas e o teste de carga
npm run lint
npm run verificar    # tudo, inclusive o Chrome de verdade
```

As telas rodam em jsdom contra o `RepositorioDexie` de verdade, sem dublê. O
teste de carga (`src/ui/Carga.test.tsx`, 300 crachás em rajada) é a régua de
desempenho: mudança no caminho do crachá que o faça passar do limite é
regressão.

Alguns testes de navegador precisam de dados que ficam fora do repositório (a
bancada do SIGAA, o cofre de um professor) e se pulam sem eles. Diga no pull
request quais rodaram.

## Uma falha em sala

Toda falha vista em sala segue a mesma ordem: **cofre anonimizado, teste que
falha, e só então o conserto.** A pasta do professor vira caso de teste pelo
`scripts/anonimizar_cofre.py`, que troca nomes, matrículas, hashes e o sal, e
recusa gravar se sobrar algum original. É a única forma de dado de turma
entrar aqui. Base limpa esconde justamente os defeitos que chegam à sala.

## O pull request

- Uma mudança por pull request, com o porquê na descrição.
- Comentário no código explica **por que**, em uma ou duas frases. Quem
  relatou e o que se tentou antes vão para `docs/04_historico.md`.
- Comentário que deixou de ser verdade é defeito, corrigido no mesmo commit.
- Texto de tela segue a voz da interface, no `CLAUDE.md`: frases curtas e
  completas, sem travessão.

Quem publica é quem mantém o projeto, logo depois de uma aula e com a volta
pronta ([`docs/07_ensaio_antes_da_aula.md`](docs/07_ensaio_antes_da_aula.md)).
Um pull request aceito pode esperar alguns dias para chegar ao ar, e isso é de
propósito.
