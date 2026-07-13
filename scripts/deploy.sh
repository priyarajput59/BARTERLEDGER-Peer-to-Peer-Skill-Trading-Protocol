#!/usr/bin/env bash
# =============================================================================
# BarterLedger — Deploy to Stellar Testnet
# Usage: ./scripts/deploy.sh
# =============================================================================
set -euo pipefail

TEAL='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${TEAL}[BARTER]${NC} $*"; }
ok()    { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
error() { echo -e "${RED}[ERROR ]${NC} $*"; exit 1; }

log "BarterLedger — Stellar Testnet Deployment"
echo "==========================================="

command -v soroban >/dev/null 2>&1 || error "soroban CLI not found. Run: cargo install soroban-cli --features opt"
command -v cargo   >/dev/null 2>&1 || error "cargo not found. Install Rust: https://rustup.rs"
command -v jq      >/dev/null 2>&1 || error "jq not found."

# ── Network ───────────────────────────────────────────────────────────────────
log "Configuring testnet..."
soroban network add \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  testnet 2>/dev/null || warn "testnet already configured"

# ── Keypair ───────────────────────────────────────────────────────────────────
log "Setting up deployer keypair..."
soroban keys generate barter-deployer --network testnet 2>/dev/null || warn "Key already exists"
DEPLOYER=$(soroban keys address barter-deployer)
ok "Deployer: $DEPLOYER"

# ── Fund ──────────────────────────────────────────────────────────────────────
log "Funding via Friendbot..."
curl -sf "https://friendbot.stellar.org?addr=$DEPLOYER" > /dev/null || warn "Friendbot may have already funded"
ok "Account funded"

# ── Build ─────────────────────────────────────────────────────────────────────
log "Building contracts..."
cd contracts
cargo build --target wasm32-unknown-unknown --release \
  -p trade-vault \
  -p reputation-ledger
ok "WASM build complete"

# ── Optimize ─────────────────────────────────────────────────────────────────
log "Optimizing WASM..."
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/trade_vault.wasm \
  --wasm-out target/wasm32-unknown-unknown/release/trade_vault.optimized.wasm

soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/reputation_ledger.wasm \
  --wasm-out target/wasm32-unknown-unknown/release/reputation_ledger.optimized.wasm
ok "Optimization complete"

# ── Deploy ReputationLedger first ─────────────────────────────────────────────
log "Deploying ReputationLedger..."
LEDGER_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/reputation_ledger.optimized.wasm \
  --source barter-deployer \
  --network testnet)
ok "ReputationLedger: $LEDGER_ID"

# ── Deploy TradeVault ─────────────────────────────────────────────────────────
log "Deploying TradeVault..."
VAULT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/trade_vault.optimized.wasm \
  --source barter-deployer \
  --network testnet)
ok "TradeVault: $VAULT_ID"

# ── Initialize ReputationLedger ───────────────────────────────────────────────
log "Initializing ReputationLedger..."
INIT_LEDGER_TX=$(soroban contract invoke \
  --id "$LEDGER_ID" \
  --source barter-deployer \
  --network testnet \
  -- initialize \
  --admin "$DEPLOYER" \
  --vault_address "$VAULT_ID")
ok "ReputationLedger initialized (tx: ${INIT_LEDGER_TX:0:16}...)"

# ── Initialize TradeVault ─────────────────────────────────────────────────────
log "Initializing TradeVault (using native XLM as collateral token)..."
# For testnet: use the native XLM SAC address
NATIVE_TOKEN=$(soroban contract id asset \
  --asset native \
  --network testnet 2>/dev/null || echo "$DEPLOYER")

INIT_VAULT_TX=$(soroban contract invoke \
  --id "$VAULT_ID" \
  --source barter-deployer \
  --network testnet \
  -- initialize \
  --admin "$DEPLOYER" \
  --ledger_address "$LEDGER_ID" \
  --token_address "$NATIVE_TOKEN")
ok "TradeVault initialized (tx: ${INIT_VAULT_TX:0:16}...)"

# ── Write env ─────────────────────────────────────────────────────────────────
cd ..
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

mkdir -p deployment

cat > frontend/.env.local << EOF
VITE_TRADE_VAULT_ID=$VAULT_ID
VITE_REPUTATION_LEDGER_ID=$LEDGER_ID
VITE_TOKEN_ID=$NATIVE_TOKEN
EOF

cat > deployment/testnet.json << EOF
{
  "network":            "testnet",
  "deployed_at":        "$TIMESTAMP",
  "deployer":           "$DEPLOYER",
  "trade_vault":        "$VAULT_ID",
  "reputation_ledger":  "$LEDGER_ID",
  "token":              "$NATIVE_TOKEN",
  "vault_init_tx":      "$INIT_VAULT_TX",
  "ledger_init_tx":     "$INIT_LEDGER_TX"
}
EOF

echo ""
echo "==========================================="
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo "==========================================="
echo ""
echo "  TradeVault        : $VAULT_ID"
echo "  ReputationLedger  : $LEDGER_ID"
echo "  Token (native)    : $NATIVE_TOKEN"
echo ""
echo "  Explorer (Vault)  : https://stellar.expert/explorer/testnet/contract/$VAULT_ID"
echo "  Explorer (Ledger) : https://stellar.expert/explorer/testnet/contract/$LEDGER_ID"
echo ""
echo "  frontend/.env.local has been written."
echo "  Run: cd frontend && npm run dev"
echo ""
