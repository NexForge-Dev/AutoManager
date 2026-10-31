// Cria/atualiza no Stripe os produtos e preços mensais (BRL) dos planos do AutoManager.
// Idempotente: cada preço tem o lookup_key `automanager_<plano>`; se o valor mudou,
// cria um preço novo e transfere o lookup_key para ele (assinaturas antigas mantêm o preço delas).
//
// Uso:  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-sync.mjs
//       (ou `npm run stripe:sync`, que lê o .env.local)
// Valores: os mesmos de lib/plans.ts (precoCentavos). Mantenha os dois em sincronia.

import Stripe from "stripe";

const PLANOS = {
  ambulante: { nome: "Ambulante", centavos: 2000 },
  solo: { nome: "Solo", centavos: 4900 },
  equipe: { nome: "Equipe", centavos: 9900 },
  expansao: { nome: "Expansão", centavos: 19900 },
};

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Defina STRIPE_SECRET_KEY (sk_test_... para testar).");
  process.exit(1);
}
const stripe = new Stripe(key);
console.log(`Stripe em modo ${key.includes("_live_") ? "PRODUÇÃO (live)" : "teste"}`);

for (const [id, p] of Object.entries(PLANOS)) {
  const lookup = `automanager_${id}`;
  const productId = `automanager_${id}`;

  let produto;
  try {
    produto = await stripe.products.retrieve(productId);
    if (produto.name !== `AutoManager - Plano ${p.nome}` || !produto.active)
      produto = await stripe.products.update(productId, { name: `AutoManager - Plano ${p.nome}`, active: true });
  } catch {
    produto = await stripe.products.create({ id: productId, name: `AutoManager - Plano ${p.nome}`, metadata: { plano: id } });
  }

  const { data } = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  const atual = data[0];
  if (atual && atual.unit_amount === p.centavos && atual.currency === "brl" && atual.recurring?.interval === "month") {
    console.log(`= ${id}: ${atual.id} (R$ ${p.centavos / 100}/mês) já existe`);
    continue;
  }
  const novo = await stripe.prices.create({
    product: produto.id,
    currency: "brl",
    unit_amount: p.centavos,
    recurring: { interval: "month" },
    lookup_key: lookup,
    transfer_lookup_key: true,
    metadata: { plano: id },
  });
  if (atual) await stripe.prices.update(atual.id, { active: false });
  console.log(`+ ${id}: ${novo.id} (R$ ${p.centavos / 100}/mês)`);
}
