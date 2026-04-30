// Testnet-only demo accounts — funded via Stellar Friendbot.
// These are NOT mainnet keys. Safe to commit for development/demo purposes.

export interface TestAccount {
  name:      string;
  role:      string;
  tag:       string;
  publicKey: string;
  secretKey: string;
  funded:    boolean;
}

export const TEST_ACCOUNTS: TestAccount[] = [
  {
    name:      'Alice',
    role:      'Options Trader',
    tag:       'ALICE',
    publicKey: 'GCSM3UOWL2H27WV6F63J6INHVYUKNRDHCRDZKVAW3NU6FNRQSZNNLGSW',
    secretKey: 'SANC3YXMYZHGUSYAIYTTHJ7NP2JGIMCMCM6U4LWTL6Y3MWWIQ6O5LVT2',
    funded:    true,
  },
  {
    name:      'Bob',
    role:      'Liquidity Provider',
    tag:       'BOB',
    publicKey: 'GBMNYAW4EVLJEPI4SXNAIIW7R3XOCMRM5WMILW7MTIBADKS37SDHPGP4',
    secretKey: 'SBJ3NZ4EE6JARJ4SQAQOPCDU4LZBLJ2IBJ5QZNSC7BRSSXTUW5T6JWFC',
    funded:    true,
  },
  {
    name:      'Charlie',
    role:      'Market Maker',
    tag:       'CHARLIE',
    publicKey: 'GCZLB4XUSS3A2K7Z6Y6D6P53EYLKDLAXWBTICCDYEPXRYOS2MAJRV2C2',
    secretKey: 'SCQHOZWY2WXQPZE4Q25QW6LNCL4XLWPIB66A7UDVO6YGUY7OOJN6NGX4',
    funded:    true,
  },
  {
    name:      'Diana',
    role:      'Arbitrageur',
    tag:       'DIANA',
    publicKey: 'GCHPPYWSPXPAU7LK4WX5XVPKCVS3YFTPSQFJTTA6R4PPWHNVESZVHTL4',
    secretKey: 'SBVPZ752FKBVGVSMWGOL2BZHVINZEEJDJ4QOHDFZCVK4UAA2EJFGS2HI',
    funded:    true,
  },
  {
    name:      'Eve',
    role:      'Hedger',
    tag:       'EVE',
    publicKey: 'GCVE65B3HMCX75FQRXR7PK7SP2DPLH2XG6QMQHLGYXGS43PZ2HDAH5PN',
    secretKey: 'SDIIYYS45HA2P3JV5CE462FW6AUFAVGCLYBTH4SMR7AP75V2UJR5IJPT',
    funded:    true,
  },
  {
    name:      'Frank',
    role:      'Options Writer',
    tag:       'FRANK',
    publicKey: 'GAVRQTKQ7VXJMBJKHZYK7BRI5OCJDPR26WKSDMR7JEM2WWXZI4ZPPT4L',
    secretKey: 'SBVHWJ7HHXS3FFG5PW2MMSWRJAVLAWCPPNEXS52EHLP4JM7E6KMXJ5CF',
    funded:    true,
  },
];

export const EXPLORER_URL = 'https://stellar.expert/explorer/testnet/account';
