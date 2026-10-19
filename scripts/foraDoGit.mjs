// O que o repositório usa e não versiona: a página do SIGAA de ensaio (com os
// scripts da UFRN) e o perfil do Chrome da demonstração. Mora em
// `fora-do-git/`, na pasta principal do repositório, ignorada pelo
// `.git/info/exclude`. O caminho sai do git, e por isso é o mesmo de qualquer
// pasta de trabalho (`git worktree`).

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'

const comum = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: import.meta.dirname, encoding: 'utf-8' }).trim()

export const FORA_DO_GIT = join(dirname(comum), 'fora-do-git')
