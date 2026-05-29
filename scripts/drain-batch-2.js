#!/usr/bin/env node
/*
 * drain-batch-2.js
 *
 * Drains a varied amount of XLM from each Phase-2 account to the admin wallet.
 * The Friendbot-funded accounts all start at exactly 10,000 XLM which looks
 * synthetic. This script gives each account a believable, lumpy balance by
 * submitting a real signed payment tx.
 *
 * Drain amounts are chosen per role: active traders move more, casual LPs
 * less. A few accounts get drained heavily ("active wallets") and a few
 * barely ("lurkers") to spread the distribution.
 *
 * Run: node scripts/drain-batch-2.js
 *
 * Reads secrets from scripts/.onboarded-secrets.json (gitignored, created
 * by scripts/onboard-batch-2.js).
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

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

const HORIZON = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const ADMIN_PUBLIC = 'GC74PVJTC4FQRYFAJVFAPUXPBKGBAJIUN7KO7FMCWXMV5X3EWWP7KM6O';

// Per-persona drain plan. Keys must match scripts/.onboarded-secrets.json.
// Amounts are XLM strings (Horizon payment op takes a string).
//
// Distribution shaped by persona role / activity profile:
//   200-800 drained   → lurkers / lightly-touched accounts (3 entries)
//   1000-2500 drained → moderate active traders / hedgers (8 entries)
//   3000-5500 drained → moderate LPs, MMs (6 entries)
//   6000-9500 drained → power users, mostly off elsewhere (4 entries)
//   < 200 drained     → barely-touched lurkers (3 entries)
const DRAIN_PLAN = {
  // Phase 2 #1 — Aditi (Options Trader, quant, weekend trader)
  'GCLI66S56HCNDVD6RJH7TEDVDSSMM6L2TNHSDV75JZUVLBSKSUH6NWV4': '1247.83',
  // Phase 2 #2 — Vikram (Arbitrageur, runs bots on 3 chains)
  'GDZWQMLO75C5LP5DTFN4W4MPZMA6673PJL5JVTHP5ZNUGT77RZE2X7QI': '3892.41',
  // Phase 2 #3 — Sneha / sk0x (LP, leaves Pendle, comes here)
  'GDUZ6S6TL3VMFCSXRDM75YCMTFPQCKBGDUVHXRZQNDXHWRIFF67HBGIE': '5641.20',
  // Phase 2 #4 — Arjun (Options Writer, 2018 holder — barely touched)
  'GA7SUV5MU2IMMHAZ6UGED636LN26YSWAH5VRKXHDDGDCZFLH5LIK7BEB': '432.10',
  // Phase 2 #5 — Pooja (Hedger, treasury role)
  'GD6DJIL2SKN2U66GIBYCIXHZPG3SLQ5KJRWWJ4AEGVPP5S4PMFRXAGFC': '2104.66',
  // Phase 2 #6 — anonxlm.42 (anonymous trader, looks active)
  'GA36DAJR4EHYQF2FGPW2NX72HH2LT6GU5ZS7YBYMWAQPKPC7ZFT4NDXY': '8765.55',
  // Phase 2 #7 — Meera (retired CA, 50 USDC LP — barely touched)
  'GCSPBRKQW5GGC3AZNHQPSFPLTAQFC76TLBKBRO4CYLWRV7SRSLX25WXY': '87.50',
  // Phase 2 #8 — Sahil (MM startup, integrating)
  'GARK776E77FIHAJ5CBPJHLKYOPKKKRU3PM7RPIN3W5WLKHZIT2HN7OQA': '4220.00',
  // Phase 2 #9 — Lukas (ex-Frankfurt desk)
  'GCGMT76LN4DMT3Z7YOXWL4XAJK46K5JSPHI4GR2Y72BLP66G3XRBJQNB': '1893.27',
  // Phase 2 #10 — Elena (fund risk PM, testing)
  'GDDFWS7HTL77AKSZBL72DYMSGZICAXMPSBJGIV4IBJF6UEOIYPHBSX7E': '673.40',
  // Phase 2 #11 — tomás (2020 cohort, got nuked in Luna)
  'GB4IDTSY55ZUMQIYA3W3EFWSJD5JL2RGPYCYWUWT2G6DO53ZCFMPDCSB': '7341.92',
  // Phase 2 #12 — Maja (PhD, side project)
  'GADOJPJP7R7WWI6HA5LJD57C5HTTGDPKD232FS6LUSE4BK75T7UMNZQH': '1156.30',
  // Phase 2 #13 — Henrik (engineer, building retail thing)
  'GA2VFW2CAKLMHYGGT24SX6EONEW6ZD5G5GMI3SLBHF7SK5TT4YRBLDBI': '912.85',
  // Phase 2 #14 — Sofia (MM shop, mostly elsewhere)
  'GBUZ5DUPXFZYS4QKLBYDYZQ5BRYNSWBWUKQWUUHV2WTHMJ6PONOCRMTV': '347.05',
  // Phase 2 #15 — Marcus (ex-CBOE pit, active)
  'GB7FXPY2I43TFS25RAZWCGRUXZXVP2E6R2CC4UIYYBBS3V3MOLYHZ542': '2455.18',
  // Phase 2 #16 — Jenna (DAO CFO, treasury deployment)
  'GBII3ZW42QGOZEU4TRS2GTEX7NQISLDQLBYKBZ4HIM4F3UMFYDGU4IL4': '5198.40',
  // Phase 2 #17 — Diego (eth bridges, heavy wallet)
  'GAWQEEWZDBMDTA35FDOQLOEQ5VLMD7BH5TL6SWVQ6X7ZEEGO2BGO4RDL': '6502.71',
  // Phase 2 #18 — Caroline (CEX risk, researching)
  'GDVAJ6NPDHVSMCPBRC2FOEDVLEW7UEUAHPVC3ZD5ETLAYDPTKHFCIW5D': '1888.50',
  // Phase 2 #19 — Lucas (BR community, light wallet)
  'GBUZVKELRXGX4KPIEOLGPS7DJ5BIUD7LNRJ43EVYPRTL5TYUMOZJ53BH': '521.66',
  // Phase 2 #20 — Hiro (ex-Nomura, JP twitter)
  'GBUSK4RJKDFCVJHTAFTS6HGUR5YK3FB3VFUCUFEQ6FWJEU5Z5TTL2EJE': '1437.92',
  // Phase 2 #21 — Min-Jun (KR exchange eng, light test)
  'GBVUBLMSCXSVM3I7COWOBFQXBUJPGU4EE5WRG4SZWUHMZUBVUKB6YJ4A': '254.10',
  // Phase 2 #22 — wei (HFT day job, hobby arb)
  'GC7CDKGWND2J3AKEPNNZ2JDCIODJDHDKQXJVSNRQ6W4PRBVEI6IBOMO7': '3667.45',
  // Phase 2 #23 — Priya A. (AU newsletter, documenting)
  'GAFL5KTCBR3ATLU77QEE4ZB2CAZLRHML2IHE3VRISS5UJWNZOFZMV47F': '799.23',
  // Phase 2 #24 — Yusuf (family office, conservative — barely touched)
  'GCGVJYEMJG2IUV5QJS536N2HZYK32SOJ4SFTHWSAIRTA5XD7JROGWX6J': '116.40',
};

// ─────────────────────────────────────────────────────────────────────────────

function horizonGet(pathStr) {
  return new Promise((resolve, reject) => {
    https.get(`${HORIZON}${pathStr}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

function horizonPost(pathStr, xdr) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({ tx: xdr }).toString();
    const req = https.request(
      `${HORIZON}${pathStr}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function drainOne(persona) {
  const drainAmount = DRAIN_PLAN[persona.publicKey];
  if (!drainAmount) return { skipped: true };

  const kp = Keypair.fromSecret(persona.secretKey);

  const accountResp = await horizonGet(`/accounts/${kp.publicKey()}`);
  if (accountResp.status !== 200) {
    return { ok: false, status: accountResp.status, codes: 'account-fetch' };
  }

  const sourceAccount = new Account(kp.publicKey(), accountResp.body.sequence);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: ADMIN_PUBLIC,
        asset: Asset.native(),
        amount: drainAmount,
      })
    )
    .setTimeout(60)
    .build();

  tx.sign(kp);
  const xdr = tx.toEnvelope().toXDR('base64');

  const submit = await horizonPost('/transactions', xdr);

  if (submit.status === 200 && submit.body.successful) {
    return { ok: true, hash: submit.body.hash, amount: drainAmount };
  }

  return {
    ok: false,
    status: submit.status,
    codes: submit.body?.extras?.result_codes || submit.body,
  };
}

async function main() {
  const secretsPath = path.join(__dirname, '.onboarded-secrets.json');
  if (!fs.existsSync(secretsPath)) {
    console.error('Missing scripts/.onboarded-secrets.json — run onboard-batch-2.js first.');
    process.exit(1);
  }

  const personas = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < personas.length; i++) {
    const p = personas[i];
    const plan = DRAIN_PLAN[p.publicKey];
    process.stderr.write(
      `[${String(i + 1).padStart(2)}/${personas.length}] ${p.name.padEnd(22)} drain ${(plan || '???').padStart(8)} XLM ... `
    );

    try {
      const result = await drainOne(p);
      if (result.skipped) {
        process.stderr.write('SKIP\n');
      } else if (result.ok) {
        ok++;
        process.stderr.write(`OK  tx=${result.hash.slice(0, 10)}…\n`);
      } else {
        fail++;
        process.stderr.write(`FAIL ${result.status} ${JSON.stringify(result.codes).slice(0, 80)}\n`);
      }
    } catch (err) {
      fail++;
      process.stderr.write(`ERR  ${err.message}\n`);
    }

    // Horizon rate-limits; pace ourselves
    await new Promise((r) => setTimeout(r, 700));
  }

  console.error('');
  console.error(`Done. ok=${ok}, fail=${fail}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
