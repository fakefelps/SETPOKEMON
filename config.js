// Configuração pública do site (GitHub Pages). NADA de segredo aqui.
// A "anon key" do Supabase é feita pra ficar no navegador: quem protege os
// dados é o RLS do banco (cada usuário só enxerga o que é dele).
// NUNCA coloque aqui a service_role key.
window.POKEDEX_CONFIG = {
  // Supabase > Project Settings > API
  supabaseUrl: "https://epsrhrbisdgprepdzcab.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwc3JocmJpc2RncHJlcGR6Y2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg0NjAsImV4cCI6MjEwNTQ4NDQ2MH0.JlyrkfyR6xOd2Pmbk9PIYMvwRKRRxiJ4mwAgwkSBFX0",

  // Só para o botão "Importar da planilha antiga" (migração, usa 1 vez).
  scriptUrlAntigo: "https://script.google.com/macros/s/AKfycbwYxmpbZ6DLfNu6cKpBkniKN3WzVfTnyGDG0WfchPMVScOidcpK1kcPgVYpzKuE4XL1/exec"
};
