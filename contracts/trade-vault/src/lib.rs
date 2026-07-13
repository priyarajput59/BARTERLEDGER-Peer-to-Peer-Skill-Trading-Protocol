#![no_std]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, log, symbol_short, token, vec, Address,
    Env, String, Symbol, Vec,
};

// ─── Inter-Contract Interface ─────────────────────────────────────────────────
// Calls into the ReputationLedger contract on trade completion / cancellation

#[contractclient(name = "ReputationLedgerClient")]
pub trait ReputationLedgerInterface {
    fn record_completion(
        env: Env,
        trader_a: Address,
        trader_b: Address,
        trade_id: u64,
        both_confirmed: bool,
    );
    fn record_dispute(env: Env, raiser: Address, trade_id: u64);
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

const ADMIN: Symbol = symbol_short!("ADMIN");
const LEDGER: Symbol = symbol_short!("LEDGER");
const TOKEN: Symbol = symbol_short!("TOKEN");
const NEXT_ID: Symbol = symbol_short!("NEXT_ID");

#[contracttype]
pub enum DataKey {
    Trade(u64),
    UserTrades(Address),
    ActiveCount,
}

// ─── Trade Status ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TradeStatus {
    Proposed,   // Party A proposed, awaiting Party B acceptance
    Active,     // Both accepted, collateral deposited
    ConfirmedA, // Party A confirmed delivery
    ConfirmedB, // Party B confirmed delivery
    Completed,  // Both confirmed → reputation updated
    Disputed,   // Under dispute
    Cancelled,  // Cancelled before activation
}

// ─── Trade Struct ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct Trade {
    pub id: u64,
    pub party_a: Address,  // Proposer
    pub party_b: Address,  // Counterparty
    pub service_a: String, // What A offers
    pub service_b: String, // What B offers
    pub collateral: i128,  // Bond amount in stroops (each party deposits this)
    pub deadline: u64,     // Ledger timestamp deadline
    pub status: TradeStatus,
    pub created_at: u64,
    pub completed_at: u64,
    pub dispute_reason: String,
}

// ─── Events ──────────────────────────────────────────────────────────────────

const EV_PROPOSED: Symbol = symbol_short!("PROPOSED");
const EV_ACCEPTED: Symbol = symbol_short!("ACCEPTED");
const EV_CONFIRMED: Symbol = symbol_short!("CONFIRMED");
const EV_COMPLETED: Symbol = symbol_short!("COMPLETED");
const EV_DISPUTED: Symbol = symbol_short!("DISPUTED");
const EV_CANCELLED: Symbol = symbol_short!("CANCELLED");

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct TradeVault;

#[contractimpl]
impl TradeVault {
    /// Initialize with admin, reputation ledger address, and accepted token
    pub fn initialize(env: Env, admin: Address, ledger_address: Address, token_address: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&LEDGER, &ledger_address);
        env.storage().instance().set(&TOKEN, &token_address);
        env.storage().instance().set(&NEXT_ID, &0u64);
        env.storage().instance().set(&DataKey::ActiveCount, &0u32);
    }

    /// Party A proposes a barter trade
    pub fn propose_trade(
        env: Env,
        party_a: Address,
        party_b: Address,
        service_a: String,    // what A will deliver
        service_b: String,    // what A expects from B
        collateral: i128,     // good-faith bond each party deposits
        deadline_offset: u64, // seconds from now
    ) -> u64 {
        party_a.require_auth();

        if party_a == party_b {
            panic!("cannot trade with yourself");
        }
        if collateral <= 0 {
            panic!("collateral must be positive");
        }
        if service_a.len() == 0 || service_b.len() == 0 {
            panic!("service descriptions required");
        }

        let id: u64 = env.storage().instance().get(&NEXT_ID).unwrap_or(0u64);
        let now = env.ledger().timestamp();

        let trade = Trade {
            id,
            party_a: party_a.clone(),
            party_b: party_b.clone(),
            service_a: service_a.clone(),
            service_b: service_b.clone(),
            collateral,
            deadline: now + deadline_offset,
            status: TradeStatus::Proposed,
            created_at: now,
            completed_at: 0,
            dispute_reason: String::from_str(&env, ""),
        };

        env.storage().persistent().set(&DataKey::Trade(id), &trade);
        Self::push_user_trade(&env, &party_a, id);
        Self::push_user_trade(&env, &party_b, id);
        env.storage().instance().set(&NEXT_ID, &(id + 1));

        let token_addr: Address = env.storage().instance().get(&TOKEN).unwrap();
        let token = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();
        token.transfer(&party_a, &contract_addr, &collateral);

        env.events().publish(
            (EV_PROPOSED, party_a.clone()),
            (id, party_b.clone(), service_a),
        );
        log!(&env, "Trade {} proposed by {}", id, party_a);
        id
    }

    /// Party B accepts and both parties deposit collateral
    pub fn accept_trade(env: Env, party_b: Address, trade_id: u64) {
        party_b.require_auth();

        let mut trade: Trade = Self::get_trade_inner(&env, trade_id);
        if trade.party_b != party_b {
            panic!("not the counterparty");
        }
        if trade.status != TradeStatus::Proposed {
            panic!("trade not in Proposed state");
        }
        if env.ledger().timestamp() > trade.deadline {
            panic!("trade deadline passed");
        }

        let token_addr: Address = env.storage().instance().get(&TOKEN).unwrap();
        let token = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();

        // Party B deposits collateral (Party A already deposited in propose_trade)
        token.transfer(&party_b, &contract_addr, &trade.collateral);

        trade.status = TradeStatus::Active;
        env.storage()
            .persistent()
            .set(&DataKey::Trade(trade_id), &trade);

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveCount)
            .unwrap_or(0u32);
        env.storage()
            .instance()
            .set(&DataKey::ActiveCount, &(count + 1));

        env.events()
            .publish((EV_ACCEPTED, party_b.clone()), (trade_id,));
        log!(&env, "Trade {} accepted, collateral locked", trade_id);
    }

    /// A party confirms they have delivered their service
    pub fn confirm_delivery(env: Env, caller: Address, trade_id: u64) {
        caller.require_auth();

        let mut trade: Trade = Self::get_trade_inner(&env, trade_id);

        if trade.status != TradeStatus::Active
            && trade.status != TradeStatus::ConfirmedA
            && trade.status != TradeStatus::ConfirmedB
        {
            panic!("trade not in confirmable state");
        }

        let is_a = caller == trade.party_a;
        let is_b = caller == trade.party_b;
        if !is_a && !is_b {
            panic!("caller is not a party to this trade");
        }

        // Prevent double-confirm
        if is_a
            && (trade.status == TradeStatus::ConfirmedA || trade.status == TradeStatus::Completed)
        {
            panic!("party A already confirmed");
        }
        if is_b
            && (trade.status == TradeStatus::ConfirmedB || trade.status == TradeStatus::Completed)
        {
            panic!("party B already confirmed");
        }

        // Update status based on who confirmed
        let new_status = match (&trade.status, is_a) {
            (TradeStatus::Active, true) => TradeStatus::ConfirmedA,
            (TradeStatus::Active, false) => TradeStatus::ConfirmedB,
            (TradeStatus::ConfirmedB, true) => TradeStatus::Completed, // B first, then A
            (TradeStatus::ConfirmedA, false) => TradeStatus::Completed, // A first, then B
            _ => panic!("unexpected confirmation state"),
        };

        let now = env.ledger().timestamp();
        if new_status == TradeStatus::Completed {
            trade.completed_at = now;
            Self::finalize_trade(&env, &trade);
        }

        trade.status = new_status.clone();
        env.storage()
            .persistent()
            .set(&DataKey::Trade(trade_id), &trade);

        env.events()
            .publish((EV_CONFIRMED, caller.clone()), (trade_id, is_a));

        if new_status == TradeStatus::Completed {
            env.events()
                .publish((EV_COMPLETED, trade.party_a.clone()), (trade_id,));
            log!(&env, "Trade {} completed successfully!", trade_id);
        }
    }

    /// Either party can raise a dispute before completion
    pub fn raise_dispute(env: Env, caller: Address, trade_id: u64, reason: String) {
        caller.require_auth();

        let mut trade: Trade = Self::get_trade_inner(&env, trade_id);

        if caller != trade.party_a && caller != trade.party_b {
            panic!("not a party to this trade");
        }
        if trade.status != TradeStatus::Active
            && trade.status != TradeStatus::ConfirmedA
            && trade.status != TradeStatus::ConfirmedB
        {
            panic!("cannot dispute at this stage");
        }

        // ── Inter-Contract Call ──────────────────────────────────────────────
        let ledger_addr: Address = env.storage().instance().get(&LEDGER).unwrap();
        let ledger = ReputationLedgerClient::new(&env, &ledger_addr);
        ledger.record_dispute(&caller, &trade_id);
        // ────────────────────────────────────────────────────────────────────

        trade.status = TradeStatus::Disputed;
        trade.dispute_reason = reason.clone();
        env.storage()
            .persistent()
            .set(&DataKey::Trade(trade_id), &trade);

        env.events()
            .publish((EV_DISPUTED, caller.clone()), (trade_id, reason));
    }

    /// Cancel a Proposed trade (before acceptance)
    pub fn cancel_trade(env: Env, caller: Address, trade_id: u64) {
        caller.require_auth();

        let mut trade: Trade = Self::get_trade_inner(&env, trade_id);

        if caller != trade.party_a {
            panic!("only proposer can cancel before acceptance");
        }
        if trade.status != TradeStatus::Proposed {
            panic!("can only cancel Proposed trades");
        }

        let token_addr: Address = env.storage().instance().get(&TOKEN).unwrap();
        let token = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();
        token.transfer(&contract_addr, &trade.party_a, &trade.collateral);

        trade.status = TradeStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Trade(trade_id), &trade);
        env.events().publish((EV_CANCELLED, caller), (trade_id,));
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    fn finalize_trade(env: &Env, trade: &Trade) {
        let token_addr: Address = env.storage().instance().get(&TOKEN).unwrap();
        let token = token::Client::new(env, &token_addr);
        let contract_addr = env.current_contract_address();

        // Return collateral to both parties
        token.transfer(&contract_addr, &trade.party_a, &trade.collateral);
        token.transfer(&contract_addr, &trade.party_b, &trade.collateral);

        // ── Inter-Contract Call → ReputationLedger ───────────────────────────
        let ledger_addr: Address = env.storage().instance().get(&LEDGER).unwrap();
        let ledger = ReputationLedgerClient::new(env, &ledger_addr);
        ledger.record_completion(&trade.party_a, &trade.party_b, &trade.id, &true);
        // ────────────────────────────────────────────────────────────────────

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveCount)
            .unwrap_or(1u32);
        env.storage()
            .instance()
            .set(&DataKey::ActiveCount, &count.saturating_sub(1));
    }

    fn push_user_trade(env: &Env, user: &Address, trade_id: u64) {
        let mut list: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::UserTrades(user.clone()))
            .unwrap_or(vec![env]);
        list.push_back(trade_id);
        env.storage()
            .persistent()
            .set(&DataKey::UserTrades(user.clone()), &list);
    }

    fn get_trade_inner(env: &Env, trade_id: u64) -> Trade {
        env.storage()
            .persistent()
            .get(&DataKey::Trade(trade_id))
            .expect("trade not found")
    }

    // ─── Query Methods ────────────────────────────────────────────────────────

    pub fn get_trade(env: Env, trade_id: u64) -> Trade {
        Self::get_trade_inner(&env, trade_id)
    }

    pub fn get_user_trades(env: Env, user: Address) -> Vec<Trade> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::UserTrades(user.clone()))
            .unwrap_or(vec![&env]);
        let mut result: Vec<Trade> = vec![&env];
        for id in ids.iter() {
            if let Some(t) = env.storage().persistent().get(&DataKey::Trade(id)) {
                result.push_back(t);
            }
        }
        result
    }

    pub fn get_total_trades(env: Env) -> u64 {
        env.storage().instance().get(&NEXT_ID).unwrap_or(0u64)
    }

    pub fn get_active_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ActiveCount)
            .unwrap_or(0u32)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&ADMIN).unwrap()
    }
}

mod test;
