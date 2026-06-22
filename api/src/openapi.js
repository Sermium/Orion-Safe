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
  tags: [
    { name: "Vaults", description: "Create and read vaults" },
    { name: "Proposals", description: "Propose, approve, reject, execute" },
    { name: "Locks", description: "Time-lock / vesting claim & cancel" },
    { name: "Signers", description: "Admin signer & threshold management" },
    { name: "Tx", description: "Submit signed transactions" },
  ],
  paths: {
    // ---------- VAULTS ----------
    "/vaults": {
      post: {
        tags: ["Vaults"],
        summary: "Create a new vault (factory). Fee charged on-chain to creator.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateVault" } } } },
        responses: { 200: { description: "Unsigned XDR", content: { "application/json": { schema: { $ref: "#/components/schemas/UnsignedTx" } } } }, 400: { description: "Bad request" } },
      },
    },
    "/factory/fee": {
      get: {
        tags: ["Vaults"],
        summary: "Get current vault-creation fee",
        parameters: [{ name: "source", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Fee amount" } },
      },
    },
    "/vaults/{id}/config": {
      get: {
        tags: ["Vaults"],
        summary: "Read vault configuration",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "VaultConfig" } },
      },
    },

    // ---------- PROPOSALS ----------
    "/vaults/{id}/proposals": {
      post: {
        tags: ["Proposals"],
        summary: "Create a proposal (Transfer/TimeLock/Vesting/role/threshold). Vault fee charged on-chain.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProposal" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/proposals/{pid}": {
      get: {
        tags: ["Proposals"],
        summary: "Read a proposal's state (counts, executed, rejected)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "pid", in: "path", required: true, schema: { type: "integer" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "ProposalCore" } },
      },
    },
    "/vaults/{id}/proposals/{pid}/approve": {
      post: {
        tags: ["Proposals"],
        summary: "Approve a proposal. Vault fee charged on-chain.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "pid", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SignerBody" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/proposals/{pid}/reject": {
      post: {
        tags: ["Proposals"],
        summary: "Reject a proposal. Vault fee charged on-chain.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "pid", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SignerBody" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/proposals/{pid}/execute": {
      post: {
        tags: ["Proposals"],
        summary: "Execute an approved proposal (runs transfer / creates lock / etc.).",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "pid", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ExecuteProposal" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/proposals/{pid}/approved": {
      get: {
        tags: ["Proposals"],
        summary: "Check whether a signer has approved a proposal",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "pid", in: "path", required: true, schema: { type: "integer" } },
          { name: "signer", in: "query", required: true, schema: { type: "string" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "{ approved: boolean }" } },
      },
    },

    // ---------- LOCKS ----------
    "/vaults/{id}/locks/{lockId}": {
      get: {
        tags: ["Locks"],
        summary: "Read a lock's state",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "lockId", in: "path", required: true, schema: { type: "integer" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "LockCore" } },
      },
    },
    "/vaults/{id}/locks/{lockId}/claim": {
      post: {
        tags: ["Locks"],
        summary: "Claim released funds from a lock (beneficiary or admin).",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "lockId", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CallerBody" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/locks/{lockId}/cancel": {
      post: {
        tags: ["Locks"],
        summary: "Cancel a revocable lock (admin only).",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "lockId", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CallerBody" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/tokens/{token}/locked": {
      get: {
        tags: ["Locks"],
        summary: "Total locked amount for a token",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "token", in: "path", required: true, schema: { type: "string" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "{ locked: string }" } },
      },
    },
    "/vaults/{id}/tokens/{token}/available": {
      get: {
        tags: ["Locks"],
        summary: "Available balance (balance minus locked) for a token",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "token", in: "path", required: true, schema: { type: "string" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "{ available: string }" } },
      },
    },

    // ---------- SIGNERS ----------
    "/vaults/{id}/signers": {
      get: {
        tags: ["Signers"],
        summary: "List vault signers",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "{ signers: string[] }" } },
      },
      post: {
        tags: ["Signers"],
        summary: "Add a signer (SuperAdmin only). Vault fee charged on-chain.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AddSigner" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/signers/remove": {
      post: {
        tags: ["Signers"],
        summary: "Remove a signer (SuperAdmin only).",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RemoveSigner" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/signers/role": {
      post: {
        tags: ["Signers"],
        summary: "Set a signer's role (SuperAdmin only).",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SetRole" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/signers/{signer}/role": {
      get: {
        tags: ["Signers"],
        summary: "Read a signer's role",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "signer", in: "path", required: true, schema: { type: "string" } },
          { name: "source", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "{ role: number }" } },
      },
    },
    "/vaults/{id}/threshold": {
      post: {
        tags: ["Signers"],
        summary: "Set the approval threshold (SuperAdmin only).",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SetThreshold" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },
    "/vaults/{id}/leave": {
      post: {
        tags: ["Signers"],
        summary: "Leave the vault (signer removes themselves).",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SignerBody" } } } },
        responses: { 200: { description: "Unsigned XDR" } },
      },
    },

    // ---------- SUBMIT ----------
    "/submit": {
      post: {
        tags: ["Tx"],
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
      ExecuteProposal: {
        type: "object",
        required: ["executor", "proposalType", "token", "recipient", "amount"],
        description: "Must replay the SAME parameters used at propose time (contract only re-checks the type).",
        properties: {
          executor: { type: "string" },
          proposalType: { type: "integer", enum: [0,1,2,3,4,5,6] },
          token: { type: "string" },
          recipient: { type: "string" },
          amount: { type: "string" },
          startTime: { type: "integer" }, endTime: { type: "integer" },
          cliffTime: { type: "integer" }, releaseIntervals: { type: "integer" },
          revocable: { type: "boolean" },
        },
      },
      AddSigner: {
        type: "object",
        required: ["caller", "newSigner", "role"],
        properties: {
          caller: { type: "string" },
          newSigner: { type: "string" },
          role: { type: "integer", enum: [0, 1, 2], description: "0=SuperAdmin 1=Admin 2=Executor" },
        },
      },
      RemoveSigner: {
        type: "object",
        required: ["caller", "signer"],
        properties: { caller: { type: "string" }, signer: { type: "string" } },
      },
      SetRole: {
        type: "object",
        required: ["caller", "signer", "newRole"],
        properties: {
          caller: { type: "string" }, signer: { type: "string" },
          newRole: { type: "integer", enum: [0, 1, 2], description: "0=SuperAdmin 1=Admin 2=Executor" },
        },
      },
      SetThreshold: {
        type: "object",
        required: ["caller", "newThreshold"],
        properties: { caller: { type: "string" }, newThreshold: { type: "integer", minimum: 1 } },
      },
      SignerBody: {
        type: "object",
        required: ["signer"],
        properties: { signer: { type: "string" } },
      },
      CallerBody: {
        type: "object",
        required: ["caller"],
        properties: { caller: { type: "string" } },
      },
      UnsignedTx: {
        type: "object",
        properties: { unsignedXdr: { type: "string" }, note: { type: "string" } },
      },
    },
  },
};
