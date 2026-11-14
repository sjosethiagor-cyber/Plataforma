import { Router } from 'express';
import {
  createSupabaseUserClient,
  ensureConfiguredAdminSeeded,
  ensureProfileForUser,
  getAppUrl,
  getAuthContext,
  getMissingEnvVars,
  getSupabaseAdmin,
  isConfiguredAdminEmail,
  isSupabaseConfigured,
  isValidEmail,
  normalizeEmail,
} from '../supabase.js';

const router = Router();
const PENDING_OR_BLOCKED_MSG =
  'Sua conta ainda não foi aprovada. Aguarde a liberação do administrador.';

function ensureConfigMiddleware(req, res, next) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      error: `Configuração do Supabase incompleta no servidor (${getMissingEnvVars().join(', ')}).`,
    });
  }
  return next();
}

router.use(ensureConfigMiddleware);

async function sendMagicLinkForApprovedEmail(req, res, email) {
  const admin = getSupabaseAdmin();
  const supabase = createSupabaseUserClient(req, res);
  const appUrl = getAppUrl(req);

  const { data: profile } = await admin
    .from('profiles')
    .select('id, status')
    .eq('email', email)
    .maybeSingle();

  if (profile) {
    await admin
      .from('profiles')
      .update({ last_magic_link_sent_at: new Date().toISOString() })
      .eq('id', profile.id);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    if (error.status === 429 || /rate limit|seconds/i.test(error.message)) {
      return {
        ok: false,
        status: 429,
        error: 'Aguarde alguns segundos antes de solicitar um novo link mágico.',
      };
    }
    return {
      ok: false,
      status: 400,
      error: 'Não foi possível enviar o link de acesso agora. Tente novamente.',
    };
  }

  return { ok: true };
}

/**
 * GET /api/auth/me — Retorna dados do usuário autenticado e seu perfil.
 */
router.get('/me', async (req, res) => {
  try {
    const { user, profile } = await getAuthContext(req, res);
    if (!user || !profile) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    return res.json({
      user: {
        id: profile.id,
        email: profile.email,
        nome: profile.nome,
        whatsapp: profile.whatsapp,
        role: profile.role,
        status: profile.status,
      },
    });
  } catch (err) {
    console.error('Erro em /api/auth/me:', err);
    return res.status(500).json({ error: 'Erro ao verificar sessão.' });
  }
});

/**
 * POST /api/auth/signup — Cria novo cadastro (sempre nasce pendente, exceto 1º usuário / ADMIN_EMAIL).
 */
router.post('/signup', async (req, res) => {
  try {
    const nome = String(req.body?.nome || '').trim();
    const email = normalizeEmail(req.body?.email);
    const whatsapp = String(req.body?.whatsapp || '').trim() || null;
    const password = String(req.body?.password || '');

    if (nome.length < 2) {
      return res.status(400).json({ error: 'Informe seu nome completo.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (password && password.length < 6) {
      return res
        .status(400)
        .json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const admin = getSupabaseAdmin();

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.status === 'approved') {
        return res.status(409).json({
          error: 'Este e-mail já possui uma conta aprovada. Faça login para entrar.',
        });
      }
      return res.status(409).json({
        error:
          'Este e-mail já está cadastrado e aguarda liberação do administrador.',
      });
    }

    const createPayload = {
      email,
      email_confirm: true,
      user_metadata: { nome, whatsapp },
    };
    if (password) {
      createPayload.password = password;
    }

    const { data: createdUser, error: createErr } =
      await admin.auth.admin.createUser(createPayload);

    if (createErr) {
      if (/already|registered|exists/i.test(createErr.message)) {
        return res.status(409).json({
          error: 'Este e-mail já está cadastrado. Tente entrar na sua conta.',
        });
      }
      return res.status(400).json({ error: 'Não foi possível concluir o cadastro.' });
    }

    let profile = await ensureProfileForUser(createdUser.user);

    // Garante nome e whatsapp atualizados mesmo em condições de corrida do trigger
    const { data: updatedProfile } = await admin
      .from('profiles')
      .update({
        nome,
        whatsapp,
        ...(isConfiguredAdminEmail(email)
          ? { role: 'admin', status: 'approved' }
          : {}),
      })
      .eq('id', createdUser.user.id)
      .select('role, status')
      .single();

    if (updatedProfile) profile = updatedProfile;

    return res.status(201).json({
      status: profile.status,
      role: profile.role,
      message:
        profile.status === 'approved'
          ? 'Conta de administrador criada e aprovada! Você já pode entrar.'
          : 'Cadastro recebido! Sua conta está aguardando aprovação do administrador.',
    });
  } catch (err) {
    console.error('Erro em /api/auth/signup:', err);
    return res.status(500).json({ error: 'Erro interno ao criar conta.' });
  }
});

/**
 * POST /api/auth/magic-link — Envia link mágico apenas para contas aprovadas.
 */
router.post('/magic-link', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }

    const admin = getSupabaseAdmin();
    let { data: profile } = await admin
      .from('profiles')
      .select('id, email, role, status')
      .eq('email', email)
      .maybeSingle();

    // Se for o e-mail de admin definido por variável de ambiente e ainda não existir
    if (!profile && isConfiguredAdminEmail(email)) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { nome: 'Administrador' },
        });
      if (!createErr && created?.user) {
        profile = await ensureProfileForUser(created.user);
      }
    }

    if (!profile) {
      return res.status(404).json({
        error:
          'Conta não encontrada. Crie uma conta ou use "Comprou agora? Faça o primeiro acesso".',
      });
    }

    if (profile.status !== 'approved') {
      return res.status(403).json({ error: PENDING_OR_BLOCKED_MSG });
    }

    const result = await sendMagicLinkForApprovedEmail(req, res, email);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      message:
        'Link de acesso enviado! Confira sua caixa de entrada e spam. O link expira em 15 minutos e vale para um único uso.',
    });
  } catch (err) {
    console.error('Erro em /api/auth/magic-link:', err);
    return res.status(500).json({ error: 'Erro ao enviar link de acesso.' });
  }
});

/**
 * POST /api/auth/first-access — Primeiro acesso para e-mails já existentes na base de compradores.
 */
router.post('/first-access', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Informe o e-mail usado na compra.' });
    }

    const admin = getSupabaseAdmin();

    const { data: profile } = await admin
      .from('profiles')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (profile?.status === 'blocked') {
      return res.status(403).json({ error: PENDING_OR_BLOCKED_MSG });
    }

    const { data: buyer } = await admin
      .from('buyers')
      .select('id, email, nome, whatsapp, redeemed_at')
      .eq('email', email)
      .maybeSingle();

    if (!buyer) {
      if (profile?.status === 'approved') {
        const result = await sendMagicLinkForApprovedEmail(req, res, email);
        if (!result.ok) {
          return res.status(result.status).json({ error: result.error });
        }
        return res.json({
          message:
            'Sua conta já está liberada! Enviamos um link de acesso (válido por 15 minutos) para o seu e-mail.',
        });
      }

      if (profile?.status === 'pending') {
        return res.status(403).json({ error: PENDING_OR_BLOCKED_MSG });
      }

      return res.status(404).json({
        error:
          'Não encontramos esse e-mail na base de compradores. Verifique se digitou o mesmo e-mail da compra ou solicite acesso criando uma conta.',
      });
    }

    // Comprador encontrado: cria usuário (se necessário) e aprova imediatamente
    let userId = profile?.id;
    if (!userId) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            nome: buyer.nome || '',
            whatsapp: buyer.whatsapp || null,
          },
        });

      if (createErr) {
        // Pode existir em auth.users sem linha em profiles — busca lista paginada se necessário
        const { data: listData } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        const existingAuthUser = listData?.users?.find(
          (u) => normalizeEmail(u.email) === email
        );
        if (!existingAuthUser) {
          return res
            .status(500)
            .json({ error: 'Não foi possível preparar seu primeiro acesso.' });
        }
        userId = existingAuthUser.id;
        await ensureProfileForUser(existingAuthUser);
      } else {
        userId = created.user.id;
        await ensureProfileForUser(created.user);
      }
    }

    await admin
      .from('profiles')
      .update({
        status: 'approved',
        ...(buyer.nome ? { nome: buyer.nome } : {}),
        ...(buyer.whatsapp ? { whatsapp: buyer.whatsapp } : {}),
      })
      .eq('id', userId);

    if (!buyer.redeemed_at) {
      await admin
        .from('buyers')
        .update({ redeemed_at: new Date().toISOString() })
        .eq('id', buyer.id);
    }

    const result = await sendMagicLinkForApprovedEmail(req, res, email);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      message:
        'Compra confirmada! Sua conta foi liberada e enviamos seu link de primeiro acesso (válido por 15 minutos).',
    });
  } catch (err) {
    console.error('Erro em /api/auth/first-access:', err);
    return res.status(500).json({ error: 'Erro ao validar primeiro acesso.' });
  }
});

/**
 * POST /api/auth/login — Login com e-mail e senha (bloqueado para pendentes/bloqueados).
 */
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: 'Preencha e-mail e senha.' });
    }

    const admin = getSupabaseAdmin();
    if (isConfiguredAdminEmail(email)) {
      await ensureConfiguredAdminSeeded(email);
    }

    const { data: preProfile } = await admin
      .from('profiles')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (preProfile && preProfile.status !== 'approved' && !isConfiguredAdminEmail(email)) {
      return res.status(403).json({ error: PENDING_OR_BLOCKED_MSG });
    }

    const supabase = createSupabaseUserClient(req, res);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const profile = await ensureProfileForUser(data.user);
    if (profile.status !== 'approved') {
      await supabase.auth.signOut();
      return res.status(403).json({ error: PENDING_OR_BLOCKED_MSG });
    }

    await admin
      .from('profiles')
      .update({
        last_login_at: new Date().toISOString(),
        last_magic_link_sent_at: null,
      })
      .eq('id', data.user.id);

    return res.json({ redirectTo: '/' });
  } catch (err) {
    console.error('Erro em /api/auth/login:', err);
    return res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
});

/**
 * POST /api/auth/session — Fallback para fluxo implícito (#access_token) em /auth/callback.
 */
router.post('/session', async (req, res) => {
  try {
    const accessToken = String(req.body?.access_token || '');
    const refreshToken = String(req.body?.refresh_token || '');

    if (!accessToken || !refreshToken) {
      return res.status(400).json({ error: 'Tokens de sessão inválidos.' });
    }

    const supabase = createSupabaseUserClient(req, res);
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error || !data?.user) {
      return res
        .status(401)
        .json({ error: 'Link inválido ou expirado. Solicite um novo link.' });
    }

    const profile = await ensureProfileForUser(data.user);
    const admin = getSupabaseAdmin();

    // Verifica janela máxima de 15 minutos do link mágico
    if (profile.last_magic_link_sent_at) {
      const elapsedMs =
        Date.now() - new Date(profile.last_magic_link_sent_at).getTime();
      if (elapsedMs > 15 * 60 * 1000) {
        await supabase.auth.signOut();
        return res.status(401).json({
          error:
            'Este link mágico expirou (validade de 15 minutos). Solicite um novo link.',
        });
      }
    }

    if (profile.status !== 'approved') {
      return res.json({ redirectTo: '/auth/pending' });
    }

    await admin
      .from('profiles')
      .update({
        last_login_at: new Date().toISOString(),
        last_magic_link_sent_at: null,
      })
      .eq('id', data.user.id);

    return res.json({ redirectTo: '/' });
  } catch (err) {
    console.error('Erro em /api/auth/session:', err);
    return res.status(500).json({ error: 'Erro ao finalizar autenticação.' });
  }
});

/**
 * POST /api/auth/logout — Encerra a sessão e limpa cookies.
 */
router.post('/logout', async (req, res) => {
  try {
    const supabase = createSupabaseUserClient(req, res);
    await supabase.auth.signOut();
  } catch {
    // Mesmo em falha de rede com Supabase, responde ok para o cliente redirecionar
  }
  return res.json({ ok: true });
});

export default router;

