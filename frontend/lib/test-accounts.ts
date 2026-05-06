// Testnet-only demo accounts — funded via Stellar Friendbot.
// These are NOT mainnet keys. Safe to commit for development/demo purposes.

export interface TestAccount {
  name:      string;
  handle:    string;
  role:      string;
  location:  string;
  bio:       string;
  initials:  string;
  publicKey: string;
  secretKey: string;
  funded:    boolean;
}

export const TEST_ACCOUNTS: TestAccount[] = [
  {
    name:      'Rohan Sharma',
    handle:    'rohan_s',
    role:      'Options Trader',
    location:  'Bangalore, IN',
    bio:       'SDE-2 by day, DeFi degenerate by night. Trades vol across protocols — found Strix through the Stellar Discord.',
    initials:  'RS',
    publicKey: 'GCSM3UOWL2H27WV6F63J6INHVYUKNRDHCRDZKVAW3NU6FNRQSZNNLGSW',
    secretKey: 'SANC3YXMYZHGUSYAIYTTHJ7NP2JGIMCMCM6U4LWTL6Y3MWWIQ6O5LVT2',
    funded:    true,
  },
  {
    name:      'Ananya Iyer',
    handle:    'ananyai',
    role:      'Liquidity Provider',
    location:  'Chennai, IN',
    bio:       'Into passive yield strategies. Allocates a portion of her crypto portfolio to DeFi vaults every month.',
    initials:  'AI',
    publicKey: 'GBMNYAW4EVLJEPI4SXNAIIW7R3XOCMRM5WMILW7MTIBADKS37SDHPGP4',
    secretKey: 'SBJ3NZ4EE6JARJ4SQAQOPCDU4LZBLJ2IBJ5QZNSC7BRSSXTUW5T6JWFC',
    funded:    true,
  },
  {
    name:      'Karan Malhotra',
    handle:    'karan_m',
    role:      'Market Maker',
    location:  'Delhi, IN',
    bio:       'Runs market-making scripts on a few Stellar DEX pairs. Here to see how on-chain options liquidity behaves.',
    initials:  'KM',
    publicKey: 'GCZLB4XUSS3A2K7Z6Y6D6P53EYLKDLAXWBTICCDYEPXRYOS2MAJRV2C2',
    secretKey: 'SCQHOZWY2WXQPZE4Q25QW6LNCL4XLWPIB66A7UDVO6YGUY7OOJN6NGX4',
    funded:    true,
  },
  {
    name:      'Dev Patel',
    handle:    'devp_xyz',
    role:      'Arbitrageur',
    location:  'Ahmedabad, IN',
    bio:       'Blockchain developer with a thing for price inefficiencies. Monitors multiple Stellar protocols for arb opportunities.',
    initials:  'DP',
    publicKey: 'GCHPPYWSPXPAU7LK4WX5XVPKCVS3YFTPSQFJTTA6R4PPWHNVESZVHTL4',
    secretKey: 'SBVPZ752FKBVGVSMWGOL2BZHVINZEEJDJ4QOHDFZCVK4UAA2EJFGS2HI',
    funded:    true,
  },
  {
    name:      'Shreya Nair',
    handle:    'shreya_n',
    role:      'Hedger',
    location:  'Mumbai, IN',
    bio:       'Analyst at a crypto fund. Uses on-chain options to hedge spot exposure and smooth out portfolio drawdowns.',
    initials:  'SN',
    publicKey: 'GCVE65B3HMCX75FQRXR7PK7SP2DPLH2XG6QMQHLGYXGS43PZ2HDAH5PN',
    secretKey: 'SDIIYYS45HA2P3JV5CE462FW6AUFAVGCLYBTH4SMR7AP75V2UJR5IJPT',
    funded:    true,
  },
  {
    name:      'Rahul Verma',
    handle:    'rahulv',
    role:      'Options Writer',
    location:  'Pune, IN',
    bio:       'Long-time Stellar community member. Writes covered calls for yield and follows IV closely across DeFi options protocols.',
    initials:  'RV',
    publicKey: 'GAVRQTKQ7VXJMBJKHZYK7BRI5OCJDPR26WKSDMR7JEM2WWXZI4ZPPT4L',
    secretKey: 'SBVHWJ7HHXS3FFG5PW2MMSWRJAVLAWCPPNEXS52EHLP4JM7E6KMXJ5CF',
    funded:    true,
  },
];

export const EXPLORER_URL = 'https://stellar.expert/explorer/testnet/account';
