import { Router } from "express";
import { buildContractTx, simulateRead, sc, config } from "../stellar.js";

const router = Router();

// POST /vaults  -> returns unsigned XDR for VaultFactory.create_vault
router.post("/vaults", async (req, res) => {
  try {
    const { creator, name, signers, threshold } = req.body;
    if (!creator || !name || !Array.isArray(signers) || !threshold) {
      return res.status(400).json({ error: "creator, name, signers[], threshold required" });
    }
    const xdr = await buildContractTx(creator, config.factoryId, "create_vault", [
      sc.address(creator),
      sc.sym(name),
      sc.addressVec(signers),
      sc.u32(threshold),
    ]);
    // The fee is collected on-chain by the factory from `creator`.
    res.json({ unsignedXdr: xdr, note: "Sign in wallet, then POST /submit" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /factory/fee  -> current creation fee
router.get("/factory/fee", async (req, res) => {
  try {
    const fee = await simulateRead(config.factoryId, "get_fee", [], req.query.source);
    res.json({ feeAmount: fee.toString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /vaults/:id/config
router.get("/vaults/:id/config", async (req, res) => {
  try {
    const cfg = await simulateRead(req.params.id, "get_config", [], req.query.source);
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
