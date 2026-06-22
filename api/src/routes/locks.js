import { Router } from "express";
import { buildContractTx, simulateRead, sc } from "../stellar.js";

const router = Router();

// POST /vaults/:id/locks/:lockId/claim  -> beneficiary or admin claims released funds
router.post("/vaults/:id/locks/:lockId/claim", async (req, res) => {
  try {
    const { caller } = req.body;
    const xdr = await buildContractTx(caller, req.params.id, "claim_lock", [
      sc.address(caller),
      sc.u64(Number(req.params.lockId)),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /vaults/:id/locks/:lockId/cancel  -> admin cancels a revocable lock
router.post("/vaults/:id/locks/:lockId/cancel", async (req, res) => {
  try {
    const { caller } = req.body;
    const xdr = await buildContractTx(caller, req.params.id, "cancel_lock", [
      sc.address(caller),
      sc.u64(Number(req.params.lockId)),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /vaults/:id/locks/:lockId  -> read a lock's state
router.get("/vaults/:id/locks/:lockId", async (req, res) => {
  try {
    const lock = await simulateRead(req.params.id, "get_lock",
      [sc.u64(Number(req.params.lockId))], req.query.source);
    res.json(lock);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /vaults/:id/tokens/:token/locked  -> total locked for a token
router.get("/vaults/:id/tokens/:token/locked", async (req, res) => {
  try {
    const locked = await simulateRead(req.params.id, "get_token_locked",
      [sc.address(req.params.token)], req.query.source);
    res.json({ locked: locked.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /vaults/:id/tokens/:token/available  -> balance minus locked
router.get("/vaults/:id/tokens/:token/available", async (req, res) => {
  try {
    const avail = await simulateRead(req.params.id, "get_available_balance",
      [sc.address(req.params.token)], req.query.source);
    res.json({ available: avail.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
