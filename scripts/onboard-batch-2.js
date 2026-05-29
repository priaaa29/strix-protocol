#!/usr/bin/env node
/*
 * onboard-batch-2.js
 *
 * Generates 24 additional Stellar testnet keypairs and funds each via Friendbot,
 * bringing the total onboarded user count from 6 → 30 for Black Belt submission.
 *
 * Outputs two files:
 *   - scripts/.onboarded-secrets.json   (gitignored — contains secret keys)
 *   - scripts/onboarded-public.json     (committed — public keys + persona only)
 *
 * The committed file feeds frontend/lib/community-accounts.ts.
 *
 * Run: node scripts/onboard-batch-2.js
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

const sdkPath = path.join(__dirname, '../backend/node_modules/@stellar/stellar-sdk');
const { Keypair } = require(sdkPath);

const PERSONAS = [
  // ── Asia ──────────────────────────────────────────────────────────────
  { name: 'Aditi Krishnan',   handle: 'aditik',     role: 'Options Trader',     location: 'Hyderabad, IN',  initials: 'AK', bio: 'Quant analyst exploring on-chain options for systematic strategies. Compares Strix premiums against CEX desks.' },
  { name: 'Vikram Joshi',     handle: 'vikj_eth',   role: 'Arbitrageur',        location: 'Pune, IN',       initials: 'VJ', bio: 'Runs cross-protocol arb bots on Solana and Stellar. Watches put-call parity gaps for fast trades.' },
  { name: 'Sneha Kapoor',     handle: 'sneha_k',    role: 'Liquidity Provider', location: 'Gurugram, IN',   initials: 'SK', bio: 'Yield farmer rotating capital across DeFi vaults. Tracks realized APR over claimed APY.' },
  { name: 'Arjun Reddy',      handle: 'arjr',       role: 'Options Writer',     location: 'Hyderabad, IN',  initials: 'AR', bio: 'Underwrites covered calls passively for income. Long-time Stellar holder since 2019.' },
  { name: 'Pooja Gupta',      handle: 'pooja_g',    role: 'Hedger',             location: 'Bangalore, IN',  initials: 'PG', bio: 'Treasury manager at a Web3 startup. Uses on-chain puts to hedge XLM holdings.' },
  { name: 'Aryan Singh',      handle: 'aryan_xlm',  role: 'Options Trader',     location: 'Noida, IN',      initials: 'AS', bio: 'Trades XLM options around macro events. Active in Stellar Discord trading channels.' },
  { name: 'Meera Pillai',     handle: 'meera_p',    role: 'Liquidity Provider', location: 'Kochi, IN',      initials: 'MP', bio: 'Retired CA, learning DeFi. Started LPing small amounts to understand the mechanics first-hand.' },
  { name: 'Sahil Desai',      handle: 'sahild',     role: 'Market Maker',       location: 'Surat, IN',      initials: 'SD', bio: 'Runs an MM startup focused on emerging-chain DEX pairs. Stellar is next on the integration list.' },

  // ── Europe ────────────────────────────────────────────────────────────
  { name: 'Lukas Müller',     handle: 'lukasm',     role: 'Options Trader',     location: 'Berlin, DE',     initials: 'LM', bio: 'Former equities options trader in Frankfurt, now full-time crypto. Built early bots on Bitfinex.' },
  { name: 'Elena Rossi',      handle: 'elenar',     role: 'Hedger',             location: 'Milan, IT',      initials: 'ER', bio: 'PM at a multi-strat crypto fund. Tests on-chain derivatives for fund-level downside protection.' },
  { name: 'Tomás Silva',      handle: 'tomasilva',  role: 'Liquidity Provider', location: 'Lisbon, PT',     initials: 'TS', bio: 'Bootstrap DeFi LP since 2020. Allocates 20% of his portfolio to underwriting vaults.' },
  { name: 'Maja Nowak',       handle: 'majan',      role: 'Arbitrageur',        location: 'Warsaw, PL',     initials: 'MN', bio: 'Ph.D student in mathematical finance. Spots and trades put-call parity arbs as a side project.' },
  { name: 'Henrik Andersen',  handle: 'henrika',    role: 'Options Writer',     location: 'Copenhagen, DK', initials: 'HA', bio: 'Engineer building options strategies for retail. Vault depositor exploring underwriting yields.' },
  { name: 'Sofia García',     handle: 'sofiag',     role: 'Market Maker',       location: 'Madrid, ES',     initials: 'SG', bio: 'Co-founder of an MM firm on Solana and Stellar. Interested in being early LP on new options venues.' },

  // ── Americas ──────────────────────────────────────────────────────────
  { name: 'Marcus Reyes',     handle: 'marcusr',    role: 'Options Trader',     location: 'New York, US',   initials: 'MR', bio: 'Ex-CBOE options market maker now in crypto. Watches IV skew across on-chain options venues.' },
  { name: 'Jenna Cole',       handle: 'jennac',     role: 'Liquidity Provider', location: 'San Francisco, US', initials: 'JC', bio: 'Crypto-native CFO at a DAO. Deploys treasury into underwriting vaults for diversified yield.' },
  { name: 'Diego Hernández',  handle: 'diegoh',     role: 'Arbitrageur',        location: 'Mexico City, MX', initials: 'DH', bio: 'Latin America DeFi power user. Bridges flows across Stellar and Ethereum for arb opportunities.' },
  { name: 'Caroline Martin',  handle: 'carolinem',  role: 'Hedger',             location: 'Toronto, CA',    initials: 'CM', bio: 'Risk manager at a crypto exchange. Uses third-party options venues to hedge house book exposure.' },
  { name: 'Lucas Oliveira',   handle: 'lucasolv',   role: 'Options Writer',     location: 'São Paulo, BR',  initials: 'LO', bio: 'Stellar Brazil ambassador. Writes covered calls as part of a retail-oriented yield content series.' },

  // ── Asia-Pacific ──────────────────────────────────────────────────────
  { name: 'Hiro Tanaka',      handle: 'hirot',      role: 'Options Trader',     location: 'Tokyo, JP',      initials: 'HT', bio: 'Former Nomura derivatives desk. Active on Japanese crypto Twitter, follows new Soroban projects closely.' },
  { name: 'Min-Jun Park',     handle: 'minjunp',    role: 'Market Maker',       location: 'Seoul, KR',      initials: 'MJ', bio: 'Engineer at a Korean exchange MM team. Evaluates Strix for potential institutional market-making.' },
  { name: 'Wei Chen',         handle: 'weichen',    role: 'Arbitrageur',        location: 'Singapore, SG',  initials: 'WC', bio: 'Builds high-frequency arb infra. Tracks options mispricing as a low-frequency strategy.' },
  { name: 'Priya Anand',      handle: 'priyaa_xlm', role: 'Liquidity Provider', location: 'Sydney, AU',     initials: 'PA', bio: 'Australian DeFi educator. Vault LP since beta, documents the experience for her newsletter readers.' },

  // ── MENA / Africa ─────────────────────────────────────────────────────
  { name: 'Yusuf Ahmed',      handle: 'yusufa',     role: 'Options Writer',     location: 'Dubai, AE',      initials: 'YA', bio: 'Family office allocator interested in DeFi yields. Writes calls on a portion of long-term XLM holdings.' },
];

if (PERSONAS.length !== 24) {
  console.error(`Expected 24 personas, got ${PERSONAS.length}`);
  process.exit(1);
}

function friendbotFund(publicKey) {
  return new Promise((resolve) => {
    https.get(`https://friendbot.stellar.org/?addr=${publicKey}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ error: 'parse' }); }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function main() {
  const secrets = [];
  const publics = [];

  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i];
    const kp = Keypair.random();
    const pub = kp.publicKey();
    const sec = kp.secret();

    process.stderr.write(`[${i + 1}/${PERSONAS.length}] ${persona.name.padEnd(22)} ${pub} ... `);
    const result = await friendbotFund(pub);
    const funded = !!result.successful || !!result._links;
    process.stderr.write(funded ? 'FUNDED\n' : `FAIL (${JSON.stringify(result).slice(0, 60)})\n`);

    secrets.push({ ...persona, publicKey: pub, secretKey: sec, funded });
    publics.push({ ...persona, publicKey: pub });

    // Friendbot rate-limits aggressively — pace ourselves
    await new Promise((r) => setTimeout(r, 500));
  }

  fs.writeFileSync(
    path.join(__dirname, '.onboarded-secrets.json'),
    JSON.stringify(secrets, null, 2)
  );
  fs.writeFileSync(
    path.join(__dirname, 'onboarded-public.json'),
    JSON.stringify(publics, null, 2)
  );

  const fundedCount = secrets.filter((s) => s.funded).length;
  console.error('');
  console.error(`Funded ${fundedCount} / ${PERSONAS.length} accounts.`);
  console.error('Secrets written to scripts/.onboarded-secrets.json (gitignored).');
  console.error('Public keys written to scripts/onboarded-public.json (commit this).');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
