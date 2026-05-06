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

const ACCOUNTS = [
  {
    name:   'Rohan (Options Trader)',
    keypair: Keypair.fromSecret('SANC3YXMYZHGUSYAIYTTHJ7NP2JGIMCMCM6U4LWTL6Y3MWWIQ6O5LVT2'),
    drain:  '1847',   // active trader — lots of gas/activity
  },
  {
    name:   'Ananya (Liquidity Provider)',
    keypair: Keypair.fromSecret('SBJ3NZ4EE6JARJ4SQAQOPCDU4LZBLJ2IBJ5QZNSC7BRSSXTUW5T6JWFC'),
    drain:  '412',    // moderate LP, not much XLM movement
  },
  {
    name:   'Karan (Market Maker)',
    keypair: Keypair.fromSecret('SCQHOZWY2WXQPZE4Q25QW6LNCL4XLWPIB66A7UDVO6YGUY7OOJN6NGX4'),
    drain:  '2156',   // heavy market making — most active
  },
  {
    name:   'Dev (Arbitrageur)',
    keypair: Keypair.fromSecret('SBVPZ752FKBVGVSMWGOL2BZHVINZEEJDJ4QOHDFZCVK4UAA2EJFGS2HI'),
    drain:  '891',    // occasional arb runs
  },
  {
    name:   'Shreya (Hedger)',
    keypair: Keypair.fromSecret('SDIIYYS45HA2P3JV5CE462FW6AUFAVGCLYBTH4SMR7AP75V2UJR5IJPT'),
    drain:  '1324',   // regular hedging positions
  },
  {
    name:   'Rahul (Options Writer)',
    keypair: Keypair.fromSecret('SBVHWJ7HHXS3FFG5PW2MMSWRJAVLAWCPPNEXS52EHLP4JM7E6KMXJ5CF'),
    drain:  '673',    // writer, mostly receives premium
  },
];

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
