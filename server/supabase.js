import { createClient } from '@supabase/supabase-js';
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

export function getMissingEnvVars() {
  return REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
}

export function isSupabaseConfigured() {
  return getMissingEnvVars().length === 0;
}

let cachedAdminClient = null;

/**
 * Cliente administrativo (service_role) — usar APENAS no servidor.
 */
export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `Variáveis do Supabase ausentes: ${getMissingEnvVars().join(', ')}`
    );
  }
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return cachedAdminClient;
}

/**
 * Cliente SSR vinculado aos cookies HTTP da requisição/resposta atual.
 */
export function createSupabaseUserClient(req, res) {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `Variáveis do Supabase ausentes: ${getMissingEnvVars().join(', ')}`
    );
  }

  return createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(req.headers.cookie ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieStr = serializeCookieHeader(name, value, {
              ...options,
              path: options?.path || '/',
              httpOnly: options?.httpOnly ?? true,
              sameSite: options?.sameSite || 'lax',
              secure:
                process.env.NODE_ENV === 'production'
                  ? (options?.secure ?? true)
                  : false,
            });
            res.appendHeader('Set-Cookie', cookieStr);
          });
        },
      },
    }
  );
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalizeEmail(email));
}

export function isConfiguredAdminEmail(email) {
  const configured = process.env.ADMIN_EMAIL || '';
  if (!configured.trim()) return false;
  const target = normalizeEmail(email);
  return configured
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean)
    .includes(target);
}

export function getAppUrl(req) {
  if (process.env.APP_URL?.trim()) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

/**
 * Garante que um usuário autenticado possua linha em `public.profiles`
 * e sincroniza promoção automática caso corresponda a `ADMIN_EMAIL`.
 */
export async function ensureProfileForUser(user) {
  const admin = getSupabaseAdmin();
  const email = normalizeEmail(user.email);
  const configuredAdmin = isConfiguredAdminEmail(email);

  const { data: existing, error: selectErr } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (selectErr) throw selectErr;

  if (existing) {
    if (configuredAdmin && (existing.role !== 'admin' || existing.status !== 'approved')) {
      const { data: promoted, error: promoteErr } = await admin
        .from('profiles')
        .update({ role: 'admin', status: 'approved' })
        .eq('id', user.id)
        .select('*')
        .single();
      if (promoteErr) throw promoteErr;
      return promoted;
    }
    return existing;
  }

  // Fallback caso o usuário tenha sido criado diretamente no Auth sem trigger
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  const isFirst = (count ?? 0) === 0;
  const role = configuredAdmin || isFirst ? 'admin' : 'user';
  const status = configuredAdmin || isFirst ? 'approved' : 'pending';

  const { data: created, error: insertErr } = await admin
    .from('profiles')
    .insert({
      id: user.id,
      nome: String(user.user_metadata?.nome || '').trim(),
      email,
      whatsapp: user.user_metadata?.whatsapp || null,
      role,
      status,
    })
    .select('*')
    .single();

  if (insertErr) throw insertErr;
  return created;
}

/**
 * Retorna `{ user, profile, supabase }` validando o JWT com o Supabase Auth.
 */
export async function getAuthContext(req, res) {
  if (!isSupabaseConfigured()) {
    return { user: null, profile: null, supabase: null, configMissing: true };
  }

  const supabase = createSupabaseUserClient(req, res);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { user: null, profile: null, supabase, configMissing: false };
  }

  const profile = await ensureProfileForUser(data.user);
  return { user: data.user, profile, supabase, configMissing: false };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Envia e-mail opcional de aviso de aprovação caso RESEND_API_KEY esteja configurado.
 */
export async function sendApprovalEmailIfConfigured(profile, appUrl) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from || !profile?.email) return false;

  const loginUrl = `${appUrl}/auth/login`;
  const greetingName = escapeHtml(profile.nome || 'criador(a)');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [profile.email],
        subject: 'Seu acesso à 3DSJ Precificadora foi aprovado!',
        html: `
          <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background:#07090d; color:#f4f7fb; padding:32px; border-radius:14px;">
            <h2 style="margin:0 0 12px; color:#19d98b;">3DSJ Precificadora</h2>
            <p style="margin:0 0 16px;">Olá, <strong>${greetingName}</strong>!</p>
            <p style="margin:0 0 24px; color:#b8c4d6;">
              Sua conta foi aprovada pelo administrador. Agora você já pode solicitar seu link mágico de acesso ou entrar com e-mail e senha.
            </p>
            <a href="${escapeHtml(loginUrl)}" style="display:inline-block; background:#19d98b; color:#07090d; font-weight:700; padding:12px 22px; border-radius:10px; text-decoration:none;">
              Acessar Precificadora
            </a>
          </div>
        `,
      }),
    });
    return response.ok;
  } catch (err) {
    console.warn('Falha ao enviar e-mail de aprovação via Resend:', err.message);
    return false;
  }
}

