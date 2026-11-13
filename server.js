import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import authRouter from './server/routes/auth.js';
import adminRouter from './server/routes/admin.js';
import {
  createSupabaseUserClient,
  ensureProfileForUser,
  getAuthContext,
  getMissingEnvVars,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from './server/supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 5173);

const PROTECTED_CALC_ASSETS = new Set([
  '/app.js',
  '/calculator.js',
  '/gcodeParser.js',
  '/presets.js',
]);

async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  let vite = null;
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }

  async function renderHtmlPage(req, res, relativeHtmlPath) {
    if (isProd) {
      const distRoot = resolve(__dirname, 'dist');
      const distPath = resolve(distRoot, relativeHtmlPath);
      if (!existsSync(distPath)) {
        return res.status(404).send('Página não encontrada. Execute npm run build.');
      }
      return res.sendFile(relativeHtmlPath, { root: distRoot });
    }

    const filePath = resolve(__dirname, relativeHtmlPath);
    const rawHtml = await readFile(filePath, 'utf8');
    const html = await vite.transformIndexHtml(req.originalUrl, rawHtml);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // Rotas de API
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  // Callback do Link Mágico (PKCE `code` ou SSR `token_hash`)
  app.get('/auth/callback', async (req, res) => {
    try {
      if (!isSupabaseConfigured()) {
        return renderHtmlPage(req, res, 'auth/callback/index.html');
      }

      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const tokenHash =
        typeof req.query.token_hash === 'string' ? req.query.token_hash : '';
      const type =
        typeof req.query.type === 'string' ? req.query.type : 'magiclink';
      const errorDesc =
        typeof req.query.error_description === 'string'
          ? req.query.error_description
          : '';

      if (errorDesc) {
        return res.redirect('/auth/callback?status=expired');
      }

      if (code || tokenHash) {
        const supabase = createSupabaseUserClient(req, res);
        let authResult;
        if (code) {
          authResult = await supabase.auth.exchangeCodeForSession(code);
        } else {
          authResult = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
        }

        if (authResult.error || !authResult.data?.user) {
          return res.redirect('/auth/callback?status=expired');
        }

        const profile = await ensureProfileForUser(authResult.data.user);
        const admin = getSupabaseAdmin();

        // Garantia adicional de validade máxima de 15 minutos
        if (profile.last_magic_link_sent_at) {
          const elapsedMs =
            Date.now() - new Date(profile.last_magic_link_sent_at).getTime();
          if (elapsedMs > 15 * 60 * 1000) {
            await supabase.auth.signOut();
            return res.redirect('/auth/callback?status=expired');
          }
        }

        if (profile.status !== 'approved') {
          return res.redirect('/auth/pending');
        }

        await admin
          .from('profiles')
          .update({
            last_login_at: new Date().toISOString(),
            last_magic_link_sent_at: null,
          })
          .eq('id', authResult.data.user.id);

        return res.redirect('/');
      }

      // Caso venha por fragmento (#access_token=...) ou ?status=expired, o HTML cuida
      return renderHtmlPage(req, res, 'auth/callback/index.html');
    } catch (err) {
      console.error('Erro em /auth/callback:', err);
      return res.redirect('/auth/callback?status=expired');
    }
  });

  // Rotas públicas de autenticação
  app.get(['/auth/login', '/auth/login/'], async (req, res) => {
    try {
      const { user, profile } = await getAuthContext(req, res);
      if (user && profile?.status === 'approved') {
        return res.redirect('/');
      }
      return renderHtmlPage(req, res, 'auth/login/index.html');
    } catch {
      return renderHtmlPage(req, res, 'auth/login/index.html');
    }
  });

  app.get(['/auth/signup', '/auth/signup/'], async (req, res) => {
    try {
      const { user, profile } = await getAuthContext(req, res);
      if (user && profile?.status === 'approved') {
        return res.redirect('/');
      }
      return renderHtmlPage(req, res, 'auth/signup/index.html');
    } catch {
      return renderHtmlPage(req, res, 'auth/signup/index.html');
    }
  });

  // Página "Aguardando aprovação"
  app.get(
    ['/auth/pending', '/auth/pending/', '/aguardando-aprovacao'],
    async (req, res) => {
      try {
        const { user, profile, configMissing } = await getAuthContext(req, res);
        if (configMissing) return res.redirect('/auth/login');
        if (!user || !profile) return res.redirect('/auth/login');
        if (profile.status === 'approved') return res.redirect('/');
        return renderHtmlPage(req, res, 'auth/pending/index.html');
      } catch {
        return res.redirect('/auth/login');
      }
    }
  );

  // Painel Administrativo (somente role = 'admin' e status = 'approved')
  app.get(['/admin', '/admin/', '/admin/index.html'], async (req, res) => {
    try {
      const { user, profile, configMissing } = await getAuthContext(req, res);
      if (configMissing || !user || !profile) {
        return res.redirect('/auth/login');
      }
      if (profile.status !== 'approved') {
        return res.redirect('/auth/pending');
      }
      if (profile.role !== 'admin') {
        return res.redirect('/');
      }
      return renderHtmlPage(req, res, 'admin/index.html');
    } catch {
      return res.redirect('/auth/login');
    }
  });

  // Proteção dos módulos JS da calculadora contra acesso não autorizado
  app.use(async (req, res, next) => {
    if (!PROTECTED_CALC_ASSETS.has(req.path)) {
      return next();
    }
    try {
      const { user, profile } = await getAuthContext(req, res);
      if (!user || profile?.status !== 'approved') {
        return res.status(401).type('text/plain').send('Acesso não autorizado.');
      }
      return next();
    } catch {
      return res.status(401).type('text/plain').send('Acesso não autorizado.');
    }
  });

  // Rota principal da Calculadora (protegida por middleware)
  app.get(['/', '/index.html'], async (req, res) => {
    try {
      const { user, profile, configMissing } = await getAuthContext(req, res);
      if (configMissing) {
        return res.redirect('/auth/login');
      }
      if (!user || !profile) {
        return res.redirect('/auth/login');
      }
      if (profile.status !== 'approved') {
        return res.redirect('/auth/pending');
      }
      return renderHtmlPage(req, res, 'index.html');
    } catch (err) {
      console.error('Erro no middleware da calculadora:', err);
      return res.redirect('/auth/login');
    }
  });

  // Assets estáticos (Vite em dev, dist/ em produção)
  if (vite) {
    app.use(vite.middlewares);
  } else {
    app.use(express.static(resolve(__dirname, 'dist'), { index: false }));
  }

  return app;
}

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
