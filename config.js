// Configuração pública do site (GitHub Pages). NADA de segredo aqui.
// A "anon key" do Supabase é feita pra ficar no navegador: quem protege os
// dados é o RLS do banco (cada usuário só enxerga o que é dele).
// NUNCA coloque aqui a service_role key.
window.POKEDEX_CONFIG = {
  // Supabase > Project Settings > API
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "COLE_AQUI_A_ANON_PUBLIC_KEY",

  // Só para o botão "Importar da planilha antiga" (migração, usa 1 vez).
  scriptUrlAntigo: "https://script.google.com/macros/s/AKfycbwYxmpbZ6DLfNu6cKpBkniKN3WzVfTnyGDG0WfchPMVScOidcpK1kcPgVYpzKuE4XL1/exec"
};
