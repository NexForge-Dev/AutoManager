# Checklist de lançamento (GO-LIVE) — AutoManager

Banco: Supabase **na nuvem** (projeto `paqsixfvmbkowedvukgz`, região us-east-1). Todas as migrations
até a `0036_estoque_vendas.sql` já estão aplicadas (conferido em 02/11/2026); faltam
`0037_stripe` → `0040_rpc_sem_anon`. Não rode migrations novas sem backup — o passo a passo exato
está em [`docs/DEPLOY-TODAY.md`](docs/DEPLOY-TODAY.md).

## 1. Contas e chaves que você precisa criar/pegar

| O quê | Onde pegar | Onde colar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase › Project Settings › API | Variáveis de ambiente do host (ex.: Vercel › Settings › Environment Variables) |
| `SUPABASE_SERVICE_ROLE_KEY` (segredo) | Supabase › Project Settings › API (service_role) | Host (nunca no navegador / nunca no git) |
| `NEXT_PUBLIC_APP_URL` | Seu domínio final, ex.: `https://automanager.com.br` (sem barra no fim) | Host — é lida **no build**: depois de mudar, faça novo deploy |
| `STRIPE_SECRET_KEY` (segredo) | Stripe › Developers › API keys › chave **live** (`sk_live_...` ou restrita `rk_live_...`) | Host (Production). No staging/local use `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` (segredo) | Stripe › Developers › Webhooks › endpoint (passo 3) › Signing secret (`whsec_...`) | Host |
| SMTP de e-mail (ex.: Resend, Brevo, Amazon SES) | Conta no provedor + domínio verificado (SPF/DKIM) | Supabase › Authentication › SMTP Settings (passo 4) |

`DATABASE_URL` é só para manutenção local — não cadastre no host.

Se faltar alguma variável obrigatória do Supabase, o servidor não sobe e o log diz qual é.
As de produção que faltarem (APP_URL, Stripe, webhook, dados da empresa) aparecem como
`[AutoManager] Configuração de produção ausente: ...` no log do deploy.

## 2. Dados da empresa (obrigatório por CDC/LGPD)

Edite **`lib/empresa.ts`** e preencha: `razaoSocial`, `cnpj`, `emailSuporte`, `cidadeUf`
(foro dos Termos) e, se tiver, `encarregadoLgpd`. Eles aparecem em `/termos`, `/privacidade`,
`/cancelamento` e no rodapé. Campo vazio fica oculto — **não venda com eles vazios**.
Revise também o texto jurídico das três páginas (de preferência com um advogado).

## 3. Stripe

1. Conta Stripe **Brasil** (cobra em BRL; Pix/boleto só aparecem para contas BR). Ative os
   meios de pagamento em Settings › Payment methods — o checkout mostra os que estiverem ligados.
2. Crie os produtos/preços dos planos: `STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-sync.mjs`
   (idempotente; usa os valores de `lib/plans.ts` e o lookup_key `automanager_<plano>`).
   Rode antes com a chave de teste para validar.
3. Em Developers › Webhooks, crie o endpoint `https://SEU-DOMINIO/api/stripe/webhook` com os eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed`,
   `invoice.paid`, `invoice.payment_failed`. Copie o Signing secret para `STRIPE_WEBHOOK_SECRET`.
4. Em Settings › Billing › Customer portal, ative o portal (atualizar cartão, ver faturas e
   cancelar assinatura). Trocas de plano são feitas pelo próprio app em `/planos`.
5. Em Settings › Billing › Subscriptions and emails › "Manage failed payments", deixe as novas
   tentativas ligadas e, ao esgotá-las, **marcar como unpaid** ou **cancelar**. Durante as tentativas
   (past_due) a loja mantém o plano por 3 dias após o vencimento; depois cai no Ambulante.
6. **Assinantes antigos do Mercado Pago:** o app não fala mais com o MP. Antes do deploy, rode no
   Supabase `select org_id, plano from assinatura where provider = 'mercadopago' and status <> 'canceled';`
   — para cada loja, cancele a assinatura no painel do MP e peça para assinar de novo em `/planos`
   (o checkout recusa quem ainda tem assinatura MP ativa, para não cobrar em dobro).
7. Aplique as migrations `0037_stripe.sql` a `0040_rpc_sem_anon.sql` (ver `docs/DEPLOY-TODAY.md`) e faça novo deploy.

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
      plano aparece ativo. Confira no Stripe (Developers › Webhooks › seu endpoint › Event deliveries)
      que os eventos voltaram **200**. Se foi só teste, cancele pelo portal (Configurações › Plano ›
      Gerenciar assinatura) e reembolse em Stripe › Payments.
- [ ] `https://SEU-DOMINIO/api/health` responde `{"ok":true,"database":true}` (use no monitor de uptime).
- [ ] Logs do host sem `[AutoManager] Configuração de produção ausente`.
- [ ] Vitrine pública `/loja/<slug-da-sua-loja>` abre no celular.
