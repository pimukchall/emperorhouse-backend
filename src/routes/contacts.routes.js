import { Router } from "express";
import {
  createContactController,
  listContactsController,
  getContactController,
  deleteContactController,
} from "../controllers/contacts.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { anyOf, allowAdmin } from "../middlewares/policy.js";

const r = Router();

// public form submit
r.post("/", ...createContactController);

// backoffice
r.use(requireAuth);
r.get("/", anyOf(allowAdmin), ...listContactsController);
r.get("/:id", anyOf(allowAdmin), ...getContactController);
r.delete("/:id", anyOf(allowAdmin), ...deleteContactController);

export default r;
