#![cfg(test)]
#![allow(clippy::inconsistent_digit_grouping)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

fn create_token(env: &Env, admin: &Address) -> (Address, TokenClient<'static>, StellarAssetClient<'static>) {
    let token_id = env.register_stellar_asset_contract(admin.clone());
    let token = TokenClient::new(env, &token_id);
    let token_sac = StellarAssetClient::new(env, &token_id);
    (token_id, token, token_sac)
}

#[allow(dead_code)]
struct TestSetup {
    env: Env,
    vault: TradeVaultClient<'static>,
    token: TokenClient<'static>,
    token_sac: StellarAssetClient<'static>,
    admin: Address,
    ledger: Address,
    token_id: Address,
    party_a: Address,
    party_b: Address,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let ledger = Address::generate(&env); // mock ledger addr
    let party_a = Address::generate(&env);
    let party_b = Address::generate(&env);

    let (token_id, token, token_sac) = create_token(&env, &admin);

    // Mint collateral to both parties
    token_sac.mint(&party_a, &10_000_0000000i128);
    token_sac.mint(&party_b, &10_000_0000000i128);

    let vault_id = env.register_contract(None, TradeVault);
    let vault = TradeVaultClient::new(&env, &vault_id);

    vault.initialize(&admin, &ledger, &token_id);

    TestSetup {
        env,
        vault,
        token,
        token_sac,
        admin,
        ledger,
        token_id,
        party_a,
        party_b,
    }
}

#[test]
fn test_initialize() {
    let t = setup();
    assert_eq!(t.vault.get_admin(), t.admin);
    assert_eq!(t.vault.get_total_trades(), 0u64);
    assert_eq!(t.vault.get_active_count(), 0u32);
}

#[test]
fn test_propose_trade() {
    let t = setup();
    let svc_a = String::from_str(&t.env, "Logo design (3 concepts)");
    let svc_b = String::from_str(&t.env, "React frontend for landing page");

    let id = t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &1_000_0000000i128, // 1000 XLM collateral
        &604800u64,         // 7 days
    );

    assert_eq!(id, 0u64);
    assert_eq!(t.vault.get_total_trades(), 1u64);

    let trade = t.vault.get_trade(&id);
    assert_eq!(trade.party_a, t.party_a);
    assert_eq!(trade.party_b, t.party_b);
    assert_eq!(trade.status, TradeStatus::Proposed);
    assert_eq!(trade.collateral, 1_000_0000000i128);
}

#[test]
fn test_accept_trade_locks_collateral() {
    let t = setup();
    let svc_a = String::from_str(&t.env, "Solidity audit");
    let svc_b = String::from_str(&t.env, "Tokenomics design");
    let collateral = 500_0000000i128;

    let vault_addr = t.vault.address.clone();
    let bal_a_before = t.token.balance(&t.party_a);
    let bal_b_before = t.token.balance(&t.party_b);

    let id = t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &collateral,
        &604800u64,
    );
    t.vault.accept_trade(&t.party_b, &id);

    let trade = t.vault.get_trade(&id);
    assert_eq!(trade.status, TradeStatus::Active);
    assert_eq!(t.vault.get_active_count(), 1u32);

    // Both parties' balances decreased by collateral
    assert_eq!(t.token.balance(&t.party_a), bal_a_before - collateral);
    assert_eq!(t.token.balance(&t.party_b), bal_b_before - collateral);
    // Vault holds 2x collateral
    assert_eq!(t.token.balance(&vault_addr), collateral * 2);
}

#[test]
fn test_full_trade_completion_returns_collateral() {
    let t = setup();
    let svc_a = String::from_str(&t.env, "Rust smart contract");
    let svc_b = String::from_str(&t.env, "UI/UX design system");
    let collateral = 200_0000000i128;

    let bal_a_before = t.token.balance(&t.party_a);
    let bal_b_before = t.token.balance(&t.party_b);

    let id = t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &collateral,
        &604800u64,
    );
    t.vault.accept_trade(&t.party_b, &id);

    // A confirms delivery
    t.vault.confirm_delivery(&t.party_a, &id);
    let trade = t.vault.get_trade(&id);
    assert_eq!(trade.status, TradeStatus::ConfirmedA);

    // B confirms delivery → trade completes
    t.vault.confirm_delivery(&t.party_b, &id);
    let trade = t.vault.get_trade(&id);
    assert_eq!(trade.status, TradeStatus::Completed);
    assert!(trade.completed_at > 0);

    // Collateral fully returned
    assert_eq!(t.token.balance(&t.party_a), bal_a_before);
    assert_eq!(t.token.balance(&t.party_b), bal_b_before);
    assert_eq!(t.vault.get_active_count(), 0u32);
}

#[test]
fn test_b_confirms_first_then_a() {
    let t = setup();
    let svc_a = String::from_str(&t.env, "Backend API");
    let svc_b = String::from_str(&t.env, "Graphic assets");
    let collateral = 100_0000000i128;

    let id = t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &collateral,
        &604800u64,
    );
    t.vault.accept_trade(&t.party_b, &id);

    // B confirms first
    t.vault.confirm_delivery(&t.party_b, &id);
    let trade = t.vault.get_trade(&id);
    assert_eq!(trade.status, TradeStatus::ConfirmedB);

    // A confirms → complete
    t.vault.confirm_delivery(&t.party_a, &id);
    let trade = t.vault.get_trade(&id);
    assert_eq!(trade.status, TradeStatus::Completed);
}

#[test]
fn test_cancel_proposed_trade() {
    let t = setup();
    let svc_a = String::from_str(&t.env, "Copy writing");
    let svc_b = String::from_str(&t.env, "Photography");

    let id = t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &50_0000000i128,
        &604800u64,
    );
    t.vault.cancel_trade(&t.party_a, &id);

    let trade = t.vault.get_trade(&id);
    assert_eq!(trade.status, TradeStatus::Cancelled);
}

#[test]
fn test_raise_dispute() {
    let t = setup();
    let svc_a = String::from_str(&t.env, "SEO audit");
    let svc_b = String::from_str(&t.env, "Social media content");
    let reason = String::from_str(&t.env, "Deliverable not as agreed");

    let id = t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &100_0000000i128,
        &604800u64,
    );
    t.vault.accept_trade(&t.party_b, &id);
    t.vault.raise_dispute(&t.party_a, &id, &reason);

    let trade = t.vault.get_trade(&id);
    assert_eq!(trade.status, TradeStatus::Disputed);
}

#[test]
fn test_user_trade_list() {
    let t = setup();
    let svc_a = String::from_str(&t.env, "A");
    let svc_b = String::from_str(&t.env, "B");

    t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &10_0000000i128,
        &604800u64,
    );
    t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &10_0000000i128,
        &604800u64,
    );

    let trades_a = t.vault.get_user_trades(&t.party_a);
    let trades_b = t.vault.get_user_trades(&t.party_b);
    assert_eq!(trades_a.len(), 2);
    assert_eq!(trades_b.len(), 2);
}

#[test]
#[should_panic(expected = "cannot trade with yourself")]
fn test_self_trade_fails() {
    let t = setup();
    let svc = String::from_str(&t.env, "Service");
    t.vault.propose_trade(
        &t.party_a,
        &t.party_a,
        &svc,
        &svc,
        &10_0000000i128,
        &604800u64,
    );
}

#[test]
#[should_panic(expected = "collateral must be positive")]
fn test_zero_collateral_fails() {
    let t = setup();
    let svc_a = String::from_str(&t.env, "A");
    let svc_b = String::from_str(&t.env, "B");
    t.vault
        .propose_trade(&t.party_a, &t.party_b, &svc_a, &svc_b, &0i128, &604800u64);
}

#[test]
#[should_panic(expected = "not the counterparty")]
fn test_wrong_party_cannot_accept() {
    let t = setup();
    let third = Address::generate(&t.env);
    let svc_a = String::from_str(&t.env, "A");
    let svc_b = String::from_str(&t.env, "B");
    let id = t.vault.propose_trade(
        &t.party_a,
        &t.party_b,
        &svc_a,
        &svc_b,
        &10_0000000i128,
        &604800u64,
    );
    t.vault.accept_trade(&third, &id);
}
