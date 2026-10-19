// "Criado por": no repouso, que é a tela projetada enquanto a turma entra, e
// nas telas de quem está conhecendo o Adsum (escolher a pasta, o conselho do
// navegador, a primeira turma), onde abre "Sobre o Adsum". Na chamada, não:
// lá a tela é da pergunta "meu nome entrou?". Sem `aoAbrir` (vitrine), aparece
// sem abrir.

export function Creditos({ aoAbrir }: { aoAbrir?: () => void }) {
  return (
    // O chevron é o sinal de "abre mais", como nos Ajustes do iOS.
    <button className="repouso__creditos" onClick={aoAbrir} disabled={!aoAbrir}>
      <span className="repouso__creditos-texto">
        <span className="repouso__creditos-rotulo">Criado por</span>
        <span className="repouso__creditos-nomes">
          Prof. Paulo Freitas <span className="repouso__creditos-e">e</span> Willian Rupert
        </span>
      </span>
      {aoAbrir && (
        <span className="repouso__creditos-seta" aria-hidden="true">
          ›
        </span>
      )}
    </button>
  )
}
