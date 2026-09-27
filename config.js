// Configuração pública do site (GitHub Pages). NADA de segredo aqui.
// A "anon key" do Supabase é feita pra ficar no navegador: quem protege os
// dados é o RLS do banco (cada usuário só enxerga o que é dele).
// NUNCA coloque aqui a service_role key.
window.POKEDEX_CONFIG = {
  // Supabase > Project Settings > API
  supabaseUrl: "https://uzgncrggeggnphlbwbwv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6Z25jcmdnZWdnbnBobGJ3Ynd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0ODgyODgsImV4cCI6MjEwNjA2NDI4OH0.0fGgCmVoAVCfTN9kt3wbtn5I2cicKOE57QUb-8sT1Ps",

  // Só para o botão "Importar da planilha antiga" (migração, usa 1 vez).
  scriptUrlAntigo: "https://script.google.com/macros/s/AKfycbwYxmpbZ6DLfNu6cKpBkniKN3WzVfTnyGDG0WfchPMVScOidcpK1kcPgVYpzKuE4XL1/exec"
};
