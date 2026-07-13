import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction, isAllowed, setAllowed } from '@stellar/freighter-api';
import { SOROBAN_RPC_URL, NETWORK_PASSPHRASE, TRADE_VAULT_ID } from './constants';
import { Trade } from './store';

const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);

export async function ensureFreighterAllowed() {
  if (await isAllowed()) return true;
  await setAllowed();
  return await isAllowed();
}

async function getAccount(publicKey: string): Promise<StellarSdk.Account> {
  const source = await server.getAccount(publicKey);
  return source;
}

export async function proposeTrade(
  publicKey: string,
  partyB: string,
  serviceA: string,
  serviceB: string,
  collateralStr: string,
  deadlineOffsetSeconds: number
): Promise<string> {
  await ensureFreighterAllowed();
  const account = await getAccount(publicKey);

  const collateralStroops = BigInt(Math.floor(parseFloat(collateralStr) * 10000000));

  const contract = new StellarSdk.Contract(TRADE_VAULT_ID);
  const args = [
    StellarSdk.nativeToScVal(publicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(partyB, { type: 'address' }),
    StellarSdk.nativeToScVal(serviceA, { type: 'string' }),
    StellarSdk.nativeToScVal(serviceB, { type: 'string' }),
    StellarSdk.nativeToScVal(collateralStroops, { type: 'i128' }),
    StellarSdk.nativeToScVal(deadlineOffsetSeconds, { type: 'u64' })
  ];

  const operation = contract.call('propose_trade', ...args);

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  tx = (await server.prepareTransaction(tx)) as StellarSdk.Transaction;
  const signedResult = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
  if (signedResult.error) throw new Error(signedResult.error as string);
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedResult.signedTxXdr, NETWORK_PASSPHRASE) as StellarSdk.Transaction;
  
  const sendResult = await server.sendTransaction(signedTx);
  if (sendResult.status === 'ERROR') throw new Error('Transaction failed');
  return await pollTransaction(sendResult.hash);
}

export async function acceptTrade(publicKey: string, tradeId: number): Promise<string> {
  await ensureFreighterAllowed();
  const account = await getAccount(publicKey);
  const contract = new StellarSdk.Contract(TRADE_VAULT_ID);
  
  const args = [
    StellarSdk.nativeToScVal(publicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(tradeId, { type: 'u64' })
  ];

  const operation = contract.call('accept_trade', ...args);
  let tx = new StellarSdk.TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operation).setTimeout(300).build();

  tx = (await server.prepareTransaction(tx)) as StellarSdk.Transaction;
  const signedResult = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
  if (signedResult.error) throw new Error(signedResult.error as string);
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedResult.signedTxXdr, NETWORK_PASSPHRASE) as StellarSdk.Transaction;
  
  const sendResult = await server.sendTransaction(signedTx);
  if (sendResult.status === 'ERROR') throw new Error('Transaction failed');
  return await pollTransaction(sendResult.hash);
}

export async function confirmDelivery(publicKey: string, tradeId: number): Promise<string> {
  await ensureFreighterAllowed();
  const account = await getAccount(publicKey);
  const contract = new StellarSdk.Contract(TRADE_VAULT_ID);
  
  const args = [
    StellarSdk.nativeToScVal(publicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(tradeId, { type: 'u64' })
  ];

  const operation = contract.call('confirm_delivery', ...args);
  let tx = new StellarSdk.TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operation).setTimeout(300).build();

  tx = (await server.prepareTransaction(tx)) as StellarSdk.Transaction;
  const signedResult = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
  if (signedResult.error) throw new Error(signedResult.error as string);
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedResult.signedTxXdr, NETWORK_PASSPHRASE) as StellarSdk.Transaction;
  
  const sendResult = await server.sendTransaction(signedTx);
  if (sendResult.status === 'ERROR') throw new Error('Transaction failed');
  return await pollTransaction(sendResult.hash);
}

async function pollTransaction(hash: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const response = await server.getTransaction(hash);
    if (response.status === 'SUCCESS') return hash;
    if (response.status === 'FAILED') throw new Error(`Transaction failed.`);
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Transaction timed out waiting for network confirmation.');
}

export async function fetchUserTrades(publicKey: string): Promise<Trade[]> {
  try {
    const account = await getAccount(publicKey).catch(() => new StellarSdk.Account(publicKey, '-1'));
    const contract = new StellarSdk.Contract(TRADE_VAULT_ID);
    
    const args = [
      StellarSdk.nativeToScVal(publicKey, { type: 'address' })
    ];

    const operation = contract.call('get_user_trades', ...args);
    const tx = new StellarSdk.TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(operation).setTimeout(30).build();

    const sim = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      console.error(sim.error);
      return [];
    }
    if (!StellarSdk.rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return [];
    }
    
    const resultVal = sim.result.retval;
    if (!resultVal) return [];

    const tradesVec = StellarSdk.scValToNative(resultVal);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return tradesVec.map((t: any) => {
      let statusStr = 'Proposed';
      if (t.status && t.status.tag) {
        statusStr = t.status.tag; // This extracts the Enum tag Name
      }
      return {
        id: Number(t.id),
        party_a: t.party_a,
        party_b: t.party_b,
        service_a: t.service_a,
        service_b: t.service_b,
        collateral: Number(t.collateral) / 10000000,
        deadline: Number(t.deadline),
        status: statusStr,
        created_at: Number(t.created_at),
        completed_at: Number(t.completed_at),
        dispute_reason: t.dispute_reason
      };
    });
  } catch (err) {
    console.error('Failed to fetch trades', err);
    return [];
  }
}
