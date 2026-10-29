# Checklist de lançamento (GO-LIVE) — AutoManager

Banco: Supabase **na nuvem** (projeto `paqsixfvmbkowedvukgz`). Todas as migrations até a
`0036_estoque_vendas.sql` já estão aplicadas (conferido em 29/10/2026). Não rode migrations novas
sem backup.

## 1. Contas e chaves que você precisa criar/pegar

| O quê | Onde pegar | Onde colar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase › Project Settings › API | Variáveis de ambiente do host (ex.: Vercel › Settings › Environment Variables) |
| `SUPABASE_SERVICE_ROLE_KEY` (segredo) | Supabase › Project Settings › API (service_role) | Host (nunca no navegador / nunca no git) |
| `NEXT_PUBLIC_APP_URL` | Seu domínio final, ex.: `https://automanager.com.br` (sem barra no fim) | Host — é lida **no build**: depois de mudar, faça novo deploy |
| `MP_ACCESS_TOKEN` (segredo) | Mercado Pago › Suas integrações › sua aplicação › **Credenciais de produção** › Access Token (`APP_USR-...`) | Host |
| `MP_WEBHOOK_SECRET` (segredo) | Mercado Pago › Suas integrações › Webhooks › "Assinatura secreta" (passo 3) | Host |
| SMTP de e-mail (ex.: Resend, Brevo, Amazon SES) | Conta no provedor + domínio verificado (SPF/DKIM) | Supabase › Authentication › SMTP Settings (passo 4) |

`MP_CLIENT_ID`, `MP_CLIENT_SECRET` e `NEXT_PUBLIC_MP_PUBLIC_KEY` hoje **não são usadas** pelo código.
`DATABASE_URL` é só para manutenção local — não cadastre no host.

Se faltar alguma variável obrigatória do Supabase, o servidor não sobe e o log diz qual é.
As de produção que faltarem (APP_URL, MP, webhook, dados da empresa) aparecem como
`[AutoManager] Configuração de produção ausente: ...` no log do deploy.

## 2. Dados da empresa (obrigatório por CDC/LGPD)

Edite **`lib/empresa.ts`** e preencha: `razaoSocial`, `cnpj`, `emailSuporte`, `cidadeUf`
(foro dos Termos) e, se tiver, `encarregadoLgpd`. Eles aparecem em `/termos`, `/privacidade`,
`/cancelamento` e no rodapé. Campo vazio fica oculto — **não venda com eles vazios**.
Revise também o texto jurídico das três páginas (de preferência com um advogado).

## 3. Mercado Pago

1. Use as credenciais de **produção** (não as de teste) no `MP_ACCESS_TOKEN`.
2. Em Suas integrações › Webhooks, configure a URL
   `https://SEU-DOMINIO/api/mercadopago/webhook` (modo produção) e marque os eventos:
   **Planos e assinaturas** (`subscription_preapproval`, `subscription_authorized_payment`) e
   **Pagamentos** (`payment`).
3. Copie a "Assinatura secreta" para `MP_WEBHOOK_SECRET` e faça novo deploy.

## 4. Supabase Auth (e-mails)

A confirmação de e-mail está **ligada** no projeto (`mailer_autoconfirm = false`). O SMTP padrão
do Supabase manda poucos e-mails por hora — sem SMTP próprio, cadastros novos e "esqueci minha
senha" vão travar no lançamento.

1. Authentication › SMTP Settings: configure o SMTP do seu provedor (remetente do seu domínio).
2. Authentication › URL Configuration:
   - **Site URL**: `https://SEU-DOMINIO`
   - **Redirect URLs**: `https://SEU-DOMINIO/login`, `https://SEU-DOMINIO/redefinir-senha`
3. (Opcional) Authentication › Email Templates: traduza os e-mails para português.
4. Alternativa: desligar a confirmação (Providers › Email › "Confirm email") para cadastro instantâneo.

## 5. Conta de super-admin

Ainda não existe nenhuma conta super-admin. Rode localmente (usa o `.env.local`):

```bash
node scripts/criar-admin.mjs --email voce@seudominio.com --senha "senha-forte-com-12+"
```

Depois saia e entre de novo para acessar `/admin`.

## 6. Deploy (ex.: Vercel)

1. Importe o repositório na Vercel (framework Next.js, comandos padrão).
2. Cadastre as variáveis do passo 1 em **Production**.
3. Deploy. Aponte o domínio e confirme o HTTPS.
4. Se mudar `NEXT_PUBLIC_APP_URL` depois, faça **Redeploy**.

Antes de cada deploy, rode localmente: `npm ci && npm run lint && npx tsc --noEmit && npm run build`.

## 7. Teste rápido depois do deploy (10 minutos)

- [ ] `https://SEU-DOMINIO/` abre a landing, com planos e rodapé com razão social/CNPJ.
- [ ] `/termos`, `/privacidade`, `/cancelamento` abrem e mostram seus dados.
- [ ] `/robots.txt` e `/sitemap.xml` mostram o seu domínio (não `localhost`).
- [ ] `/painel` sem login redireciona para `/login`.
- [ ] Criar conta com um e-mail real → chega o e-mail de confirmação → confirmar → Entrar → onboarding.
- [ ] "Esqueci minha senha" → chega o e-mail → link abre `/redefinir-senha`.
- [ ] Configurações › Plano › assinar o plano mais barato com um cartão real → volta para o app e o
      plano aparece ativo. Confira no MP (Suas integrações › Webhooks › histórico) que a notificação
      voltou **200**. Depois cancele a assinatura no MP se foi só teste.
- [ ] Logs do host sem `[AutoManager] Configuração de produção ausente`.
- [ ] Vitrine pública `/loja/<slug-da-sua-loja>` abre no celular.
