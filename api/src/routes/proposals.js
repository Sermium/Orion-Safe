import { Router } from "express";
import { buildContractTx, sc } from "../stellar.js";

const router = Router();

// POST /vaults/:id/proposals
router.post("/vaults/:id/proposals", async (req, res) => {
  try {
    const {
      proposer, proposalType, token, recipient, amount,
      startTime = 0, endTime = 0, cliffTime = 0,
      releaseIntervals = 0, revocable = false, description = "tx",
    } = req.body;

    const xdr = await buildContractTx(proposer, req.params.id, "propose", [
      sc.address(proposer),
      sc.u32(proposalType),       // 0=Transfer,1=TimeLock,2=Vesting,3=Add,4=Remove,5=SetRole,6=SetThreshold
      sc.address(token),
      sc.address(recipient),
      sc.i128(amount),
      sc.u64(startTime), sc.u64(endTime), sc.u64(cliffTime),
      sc.u64(releaseIntervals), sc.bool(revocable), sc.sym(description),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/vaults/:id/proposals/:pid/approve", async (req, res) => {
  try {
    const xdr = await buildContractTx(req.body.signer, req.params.id, "approve", [
      sc.address(req.body.signer), sc.u64(Number(req.params.pid)),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/vaults/:id/proposals/:pid/execute", async (req, res) => {
  try {
    const b = req.body;
    const xdr = await buildContractTx(b.executor, req.params.id, "execute", [
      sc.address(b.executor), sc.u64(Number(req.params.pid)), sc.u32(b.proposalType),
      sc.address(b.token), sc.address(b.recipient), sc.i128(b.amount),
      sc.u64(b.startTime || 0), sc.u64(b.endTime || 0), sc.u64(b.cliffTime || 0),
      sc.u64(b.releaseIntervals || 0), sc.bool(b.revocable || false),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /vaults/:id/proposals/:pid/reject
router.post("/vaults/:id/proposals/:pid/reject", async (req, res) => {
  try {
    const { signer } = req.body;
    const xdr = await buildContractTx(signer, req.params.id, "reject", [
      sc.address(signer),
      sc.u64(Number(req.params.pid)),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /vaults/:id/proposals/:pid  -> read proposal state (counts, executed, rejected)
router.get("/vaults/:id/proposals/:pid", async (req, res) => {
  try {
    const p = await simulateRead(req.params.id, "get_proposal",
      [sc.u64(Number(req.params.pid))], req.query.source);
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /vaults/:id/proposals/:pid/approved?signer=G...&source=G...
router.get("/vaults/:id/proposals/:pid/approved", async (req, res) => {
  try {
    const approved = await simulateRead(req.params.id, "has_approved",
      [sc.u64(Number(req.params.pid)), sc.address(req.query.signer)], req.query.source);
    res.json({ approved });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
