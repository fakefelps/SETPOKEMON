// Configuração fixa do site — fica pública no GitHub Pages, então NÃO coloque
// segredos aqui (chave de API paga, senha, etc). O apiKey da pokemontcg.io é
// opcional e de uso público, então tudo bem deixá-lo aqui também se você tiver um.
window.POKEDEX_CONFIG = {
  // URL do Web App do Apps Script (Implantar > Gerenciar implantações > copiar /exec).
  // Confirmado ativo em 09/08/2026 (action=get e action=liga testados e funcionando).
  scriptUrl: "https://script.google.com/macros/s/AKfycbwYxmpbZ6DLfNu6cKpBkniKN3WzVfTnyGDG0WfchPMVScOidcpK1kcPgVYpzKuE4XL1/exec",
  // Chave da Pokémon TCG API (dev.pokemontcg.io) — sobe o limite de 1.000/dia (30/min)
  // para 20.000/dia. Se um dia quiser trocar, gere outra no portal e substitua aqui.
  apiKey: "15ab449c-1bbd-4893-b296-c57091cbf0a9",
  // Nome padrão mostrado no topo ("Pokédex de Felipe"). Só é usado se o
  // aparelho ainda não tiver um nome salvo localmente (o botão de editar
  // no cabeçalho sempre pode trocar, e o que for digitado lá tem prioridade).
  owner: "Felipe"
};
