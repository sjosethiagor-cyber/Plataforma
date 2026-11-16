import { Router } from 'express';
import {
  createSupabaseUserClient,
  ensureProfileForUser,
  getAppUrl,
  getAuthContext,
  isValidEmail,
  normalizeEmail,
  sendApprovalEmailIfConfigured,
  tryGetSupabaseAdmin,
} from '../supabase.js';

const router = Router();

function getAdminDbClient(req, res) {
  return tryGetSupabaseAdmin() || createSupabaseUserClient(req, res);
}

async function requireAdmin(req, res, next) {
  try {
    const { user, profile, supabase, configMissing } = await getAuthContext(req, res);
    if (configMissing) {
      return res.status(503).json({ error: 'Supabase não configurado no servidor.' });
    }
    if (!user || !profile) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    if (profile.status !== 'approved' || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    req.adminProfile = profile;
    req.userSupabase = supabase;
    return next();
  } catch (err) {
    console.error('Erro na verificação de admin:', err);
    return res.status(500).json({ error: 'Erro ao validar permissões.' });
  }
}

router.use(requireAdmin);

/**
 * GET /api/admin/users — Lista todos os usuários e contadores de resumo.
 */
router.get('/users', async (req, res) => {
  try {
    const db = getAdminDbClient(req, res);
    const { data, error } = await db
      .from('profiles')
      .select('id, nome, email, whatsapp, role, status, created_at, last_login_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = data || [];
    const summary = users.reduce(
      (acc, u) => {
        acc.total += 1;
        if (u.status === 'pending') acc.pending += 1;
        else if (u.status === 'approved') acc.approved += 1;
        else if (u.status === 'blocked') acc.blocked += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, blocked: 0 }
    );

    return res.json({ users, summary, currentUserId: req.adminProfile.id });
  } catch (err) {
    console.error('Erro em GET /api/admin/users:', err);
    return res.status(500).json({ error: 'Erro ao carregar usuários.' });
  }
});

/**
 * POST /api/admin/users — Cria usuário manualmente já aprovado.
 */
router.post('/users', async (req, res) => {
  try {
    const nome = String(req.body?.nome || '').trim();
    const email = normalizeEmail(req.body?.email);
    const whatsapp = String(req.body?.whatsapp || '').trim() || null;
    const role = req.body?.role === 'admin' ? 'admin' : 'user';
    const password = String(req.body?.password || '');

    if (nome.length < 2) {
      return res.status(400).json({ error: 'Informe o nome do usuário.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (password && password.length < 6) {
      return res
        .status(400)
        .json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const admin = tryGetSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        error:
          'Para criar usuários manualmente pelo painel, configure SUPABASE_SERVICE_ROLE_KEY na Vercel (ou peça para o usuário criar conta em /auth/signup e aprove por aqui).',
      });
    }
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res
        .status(409)
        .json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    const payload = {
      email,
      email_confirm: true,
      user_metadata: { nome, whatsapp },
    };
    if (password) payload.password = password;

    const { data: created, error: createErr } =
      await admin.auth.admin.createUser(payload);

    if (createErr || !created?.user) {
      return res
        .status(400)
        .json({ error: createErr?.message || 'Não foi possível criar o usuário.' });
    }

    await ensureProfileForUser(created.user);

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({
        nome,
        whatsapp,
        role,
        status: 'approved',
      })
      .eq('id', created.user.id)
      .select('id, nome, email, whatsapp, role, status, created_at, last_login_at')
      .single();

    if (updateErr) throw updateErr;

    await sendApprovalEmailIfConfigured(updated, getAppUrl(req));

    return res.status(201).json({
      user: updated,
      message: 'Usuário criado e aprovado com sucesso.',
    });
  } catch (err) {
    console.error('Erro em POST /api/admin/users:', err);
    return res.status(500).json({ error: 'Erro interno ao criar usuário.' });
  }
});

/**
 * POST /api/admin/users/approve-all — Aprova todos os usuários pendentes.
 */
router.post('/users/approve-all', async (req, res) => {
  try {
    const db = getAdminDbClient(req, res);
    const { data: pendingUsers, error: fetchErr } = await db
      .from('profiles')
      .select('id, nome, email')
      .eq('status', 'pending');

    if (fetchErr) throw fetchErr;
    if (!pendingUsers?.length) {
      return res.json({ count: 0, message: 'Não há usuários pendentes.' });
    }

    const { error: updateErr } = await db
      .from('profiles')
      .update({ status: 'approved' })
      .eq('status', 'pending');

    if (updateErr) throw updateErr;

    const appUrl = getAppUrl(req);
    await Promise.allSettled(
      pendingUsers.map((u) => sendApprovalEmailIfConfigured(u, appUrl))
    );

    return res.json({
      count: pendingUsers.length,
      message: `${pendingUsers.length} usuário(s) aprovado(s) com sucesso.`,
    });
  } catch (err) {
    console.error('Erro em POST /api/admin/users/approve-all:', err);
    return res.status(500).json({ error: 'Erro ao aprovar usuários pendentes.' });
  }
});

/**
 * PATCH /api/admin/users/:id/status — Aprova, bloqueia ou desbloqueia um usuário.
 */
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || '');

    if (!['pending', 'approved', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }

    if (id === req.adminProfile.id && status !== 'approved') {
      return res.status(400).json({
        error: 'Você não pode bloquear ou suspender a sua própria conta de administrador.',
      });
    }

    const db = getAdminDbClient(req, res);
    const { data: existing, error: findErr } = await db
      .from('profiles')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const { data: updated, error: updateErr } = await db
      .from('profiles')
      .update({ status })
      .eq('id', id)
      .select('id, nome, email, whatsapp, role, status, created_at, last_login_at')
      .single();

    if (updateErr) throw updateErr;

    if (existing.status === 'pending' && status === 'approved') {
      await sendApprovalEmailIfConfigured(updated, getAppUrl(req));
    }

    return res.json({ user: updated });
  } catch (err) {
    console.error('Erro em PATCH /api/admin/users/:id/status:', err);
    return res.status(500).json({ error: 'Erro ao atualizar status do usuário.' });
  }
});

/**
 * DELETE /api/admin/users/:id — Exclui usuário de auth.users (cascateia para profiles).
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.adminProfile.id) {
      return res.status(400).json({
        error: 'Você não pode excluir a sua própria conta de administrador.',
      });
    }

    const admin = tryGetSupabaseAdmin();
    if (admin) {
      const { error: authErr } = await admin.auth.admin.deleteUser(id);
      if (authErr && !/not found/i.test(authErr.message)) {
        throw authErr;
      }
    }

    const db = getAdminDbClient(req, res);
    const { error: profileDeleteErr } = await db.from('profiles').delete().eq('id', id);
    if (profileDeleteErr) throw profileDeleteErr;

    return res.json({ ok: true, message: 'Usuário excluído com sucesso.' });
  } catch (err) {
    console.error('Erro em DELETE /api/admin/users/:id:', err);
    return res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
});

/**
 * GET /api/admin/buyers — Lista e-mails da base de compradores (primeiro acesso).
 */
router.get('/buyers', async (req, res) => {
  try {
    const db = getAdminDbClient(req, res);
    const { data, error } = await db
      .from('buyers')
      .select('id, email, nome, whatsapp, source, redeemed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return res.json({ buyers: data || [] });
  } catch (err) {
    console.error('Erro em GET /api/admin/buyers:', err);
    return res.status(500).json({ error: 'Erro ao listar compradores.' });
  }
});

/**
 * POST /api/admin/buyers — Adiciona um ou vários e-mails à base de compradores.
 */
router.post('/buyers', async (req, res) => {
  try {
    const rawEmails = Array.isArray(req.body?.emails)
      ? req.body.emails
      : String(req.body?.email || '')
          .split(/[\n,;]+/)
          .map((e) => e.trim())
          .filter(Boolean);

    const nome = String(req.body?.nome || '').trim() || null;
    const source = String(req.body?.source || 'compra').trim() || 'compra';

    const validEmails = [...new Set(rawEmails.map(normalizeEmail).filter(isValidEmail))];
    if (!validEmails.length) {
      return res
        .status(400)
        .json({ error: 'Informe pelo menos um e-mail válido de comprador.' });
    }

    const db = getAdminDbClient(req, res);
    const rows = validEmails.map((email) => ({
      email,
      ...(validEmails.length === 1 && nome ? { nome } : {}),
      source,
    }));

    const { error } = await db
      .from('buyers')
      .upsert(rows, { onConflict: 'email', ignoreDuplicates: true });

    if (error) throw error;

    return res.status(201).json({
      count: validEmails.length,
      message: `${validEmails.length} e-mail(s) adicionado(s) à base de compradores.`,
    });
  } catch (err) {
    console.error('Erro em POST /api/admin/buyers:', err);
    return res.status(500).json({ error: 'Erro ao salvar comprador(es).' });
  }
});

/**
 * DELETE /api/admin/buyers/:id — Remove e-mail da base de compradores.
 */
router.delete('/buyers/:id', async (req, res) => {
  try {
    const db = getAdminDbClient(req, res);
    const { error } = await db.from('buyers').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro em DELETE /api/admin/buyers/:id:', err);
    return res.status(500).json({ error: 'Erro ao remover comprador.' });
  }
});

export default router;

