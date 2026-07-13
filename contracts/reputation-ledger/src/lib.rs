#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, log, symbol_short, Address, Env, Symbol};

// ─── Storage Keys ────────────────────────────────────────────────────────────

const ADMIN: Symbol = symbol_short!("ADMIN");
const VAULT: Symbol = symbol_short!("VAULT");
const TOTAL_COMP: Symbol = symbol_short!("TOTALCOMP");

#[contracttype]
pub enum DataKey {
    Profile(Address),
    TradeRecord(u64),
    TotalTraders,
}

// ─── Trader Rank ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TraderRank {
    Newcomer,    // 0–99
    Apprentice,  // 100–299
    Journeyman,  // 300–599
    Craftsman,   // 600–999
    Artisan,     // 1000–1799
    GrandMaster, // 1800+
}

// ─── Trader Profile ───────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct TraderProfile {
    pub trader: Address,
    pub reputation_score: u64,
    pub rank: TraderRank,
    pub trades_completed: u32,
    pub trades_disputed: u32,
    pub dispute_streak: u32, // consecutive disputes (penalty multiplier)
    pub last_activity: u64,
}

// ─── Compact record written per trade ────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct TradeRecord {
    pub trade_id: u64,
    pub trader_a: Address,
    pub trader_b: Address,
    pub completed: bool,
    pub timestamp: u64,
}

// ─── Events ──────────────────────────────────────────────────────────────────

const EV_SCORED: Symbol = symbol_short!("SCORED");
const EV_RANK_UP: Symbol = symbol_short!("RANK_UP");
const EV_DISPUTED: Symbol = symbol_short!("DISPUTED");

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct ReputationLedger;

#[contractimpl]
impl ReputationLedger {
    pub fn initialize(env: Env, admin: Address, vault_address: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&VAULT, &vault_address);
        env.storage().instance().set(&TOTAL_COMP, &0u32);
        env.storage().instance().set(&DataKey::TotalTraders, &0u32);
    }

    /// Called by TradeVault when a trade completes successfully
    /// This is the core inter-contract entry point
    pub fn record_completion(
        env: Env,
        trader_a: Address,
        trader_b: Address,
        trade_id: u64,
        both_confirmed: bool,
    ) {
        // Only the registered vault contract may call this
        let vault: Address = env.storage().instance().get(&VAULT).unwrap();
        vault.require_auth();

        let now = env.ledger().timestamp();

        // Write trade record
        let record = TradeRecord {
            trade_id,
            trader_a: trader_a.clone(),
            trader_b: trader_b.clone(),
            completed: both_confirmed,
            timestamp: now,
        };
        env.storage()
            .persistent()
            .set(&DataKey::TradeRecord(trade_id), &record);

        // Update both trader profiles
        Self::update_profile(&env, &trader_a, true, now);
        Self::update_profile(&env, &trader_b, true, now);

        let total: u32 = env.storage().instance().get(&TOTAL_COMP).unwrap_or(0u32);
        env.storage().instance().set(&TOTAL_COMP, &(total + 1));

        env.events()
            .publish((EV_SCORED, trader_a.clone()), (trade_id, both_confirmed));

        log!(
            &env,
            "Trade {} recorded: both_confirmed={}",
            trade_id,
            both_confirmed
        );
    }

    /// Called by TradeVault when a dispute is raised
    pub fn record_dispute(env: Env, raiser: Address, trade_id: u64) {
        let vault: Address = env.storage().instance().get(&VAULT).unwrap();
        vault.require_auth();

        let now = env.ledger().timestamp();
        Self::update_profile(&env, &raiser, false, now);

        env.events()
            .publish((EV_DISPUTED, raiser.clone()), (trade_id,));

        log!(
            &env,
            "Dispute recorded for trade {} by {}",
            trade_id,
            raiser
        );
    }

    // ─── Scoring Logic ────────────────────────────────────────────────────────
    //
    // On completion:   +100 base  + streak_bonus(streak) − dispute_penalty
    // On dispute:      −50        + dispute_streak increments
    // streak_bonus:    floor(completed / 5) * 25, capped at 200
    // dispute_penalty: dispute_streak * 30

    fn update_profile(env: &Env, trader: &Address, completed: bool, now: u64) {
        let is_new = !env
            .storage()
            .persistent()
            .has(&DataKey::Profile(trader.clone()));
        let mut profile: TraderProfile = env
            .storage()
            .persistent()
            .get(&DataKey::Profile(trader.clone()))
            .unwrap_or(TraderProfile {
                trader: trader.clone(),
                reputation_score: 0,
                rank: TraderRank::Newcomer,
                trades_completed: 0,
                trades_disputed: 0,
                dispute_streak: 0,
                last_activity: now,
            });

        let old_rank = profile.rank.clone();

        if completed {
            profile.trades_completed += 1;
            profile.dispute_streak = 0; // reset on good completion

            let streak_bonus: u64 = ((profile.trades_completed / 5) as u64 * 25).min(200);
            let gain: u64 = 100 + streak_bonus;
            profile.reputation_score = profile.reputation_score.saturating_add(gain);
        } else {
            // dispute
            profile.trades_disputed += 1;
            profile.dispute_streak += 1;

            let penalty: u64 = (profile.dispute_streak as u64 * 30).min(150);
            profile.reputation_score = profile.reputation_score.saturating_sub(penalty);
        }

        profile.rank = Self::score_to_rank(profile.reputation_score);
        profile.last_activity = now;

        env.storage()
            .persistent()
            .set(&DataKey::Profile(trader.clone()), &profile);

        if is_new {
            let total: u32 = env
                .storage()
                .instance()
                .get(&DataKey::TotalTraders)
                .unwrap_or(0u32);
            env.storage()
                .instance()
                .set(&DataKey::TotalTraders, &(total + 1));
        }

        // Emit rank-up event
        if profile.rank != old_rank {
            env.events()
                .publish((EV_RANK_UP, trader.clone()), (profile.reputation_score,));
        }
    }

    fn score_to_rank(score: u64) -> TraderRank {
        match score {
            0..=99 => TraderRank::Newcomer,
            100..=299 => TraderRank::Apprentice,
            300..=599 => TraderRank::Journeyman,
            600..=999 => TraderRank::Craftsman,
            1000..=1799 => TraderRank::Artisan,
            _ => TraderRank::GrandMaster,
        }
    }

    // ─── Query Methods ────────────────────────────────────────────────────────

    pub fn get_profile(env: Env, trader: Address) -> TraderProfile {
        env.storage()
            .persistent()
            .get(&DataKey::Profile(trader.clone()))
            .unwrap_or(TraderProfile {
                trader: trader.clone(),
                reputation_score: 0,
                rank: TraderRank::Newcomer,
                trades_completed: 0,
                trades_disputed: 0,
                dispute_streak: 0,
                last_activity: 0,
            })
    }

    pub fn get_trade_record(env: Env, trade_id: u64) -> TradeRecord {
        env.storage()
            .persistent()
            .get(&DataKey::TradeRecord(trade_id))
            .expect("trade record not found")
    }

    pub fn get_total_completions(env: Env) -> u32 {
        env.storage().instance().get(&TOTAL_COMP).unwrap_or(0u32)
    }

    pub fn get_total_traders(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalTraders)
            .unwrap_or(0u32)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&ADMIN).unwrap()
    }
}

mod test;
