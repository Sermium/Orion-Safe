import {
  rpc, TransactionBuilder, Networks, Contract, Address,
  nativeToScVal, scValToNative, BASE_FEE,
} from "@stellar/stellar-sdk";

export const config = {
  rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  networkPassphrase: process.env.NETWORK_PASSPHRASE || Networks.TESTNET,
  factoryId: process.env.FACTORY_CONTRACT_ID,           // your VaultFactory C... id
  feeTokenTestnet: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA", // USDC testnet
};

export const server = new rpc.Server(config.rpcUrl, { allowHttp: true });

// Build an unsigned, simulation-prepared XDR for any contract method.
// The client signs this XDR in their wallet, then POSTs it to /submit.
export async function buildContractTx(sourcePublicKey, contractId, method, scArgs) {
  const account = await server.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(180)
    .build();

  // Simulate + assemble so the XDR carries the right Soroban footprint/auth.
  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

// Read-only: simulate without submitting and decode the return value.
export async function simulateRead(contractId, method, scArgs, sourcePublicKey) {
  const account = await server.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return scValToNative(sim.result.retval);
}

// Submit an already-signed XDR coming back from the wallet.
export async function submitSignedXdr(signedXdr) {
  const tx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const sendResp = await server.sendTransaction(tx);
  if (sendResp.status === "ERROR") throw new Error(JSON.stringify(sendResp.errorResult));

  let getResp = await server.getTransaction(sendResp.hash);
  while (getResp.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1000));
    getResp = await server.getTransaction(sendResp.hash);
  }
  return { hash: sendResp.hash, status: getResp.status };
}

// Helpers to convert JSON -> Soroban ScVal matching your contract signatures.
export const sc = {
  address: (v) => new Address(v).toScVal(),
  sym: (v) => nativeToScVal(v, { type: "symbol" }),
  u32: (v) => nativeToScVal(v, { type: "u32" }),
  u64: (v) => nativeToScVal(v, { type: "u64" }),
  i128: (v) => nativeToScVal(BigInt(v), { type: "i128" }),
  bool: (v) => nativeToScVal(v, { type: "bool" }),
  addressVec: (arr) => nativeToScVal(arr.map((a) => new Address(a)), {
    type: "vec",
  }),
};
