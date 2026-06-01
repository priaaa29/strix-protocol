/**
 * simulate-activity.js
 * Submits real XLM payment transactions from each test account to the admin,
 * creating genuine on-chain history and varied XLM balances.
 *
 * Run: cd backend && node ../scripts/simulate-activity.js
 */

const path = require('path');
// resolve stellar-sdk from backend/node_modules
const sdkPath = path.join(__dirname, '../backend/node_modules/@stellar/stellar-sdk');
const {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
  Account,
} = require(sdkPath);
const https = require('https');

const HORIZON = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

// Admin (receives the XLM drain — just concentration for varied balances)
const ADMIN_PUBLIC = 'GC74PVJTC4FQRYFAJVFAPUXPBKGBAJIUN7KO7FMCWXMV5X3EWWP7KM6O';

// Phase-1 secrets are loaded from scripts/.phase1-secrets.json (gitignored).
// Historical note: these secrets were committed inline in this file in commit
// 9afc2b1 and are therefore exposed in git history. They protect testnet-only
// funds and are documented in docs/security-checklist.md as compromised.
// MUST rotate to fresh keys before any mainnet deployment.
const fs = require('fs');
const SECRETS_PATH = path.join(__dirname, '.phase1-secrets.json');
if (!fs.existsSync(SECRETS_PATH)) {
  console.error(`Missing ${SECRETS_PATH}. See docs/security-checklist.md for setup.`);
  process.exit(1);
}
const ACCOUNTS = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8')).accounts.map((a) => ({
  name:    `${a.name} (${a.role})`,
  keypair: Keypair.fromSecret(a.secret),
  drain:   a.drain,
}));

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const encoded = `tx=${encodeURIComponent(body)}`;
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(encoded) },
    };
    const req = https.request(url, opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(encoded);
    req.end();
  });
}

async function sendPayment(account) {
  const { name, keypair, drain } = account;
  const pub = keypair.publicKey();

  console.log(`\n→ ${name}`);
  console.log(`  Sending ${drain} XLM to admin...`);

  const accData = await get(`${HORIZON}/accounts/${pub}`);
  if (accData.status === 404) {
    console.log(`  ⚠️  Account not found — skipping`);
    return;
  }

  const sourceAccount = new Account(pub, accData.sequence);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({
      destination: ADMIN_PUBLIC,
      asset: Asset.native(),
      amount: drain,
    }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  const xdr = tx.toEnvelope().toXDR('base64');

  const result = await post(`${HORIZON}/transactions`, xdr);
  if (result.successful) {
    console.log(`  ✅ Done — hash: ${result.hash}`);
  } else {
    console.log(`  ❌ Failed:`, JSON.stringify(result.extras?.result_codes));
  }
}

async function main() {
  console.log('Simulating on-chain activity for test accounts...\n');
  for (const account of ACCOUNTS) {
    await sendPayment(account);
    await new Promise(r => setTimeout(r, 1500)); // small delay between txs
  }
  console.log('\n✅ Done. Refresh the Explorer page to see varied balances.');
}

main().catch(console.error);
