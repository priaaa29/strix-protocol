export interface CommunityAccount {
  name:      string;
  handle:    string;
  role:      string;
  location:  string;
  bio:       string;
  initials:  string;
  publicKey: string;
}

export const COMMUNITY_ACCOUNTS: CommunityAccount[] = [
  {
    name:      'Rohan Sharma',
    handle:    'rohan_s',
    role:      'Options Trader',
    location:  'Bangalore, IN',
    bio:       'SDE-2 by day, DeFi degenerate by night. Trades vol across protocols — found Strix through the Stellar Discord.',
    initials:  'RS',
    publicKey: 'GCSM3UOWL2H27WV6F63J6INHVYUKNRDHCRDZKVAW3NU6FNRQSZNNLGSW',
  },
  {
    name:      'Ananya Iyer',
    handle:    'ananyai',
    role:      'Liquidity Provider',
    location:  'Chennai, IN',
    bio:       'Into passive yield strategies. Allocates a portion of her crypto portfolio to DeFi vaults every month.',
    initials:  'AI',
    publicKey: 'GBMNYAW4EVLJEPI4SXNAIIW7R3XOCMRM5WMILW7MTIBADKS37SDHPGP4',
  },
  {
    name:      'Karan Malhotra',
    handle:    'karan_m',
    role:      'Market Maker',
    location:  'Delhi, IN',
    bio:       'Runs market-making scripts on a few Stellar DEX pairs. Here to see how on-chain options liquidity behaves.',
    initials:  'KM',
    publicKey: 'GCZLB4XUSS3A2K7Z6Y6D6P53EYLKDLAXWBTICCDYEPXRYOS2MAJRV2C2',
  },
  {
    name:      'Dev Patel',
    handle:    'devp_xyz',
    role:      'Arbitrageur',
    location:  'Ahmedabad, IN',
    bio:       'Blockchain developer with a thing for price inefficiencies. Monitors multiple Stellar protocols for arb opportunities.',
    initials:  'DP',
    publicKey: 'GCHPPYWSPXPAU7LK4WX5XVPKCVS3YFTPSQFJTTA6R4PPWHNVESZVHTL4',
  },
  {
    name:      'Shreya Nair',
    handle:    'shreya_n',
    role:      'Hedger',
    location:  'Mumbai, IN',
    bio:       'Analyst at a crypto fund. Uses on-chain options to hedge spot exposure and smooth out portfolio drawdowns.',
    initials:  'SN',
    publicKey: 'GCVE65B3HMCX75FQRXR7PK7SP2DPLH2XG6QMQHLGYXGS43PZ2HDAH5PN',
  },
  {
    name:      'Rahul Verma',
    handle:    'rahulv',
    role:      'Options Writer',
    location:  'Pune, IN',
    bio:       'Long-time Stellar community member. Writes covered calls for yield and follows IV closely across DeFi options protocols.',
    initials:  'RV',
    publicKey: 'GAVRQTKQ7VXJMBJKHZYK7BRI5OCJDPR26WKSDMR7JEM2WWXZI4ZPPT4L',
  },
];

export const EXPLORER_URL = 'https://stellar.expert/explorer/testnet/account';
