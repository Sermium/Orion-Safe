import express from "express";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./openapi.js";
import { submitSignedXdr } from "./stellar.js";
import vaults from "./routes/vaults.js";
import proposals from "./routes/proposals.js";
import locks from "./routes/locks.js";
import signers from "./routes/signers.js";

const app = express();
app.use(express.json());

// Swagger UI at /api-docs  + raw spec at /api-docs.json
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/api-docs.json", (_req, res) => res.json(openapiSpec));

const v1 = express.Router();
v1.use(vaults);
v1.use(proposals);
v1.use(locks);
v1.use(signers);
v1.post("/submit", async (req, res) => {
  try { res.json(await submitSignedXdr(req.body.signedXdr)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/v1", v1);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API + Swagger on http://localhost:${port}/api-docs`));
