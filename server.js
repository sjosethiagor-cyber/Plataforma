import { createApp } from './server/app.js';
import { getMissingEnvVars, isSupabaseConfigured } from './server/supabase.js';

const port = Number(process.env.PORT || 5173);
const app = await createApp();

const server = app.listen(port, () => {
  console.log(`3DSJ Precificadora rodando em http://localhost:${port}`);
  if (!isSupabaseConfigured()) {
    console.warn(
      `[Aviso] Configure as variáveis no .env: ${getMissingEnvVars().join(', ')}`
    );
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[Erro] A porta ${port} já está ocupada (provavelmente por um servidor Vite antigo).\n` +
        `Encerre o processo antigo (ex.: kill $(lsof -ti :${port})) e execute "npm run dev" novamente.\n`
    );
    process.exit(1);
  }
  throw err;
});
