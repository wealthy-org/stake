export type MarketStatus = "draft" | "open" | "locked" | "resolution_pending" | "resolved" | "cancelled";

export interface MarketRow {
  id: string;
  question: string;
  asset_symbol: string;
  oracle_source: string;
  strike_price: string;
  comparison: "gt" | "gte" | "lt" | "lte";
  betting_opens_at: string;
  betting_closes_at: string;
  resolution_timestamp: string;
  resolution_window_sec: number;
  protocol_fee_bps: number;
  min_bet: string;
  max_bet: string;
  status: MarketStatus;
  yes_pool: string;
  no_pool: string;
  resolved_price: string | null;
  resolved_at: string | null;
  report_timestamp: string | null;
  yes_won: boolean | null;
  protocol_fee: string | null;
  net_losing_pool: string | null;
  reward_per_winning_share: string | null;
  cancel_reason: string | null;
  created_at: string;
  bettor_count?: number;
}

export interface PositionRow {
  market_id: string;
  address: string;
  yes_stake: string;
  no_stake: string;
  payout_claimed: boolean;
  loss_reward_claimed: boolean;
  realized_loss: string | null;
  paper_minted: string | null;
}

export interface BetRow {
  id: number;
  market_id: string;
  address: string;
  side: "yes" | "no";
  amount: string;
  created_at: string;
}

export interface WalletPosition extends PositionRow {
  question: string;
  status: MarketStatus;
  yes_won: boolean | null;
}

export interface WalletSummary {
  address: string;
  virtualBalance: string;
  paperBalance: string;
  paperTotalMinted: string;
  positions: WalletPosition[];
}

export interface PaperSummary {
  supply: string;
  genesisSupply: string;
  cumulativeRealizedLoss: string;
  currentEmissionRatePerDollar: number;
  transfersEnabled: boolean;
}

export interface ProtocolStats {
  totalWagered: string;
  uniqueBettors: number;
  totalMarkets: number;
  resolvedMarkets: number;
  activeMarkets: number;
  realizedNetLosses: string;
  paperCreated: string;
  protocolFees: string;
}

export interface ActivityEvent {
  id: number;
  market_id: string | null;
  question: string | null;
  type: string;
  payload: Record<string, any>;
  created_at: string;
}
