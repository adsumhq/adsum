# Segurança

## Como avisar

**Não abra issue pública** para uma falha de segurança. Escreva para
wnrj@cin.ufpe.br, com o que você encontrou e como reproduzir. A resposta vem
em poucos dias, e o conserto é combinado com você antes de ser publicado.

Não mande dado real de turma no aviso. Se for preciso mostrar uma pasta do
Adsum, use uma inventada ou anonimizada (`scripts/anonimizar_cofre.py`).

## O que o Adsum protege

O Adsum não tem servidor: tudo fica no navegador e na pasta do computador do
professor. O que importa proteger está lá.

- **O sal** (`config.json`). Cada crachá é guardado como `uid_hash`, os 8
  primeiros bytes de SHA-256(sal ‖ UID). Sem o sal, quem obtiver o arquivo
  de registros recupera o UID por força bruta e pode clonar o crachá.
- **`auditoria/uids.csv`**, uma exceção temporária da fase de testes: guarda
  o UID real de cada crachá lido. É o arquivo mais sensível da pasta, e nunca
  sai dela.
- **As conversas entre janelas.** O favorito do SIGAA e a mudança de endereço
  (`docs/14_casa_nova.md`) trocam dados por `postMessage`, com a origem
  conferida dos dois lados. Uma forma de outra origem falar com essas janelas
  é falha de segurança.
- **Nenhum dado sai do computador** sem gesto do professor. Uma requisição de
  rede que não seja o download do guia é falha.

## O que está fora

- **Clonar um crachá** que alguém teve em mãos. O UID trafega em claro na
  leitura, por desenho do cartão, e o professor está na sala. Ver o
  `CLAUDE.md`, "O problema em aberto".
- **Quem já tem acesso ao computador e à pasta** do professor. A pasta é o
  backup, e quem a tem tem a base.
