export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Orion Safe / Stellar Vault API",
    version: "0.1.0",
    description:
      "REST API for creating and operating Stellar Vault treasury vaults on Soroban. " +
      "State-changing endpoints return an unsigned transaction XDR (because contracts " +
      "use require_auth). Sign it in your wallet and POST it to /submit. Creation and " +
      "per-action fees are collected on-chain by the contracts.",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/vaults": {
      post: {
        summary: "Create a new vault (factory). Fee charged on-chain to creator.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateVault" } } },
        },
        responses: {
          200: { description: "Unsigned XDR", content: { "application/json": { schema: { $ref: "#/components/schemas/UnsignedTx" } } } },
          400: { description: "Bad request" },
        },
      },
    },
    "/factory/fee": {
      get: {
        summary: "Get current vault-creation fee",
        parameters: [{ name: "source", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Fee amount" } },
      },
    },
    "/vaults/{id}/config": {
      get: {
        summary: "Read vault configuration",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "VaultConfig" } },
      },
    },
    "/vaults/{id}/proposals": {
      post: {
        summary: "Create a proposal (Transfer/TimeLock/Vesting/role/threshold). Vault fee charged on-chain.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProposal" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/submit": {
      post: {
        summary: "Submit a wallet-signed transaction XDR",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { signedXdr: { type: "string" } }, required: ["signedXdr"] } } } },
        responses: { 200: { description: "Submission result with tx hash and status" } },
      },
    },
  },
  components: {
    schemas: {
      CreateVault: {
        type: "object",
        required: ["creator", "name", "signers", "threshold"],
        properties: {
          creator: { type: "string", example: "GABC...", description: "Must be included in signers" },
          name: { type: "string", maxLength: 32, example: "treasury" },
          signers: { type: "array", items: { type: "string" }, example: ["GABC...", "GDEF..."] },
          threshold: { type: "integer", minimum: 1, example: 2 },
        },
      },
      CreateProposal: {
        type: "object",
        required: ["proposer", "proposalType", "token", "recipient", "amount"],
        properties: {
          proposer: { type: "string" },
          proposalType: { type: "integer", enum: [0,1,2,3,4,5,6], description: "0=Transfer 1=TimeLock 2=Vesting 3=AddSigner 4=RemoveSigner 5=SetRole 6=SetThreshold" },
          token: { type: "string" },
          recipient: { type: "string" },
          amount: { type: "string", description: "i128 as string" },
          startTime: { type: "integer" }, endTime: { type: "integer" },
          cliffTime: { type: "integer" }, releaseIntervals: { type: "integer" },
          revocable: { type: "boolean" }, description: { type: "string", maxLength: 32 },
        },
      },
      UnsignedTx: {
        type: "object",
        properties: { unsignedXdr: { type: "string" }, note: { type: "string" } },
      },
    },
  },
};
