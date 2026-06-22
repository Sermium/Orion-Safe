import { Router } from "express";
import { buildContractTx, simulateRead, sc } from "../stellar.js";

const router = Router();

// POST /vaults/:id/signers  -> add_signer(caller, new_signer, role)
router.post("/vaults/:id/signers", async (req, res) => {
  try {
    const { caller, newSigner, role } = req.body;  // role: 0|1|2
    const xdr = await buildContractTx(caller, req.params.id, "add_signer", [
      sc.address(caller), sc.address(newSigner), sc.u32(role),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE-style: POST /vaults/:id/signers/remove
router.post("/vaults/:id/signers/remove", async (req, res) => {
  try {
    const { caller, signer } = req.body;
    const xdr = await buildContractTx(caller, req.params.id, "remove_signer", [
      sc.address(caller), sc.address(signer),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /vaults/:id/signers/role  -> set_role(caller, signer, new_role)
router.post("/vaults/:id/signers/role", async (req, res) => {
  try {
    const { caller, signer, newRole } = req.body;
    const xdr = await buildContractTx(caller, req.params.id, "set_role", [
      sc.address(caller), sc.address(signer), sc.u32(newRole),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /vaults/:id/threshold  -> set_threshold(caller, new_threshold)
router.post("/vaults/:id/threshold", async (req, res) => {
  try {
    const { caller, newThreshold } = req.body;
    const xdr = await buildContractTx(caller, req.params.id, "set_threshold", [
      sc.address(caller), sc.u32(newThreshold),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /vaults/:id/leave  -> leave_vault(signer)
router.post("/vaults/:id/leave", async (req, res) => {
  try {
    const { signer } = req.body;
    const xdr = await buildContractTx(signer, req.params.id, "leave_vault", [
      sc.address(signer),
    ]);
    res.json({ unsignedXdr: xdr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /vaults/:id/signers  -> list signers
router.get("/vaults/:id/signers", async (req, res) => {
  try {
    const signers = await simulateRead(req.params.id, "get_signers", [], req.query.source);
    res.json({ signers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /vaults/:id/signers/:signer/role
router.get("/vaults/:id/signers/:signer/role", async (req, res) => {
  try {
    const role = await simulateRead(req.params.id, "get_role",
      [sc.address(req.params.signer)], req.query.source);
    res.json({ role });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
