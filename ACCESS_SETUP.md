# 3DSJ Precificadora — Configuração da Camada de Acesso

## 1. Banco de Dados & RLS (Supabase)

1. Abra o **SQL Editor** do seu projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Cole e execute todo o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql).
3. Isso criará:
   - `public.profiles` (`id`, `nome`, `email`, `whatsapp`, `role`, `status`, `created_at`, `last_login_at`, `last_magic_link_sent_at`)
   - `public.buyers` (base de compradores para o fluxo *"Comprou agora? Faça o primeiro acesso"*)
   - Função segura `private.is_admin()` (em schema privado, não exposto pela Data API)
   - Trigger `on_auth_user_created`
   - Políticas de RLS garantindo que cada usuário leia apenas o próprio perfil e somente administradores leiam/editem todos os perfis.

---

## 2. Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto (baseado em [`.env.example`](./.env.example)):

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-ou-publishable-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-aqui

# Opcional: define um ou mais e-mails (separados por vírgula) que serão promovidos a admin
ADMIN_EMAIL=seu-email-admin@exemplo.com

APP_URL=http://localhost:5173
PORT=5173

# Opcional: notificar usuário por e-mail quando o admin aprovar o cadastro (Resend)
# RESEND_API_KEY=re_xxxxxxxxx
# RESEND_FROM_EMAIL=3DSJ Precificadora <acesso@seudominio.com.br>
```

> ⚠️ **Segurança:** Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend nem envie o `.env` para o Git.

---

## 3. Link Mágico (Expiração de 15 minutos e Uso Único)

No painel do Supabase:

1. Acesse **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (em produção, a URL do seu domínio, ex.: `https://precificadora.seudominio.com.br`)
   - **Redirect URLs**: adicione `http://localhost:5173/auth/callback` e `https://seudominio.com.br/auth/callback`.
2. Acesse **Authentication → Providers → Email**:
   - Ative **Email** e **Confirm email** / **Magic Link**.
   - Em **Email OTP Expiration** (validade em segundos), altere de `3600` (1 hora) para **`900`** (15 minutos).
   - O Supabase já garante uso único por token; além disso, o servidor registra `last_magic_link_sent_at` para reforçar o limite de 15 minutos e invalidar links reutilizados.
3. *(Recomendado para SSR)* Em **Authentication → Email Templates → Magic Link**, você pode usar o link direto para o callback SSR:
   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink">Entrar na 3DSJ Precificadora</a>
   ```

---

## 4. Como Definir o Primeiro Administrador

Você tem **duas formas** (que funcionam inclusive juntas):

1. **Pela variável de ambiente `ADMIN_EMAIL`** *(recomendado)*:
   - Defina `ADMIN_EMAIL=seu@email.com` no `.env`.
   - Ao criar conta em `/auth/signup` ou solicitar link mágico em `/auth/login` com esse e-mail, o sistema promove automaticamente para `role = 'admin'` e `status = 'approved'`.
2. **Pelo primeiro usuário cadastrado**:
   - O trigger SQL `private.handle_new_user()` detecta automaticamente quando `public.profiles` está vazia e cria o **primeiro usuário** com `role = 'admin'` e `status = 'approved'`.
3. **Promoção manual via SQL** *(caso já existam usuários)*:
   ```sql
   update public.profiles
   set role = 'admin', status = 'approved'
   where lower(email) = 'seu@email.com';
   ```

---

## 5. Executando o Projeto

```bash
# Instalar dependências
npm install

# Desenvolvimento (Express + middleware de proteção + Vite HMR)
npm run dev

# Build + Produção
npm run build
npm start
```

