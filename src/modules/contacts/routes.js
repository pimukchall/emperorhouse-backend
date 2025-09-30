import { Router } from "express";
import {
  createContactController,
  listContactsController,
  getContactController,
  deleteContactController,
} from "./controller.js";
import { requireAuth } from "#mw/auth.js";
import { anyOf, allowAdmin } from "#mw/policy.js";
import { validate } from "#mw/validate.js";
import * as S from "./schema.js";

const r = Router();

// public form submit
r.post("/", validate(S.ContactCreate), ...createContactController);

// backoffice
r.use(requireAuth);
r.get("/", anyOf(allowAdmin), validate(S.ContactListQuery, "query"), ...listContactsController);
r.get("/:id", anyOf(allowAdmin), validate(S.ContactParams, "params"), ...getContactController);
r.delete("/:id", anyOf(allowAdmin), validate(S.ContactParams, "params"), ...deleteContactController);

export default r;
