// Current Level 5 deployment on Monad testnet (chain id 10143), per
// README.md's "Live on Monad testnet" table. Redeployed 2026-10-05 to add
// ProviderStats (see docs/TECHNICAL_README.md) — the pair before this one
// was exercised live via the Chainlink CRE workflow but predates
// providerStats().
export const CHAIN_ID = 10_143;

export const CAPACITY_MARKET_ADDRESS =
  "0xb2bEed70CA03F9ae86276f14aAB79F6F36f681C3" as const;

export const CAPACITY_POOL_ADDRESS =
  "0xA5460952b9445C2CC5daf08D4808C09f4458Aa11" as const;
