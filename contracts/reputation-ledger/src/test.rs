#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup() -> (Env, ReputationLedgerClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ReputationLedger);
    let client      = ReputationLedgerClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let vault = Address::generate(&env);

    client.initialize(&admin, &vault);
    (env, client, admin, vault)
}

#[test]
fn test_initialize() {
    let (_, client, admin, _) = setup();
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_total_completions(), 0u32);
    assert_eq!(client.get_total_traders(), 0u32);
}

#[test]
fn test_record_completion_creates_profiles() {
    let (env, client, _, vault) = setup();
    let trader_a = Address::generate(&env);
    let trader_b = Address::generate(&env);

    client.record_completion(&trader_a, &trader_b, &0u64, &true);

    assert_eq!(client.get_total_completions(), 1u32);
    assert_eq!(client.get_total_traders(), 2u32);

    let profile_a = client.get_profile(&trader_a);
    assert_eq!(profile_a.trades_completed, 1u32);
    assert_eq!(profile_a.reputation_score, 100u64); // base 100
    assert_eq!(profile_a.rank, TraderRank::Apprentice);

    let profile_b = client.get_profile(&trader_b);
    assert_eq!(profile_b.trades_completed, 1u32);
    assert_eq!(profile_b.reputation_score, 100u64);
}

#[test]
fn test_streak_bonus_activates_at_5_trades() {
    let (env, client, _, _) = setup();
    let trader_a = Address::generate(&env);
    let trader_b = Address::generate(&env);

    // 5 completions → streak bonus kicks in on 5th
    for i in 0u64..5 {
        client.record_completion(&trader_a, &trader_b, &i, &true);
    }

    let profile = client.get_profile(&trader_a);
    // 4 × 100 + 1 × (100 + 25) = 525
    assert_eq!(profile.reputation_score, 525u64);
    assert_eq!(profile.trades_completed, 5u32);
    assert_eq!(profile.rank, TraderRank::Journeyman);
}

#[test]
fn test_dispute_penalty() {
    let (env, client, _, _) = setup();
    let trader   = Address::generate(&env);
    let other    = Address::generate(&env);

    // First complete one trade to get 100 pts
    client.record_completion(&trader, &other, &0u64, &true);
    assert_eq!(client.get_profile(&trader).reputation_score, 100u64);

    // Raise a dispute (−30 for first dispute)
    client.record_dispute(&trader, &1u64);
    let profile = client.get_profile(&trader);
    assert_eq!(profile.reputation_score, 70u64);
    assert_eq!(profile.trades_disputed,  1u32);
    assert_eq!(profile.dispute_streak,   1u32);
}

#[test]
fn test_dispute_streak_increases_penalty() {
    let (env, client, _, _) = setup();
    let trader = Address::generate(&env);
    let other  = Address::generate(&env);

    // Build up some score first (5 trades = 525 pts)
    for i in 0u64..5 { client.record_completion(&trader, &other, &i, &true); }

    // 3 consecutive disputes: −30, −60, −90
    client.record_dispute(&trader, &10u64);
    client.record_dispute(&trader, &11u64);
    client.record_dispute(&trader, &12u64);

    let profile = client.get_profile(&trader);
    // 525 − 30 − 60 − 90 = 345
    assert_eq!(profile.reputation_score, 345u64);
    assert_eq!(profile.dispute_streak,   3u32);
}

#[test]
fn test_completion_resets_dispute_streak() {
    let (env, client, _, _) = setup();
    let trader_a = Address::generate(&env);
    let trader_b = Address::generate(&env);

    client.record_completion(&trader_a, &trader_b, &0u64, &true);
    client.record_dispute(&trader_a, &1u64);
    assert_eq!(client.get_profile(&trader_a).dispute_streak, 1u32);

    // Completing resets streak
    client.record_completion(&trader_a, &trader_b, &2u64, &true);
    assert_eq!(client.get_profile(&trader_a).dispute_streak, 0u32);
}

#[test]
fn test_rank_progression() {
    assert_eq!(ReputationLedger::score_to_rank(0),    TraderRank::Newcomer);
    assert_eq!(ReputationLedger::score_to_rank(99),   TraderRank::Newcomer);
    assert_eq!(ReputationLedger::score_to_rank(100),  TraderRank::Apprentice);
    assert_eq!(ReputationLedger::score_to_rank(299),  TraderRank::Apprentice);
    assert_eq!(ReputationLedger::score_to_rank(300),  TraderRank::Journeyman);
    assert_eq!(ReputationLedger::score_to_rank(600),  TraderRank::Craftsman);
    assert_eq!(ReputationLedger::score_to_rank(1000), TraderRank::Artisan);
    assert_eq!(ReputationLedger::score_to_rank(1800), TraderRank::GrandMaster);
    assert_eq!(ReputationLedger::score_to_rank(9999), TraderRank::GrandMaster);
}

#[test]
fn test_score_never_underflows() {
    let (env, client, _, _) = setup();
    let trader = Address::generate(&env);

    // Multiple disputes with zero score
    for i in 0u64..5 { client.record_dispute(&trader, &i); }

    let profile = client.get_profile(&trader);
    assert_eq!(profile.reputation_score, 0u64); // saturating_sub prevents underflow
}

#[test]
fn test_get_profile_returns_default_for_unknown() {
    let (env, client, _, _) = setup();
    let unknown = Address::generate(&env);

    let profile = client.get_profile(&unknown);
    assert_eq!(profile.reputation_score, 0u64);
    assert_eq!(profile.rank, TraderRank::Newcomer);
    assert_eq!(profile.trades_completed, 0u32);
}
