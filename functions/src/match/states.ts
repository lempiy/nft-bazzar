export enum MatchStates {
  New = "new",
  AccountReady = "account-ready",
  PlayersJoined = "players-joined",
  Started = "started",
  Finished = "finished",
  LootResolved = "loot-resolve",
}

export interface IMatch {
  date: Date;
  account_key?: string;
  state: MatchStates;
  arbiter_key?: string;
  creator_key: string;
  game_id?: string;
  agreement_id?: string;
  player_one?: PlayerBet;
  player_two?: PlayerBet;
  winner_key?: string;
}

export interface PlayerBet {
  player_authority: string;
  player_ata: string;
  player_mint_key: string;
  arbiter_ata: string;
}

export interface INFT {
  account_id: string;
  owner: string;
  authority: string;
  mint_key: string;
  mint_tx_id: string;
  // meta: NFTMeta
  meta_url: string;
}
