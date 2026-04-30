#!/usr/bin/env node
// Generates 6 Stellar testnet keypairs and funds each via Friendbot.
// Run: node scripts/create-test-accounts.js

const { Keypair } = require('@stellar/stellar-sdk');
const https = require('https');

const TEST_USERS = [
  { name: 'Alice',   role: 'Options Trader',     tag: 'ALICE'  },
  { name: 'Bob',     role: 'Liquidity Provider',  tag: 'BOB'    },
  { name: 'Charlie', role: 'Market Maker',        tag: 'CHARLIE' },
  { name: 'Diana',   role: 'Arbitrageur',         tag: 'DIANA'  },
  { name: 'Eve',     role: 'Hedger',              tag: 'EVE'    },
  { name: 'Frank',   role: 'Options Writer',      tag: 'FRANK'  },
];

function friendbotFund(publicKey) {
  return new Promise((resolve, reject) => {
    const url = `https://friendbot.stellar.org/?addr=${publicKey}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch {
          reject(new Error(`Failed to parse friendbot response: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const accounts = [];

  for (const user of TEST_USERS) {
    const kp = Keypair.random();
    process.stderr.write(`Funding ${user.name} (${kp.publicKey()})... `);

    try {
      const result = await friendbotFund(kp.publicKey());
      const funded = !!result.successful || !!result._links;
      process.stderr.write(funded ? 'OK\n' : `FAIL: ${JSON.stringify(result)}\n`);
      accounts.push({
        name:      user.name,
        role:      user.role,
        tag:       user.tag,
        publicKey: kp.publicKey(),
        secretKey: kp.secret(),
        funded,
      });
    } catch (err) {
      process.stderr.write(`ERROR: ${err.message}\n`);
      accounts.push({
        name:      user.name,
        role:      user.role,
        tag:       user.tag,
        publicKey: kp.publicKey(),
        secretKey: kp.secret(),
        funded:    false,
      });
    }
  }

  process.stdout.write(JSON.stringify(accounts, null, 2) + '\n');
}

main();
