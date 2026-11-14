import 'dotenv/config';
import {
  getMissingEnvVars,
  getPrimaryAdminEmail,
  isSupabaseConfigured,
  isValidEmail,
  normalizeEmail,
  upsertAdminAccount,
} from '../supabase.js';

function parseArgs(argv) {
  const args = { email: '', password: '', nome: '' };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--email' && argv[i + 1]) {
      args.email = argv[++i];
    } else if (token === '--password' && argv[i + 1]) {
      args.password = argv[++i];
    } else if (token === '--nome' && argv[i + 1]) {
      args.nome = argv[++i];
    } else if (!token.startsWith('--')) {
      positional.push(token);
    }
  }

  return {
    email: normalizeEmail(args.email || positional[0] || getPrimaryAdminEmail()),
    password: String(args.password || positional[1] || process.env.ADMIN_PASSWORD || '').trim(),
    nome: String(args.nome || positional[2] || process.env.ADMIN_NAME || 'Administrador').trim(),
  };
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error(
      `Erro: variáveis do Supabase ausentes (${getMissingEnvVars().join(', ')}). Configure o .env antes de executar.`
    );
    process.exit(1);
  }

  const { email, password, nome } = parseArgs(process.argv.slice(2));

  if (!isValidEmail(email)) {
    console.error(
      'Uso: npm run admin:create -- <email> <senha> [nome]\nOu defina ADMIN_EMAIL e ADMIN_PASSWORD no .env.'
    );
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Erro: a senha do administrador deve ter pelo menos 6 caracteres.');
    process.exit(1);
  }

  const { profile, created } = await upsertAdminAccount({
    email,
    password,
    nome,
    syncPassword: true,
  });

  console.log(
    created
      ? `Administrador criado e aprovado com sucesso:`
      : `Administrador atualizado/promovido com sucesso:`
  );
  console.log(`  Nome:   ${profile.nome || nome}`);
  console.log(`  Email:  ${profile.email}`);
  console.log(`  Role:   ${profile.role}`);
  console.log(`  Status: ${profile.status}`);
}

main().catch((err) => {
  console.error('Falha ao configurar administrador:', err.message);
  process.exit(1);
});
