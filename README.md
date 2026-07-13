# ⬡ BARTERLEDGER — Peer-to-Peer Skill Trading Protocol

> **Trade skills, not money. No platforms. No middlemen. Just two wallets and a contract.**

[![CI/CD](https://github.com/yourusername/barterledger/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/barterledger/actions)
[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-2D7A5E?logo=stellar)](https://stellar.expert/explorer/testnet)
[![License: MIT](https://img.shields.io/badge/License-MIT-C4922A.svg)](LICENSE)

---

## 🧭 What is BarterLedger?

BarterLedger is a **decentralized peer-to-peer skill barter protocol** built on Stellar Soroban. Two people can agree to exchange services — "I'll write your smart contract if you design my UI" — with cryptographic enforcement, collateral bonds, and permanent on-chain reputation tracking.

**The problem it solves:** Service exchanges between strangers require trust. BarterLedger replaces trust with code: both parties lock a good-faith bond in the `TradeVault`. Delivering and confirming releases the bond. Failing leads to reputation penalties recorded forever in the `ReputationLedger`.

### Why this wins over generic submissions:

| Feature | BarterLedger | Typical Vault/Escrow |
|---|---|---|
| Domain | Barter marketplace | Token storage |
| Inter-contract calls | ✅ Vault → Ledger on close | ❌ |
| Collateral mechanics | ✅ Both-party bond system | ❌ |
| On-chain reputation | ✅ Algorithmic with streak bonuses | ❌ |
| Dispute system | ✅ Ledger-recorded disputes | ❌ |
| Status machine | ✅ 7-state trade lifecycle | ❌ |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    BARTERLEDGER PROTOCOL                      │
│                                                              │
│  ┌─────────────────────────┐                                 │
│  │       TradeVault         │   Inter-contract call          │
│  │   (Soroban Contract)     │ ──────────────────────────►    │
│  │                          │                                │
│  │  propose_trade()         │   record_completion()          │
│  │  accept_trade()          │   record_dispute()             │
│  │  confirm_delivery()      │                                │
│  │  raise_dispute()     ────┼──►  ┌─────────────────────┐   │
│  │  cancel_trade()          │     │  ReputationLedger   │   │
│  │                          │     │  (Soroban Contract) │   │
│  │  [locks XLM collateral]  │     │                     │   │
│  └─────────────────────────┘     │  get_profile()      │   │
│                                   │  get_trade_record() │   │
│  Trade lifecycle:                 │  Rank: Newcomer →   │   │
│  Proposed → Active →              │  GrandMaster        │   │
│  ConfirmedA/B → Completed         └─────────────────────┘   │
│         └→ Disputed                                          │
│         └→ Cancelled                                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          React 18 + TypeScript Frontend               │   │
│  │  Market │ Propose │ My Trades │ Profile               │   │
│  │  Parchment / Ledger aesthetic · Zustand · Vite        │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contracts

### `trade-vault` — The Exchange Engine

Manages the full lifecycle of a barter trade with collateral enforcement.

| Function | Description |
|---|---|
| `initialize(admin, ledger, token)` | One-time setup |
| `propose_trade(a, b, svc_a, svc_b, collateral, deadline)` | Party A creates a trade proposal |
| `accept_trade(party_b, trade_id)` | Party B accepts; **both collaterals lock** |
| `confirm_delivery(caller, trade_id)` | Confirm your side is delivered |
| `raise_dispute(caller, trade_id, reason)` | Dispute → calls ReputationLedger |
| `cancel_trade(caller, trade_id)` | Cancel before acceptance |
| `get_trade(id)` | Fetch trade details |
| `get_user_trades(address)` | All trades for an address |

**Trade state machine:**
```
Proposed ──accept──► Active ──confirm A──► ConfirmedA ──confirm B──► Completed
                        │                                                  ▲
                        └──confirm B──► ConfirmedB ──confirm A────────────┘
                        │
                        └──dispute──► Disputed
Proposed ──cancel──► Cancelled
```

### `reputation-ledger` — The Trust Record

Called by `TradeVault` via inter-contract communication every time a trade closes.

| Function | Caller | Description |
|---|---|---|
| `record_completion(a, b, id, both)` | TradeVault only | Awards points, resets dispute streak |
| `record_dispute(raiser, id)` | TradeVault only | Penalizes with escalating penalties |
| `get_profile(address)` | Anyone | Fetch trader's full reputation profile |

**Scoring algorithm:**
```
On completion:
  score += 100 (base)
  score += min(floor(completed / 5) × 25, 200)  ← streak bonus
  dispute_streak = 0  ← reset

On dispute:
  score -= min(dispute_streak × 30, 150)  ← escalating penalty
  dispute_streak++

score = max(0, score)  ← never negative
```

**Rank tiers:**
| Rank | Score | Glyph |
|---|---|---|
| Newcomer | 0–99 | ✦ |
| Apprentice | 100–299 | ✧✦ |
| Journeyman | 300–599 | ⬡ |
| Craftsman | 600–999 | ⬡⬡ |
| Artisan | 1000–1799 | ❋ |
| Grand Master | 1800+ | ❋❋ |

---

## 🚀 Quick Start

### Prerequisites

```bash
# Rust + wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Soroban CLI
cargo install soroban-cli --features opt

# Node 20+
node --version
```

### Frontend Dev

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

### Deploy to Testnet (one command)

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This will:
1. Generate & fund a deployer keypair via Friendbot
2. Build and optimize both WASM contracts
3. Deploy `ReputationLedger` then `TradeVault`
4. Initialize both with cross-contract addresses
5. Write `frontend/.env.local` with contract IDs

### Run All Tests

```bash
# Rust contract tests
cd contracts
cargo test --features testutils -- --nocapture

# Frontend tests (Vitest)
cd frontend
npm test
```

---

## 📁 Project Structure

```
barterledger/
├── .github/
│   └── workflows/ci.yml           # Full CI/CD: test → build → deploy → vercel
├── contracts/
│   ├── Cargo.toml                  # Workspace
│   ├── trade-vault/
│   │   └── src/
│   │       ├── lib.rs              # 7-state trade machine + collateral logic
│   │       └── test.rs             # 10 contract tests
│   └── reputation-ledger/
│       └── src/
│           ├── lib.rs              # Inter-contract scoring + rank system
│           └── test.rs             # 9 contract tests
├── frontend/
│   ├── src/
│   │   ├── components/             # RankBadge, StatusBadge, TradeCard, Navigation
│   │   ├── pages/                  # Market, Propose, MyTrades, Profile
│   │   ├── lib/                    # store.ts, constants.ts, mockData.ts
│   │   ├── styles/globals.css      # Parchment/ledger dark aesthetic
│   │   └── test/barterledger.test.tsx  # 30+ Vitest cases
│   ├── vercel.json
│   └── vite.config.ts
├── scripts/deploy.sh               # One-command testnet deploy
├── deployment/testnet.json         # Auto-generated after deploy
└── README.md
```

---

## 🧪 Test Coverage

### Smart Contract Tests (Rust)

**`trade-vault`** — 10 tests:
- `test_initialize` — admin and counters set correctly
- `test_propose_trade` — trade created with correct fields
- `test_accept_trade_locks_collateral` — both balances decrease, vault receives 2× bond
- `test_full_trade_completion_returns_collateral` — balances fully restored after double confirm
- `test_b_confirms_first_then_a` — reverse-order confirmation path
- `test_cancel_proposed_trade` — only proposer can cancel Proposed
- `test_raise_dispute` — status flips to Disputed
- `test_user_trade_list` — both parties see the trade
- `test_self_trade_fails` — panic guard
- `test_wrong_party_cannot_accept` — panic guard

**`reputation-ledger`** — 9 tests:
- `test_initialize`
- `test_record_completion_creates_profiles`
- `test_streak_bonus_activates_at_5_trades`
- `test_dispute_penalty`
- `test_dispute_streak_increases_penalty`
- `test_completion_resets_dispute_streak`
- `test_rank_progression` — all 6 tier boundaries
- `test_score_never_underflows`
- `test_get_profile_returns_default_for_unknown`

### Frontend Tests (Vitest) — 30+ cases
- `truncAddr`, `formatXLM`, `deadlineLabel`, `formatDate` utilities
- `MOCK_TRADES` data integrity (5 tests)
- `MOCK_PROFILES` sort order and validity
- `RANK_META` structure and ascending min scores
- `TRADE_STATUS_META` completeness
- Scoring algorithm (7 tests): base, streak, disputes, reset, underflow
- Rank boundary mapping (8 cases)
- `RankBadge` rendering (4 tests)
- `StatusBadge` rendering (4 tests)

---

## 🎨 Design System

**"Ledger Book" aesthetic** — dark linen, ink, and notarial seals.

| Token | Value | Usage |
|---|---|---|
| `ink` | `#0C0F0A` | Page background |
| `ledger` | `#141810` | Card fill |
| `teal` | `#2D7A5E` | Primary action / Party A |
| `amber` | `#C4922A` | Bond / Party B / CTA |
| `parchment` | `#E8E0CC` | Primary text |
| `sage` | `#8FA882` | Secondary text |
| `seal` | `#8B2020` | Dispute / danger |

Signature elements:
- **Ledger lines** — repeating horizontal rules as CSS background
- **Contract cards** — corner bracket marks + diagonal "LEDGER" watermark
- **Seal rings** — amber-bordered circles for rank/status icons
- **Dashed borders** — document-style separators

---

## 🔄 CI/CD Pipeline

```
push to main
    │
    ├── 🦀 contract-tests
    │   ├── cargo fmt
    │   ├── cargo clippy
    │   ├── cargo test (trade-vault, 10 tests)
    │   ├── cargo test (reputation-ledger, 9 tests)
    │   └── wasm build + optimize
    │
    ├── ⚡ frontend-tests
    │   ├── eslint
    │   ├── vitest (30+ tests)
    │   └── vite build
    │
    └── 🚀 deploy (main only)
        ├── Deploy ReputationLedger
        ├── Deploy TradeVault
        ├── Initialize (cross-referencing addresses)
        └── vercel --prod
```

---

## 🔗 Deployed Contracts

| Contract | Address |
|---|---|
| TradeVault | `See deployment/testnet.json` |
| ReputationLedger | `See deployment/testnet.json` |

→ [Stellar Expert Testnet Explorer](https://stellar.expert/explorer/testnet)

---

## 📄 License

MIT © 2024 BarterLedger

---

*Built for the Stellar Hackathon — Level 3 Orange Belt.*  
*"Your reputation is your collateral."*
