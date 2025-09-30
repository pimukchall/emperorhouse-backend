import { Router } from "express";
import { requireAuth } from "#mw/auth.js";
import { anyOf, allowAdmin } from "#mw/policy.js";
import { validate } from "#mw/validate.js";
import * as C from "./controller.js";
import * as S from "./schema.js";

const r = Router();
r.use(requireAuth);

r.get("/", validate(S.OrgListQuery, "query"), ...C.listOrganizationsController);
r.get("/:id", validate(S.OrgParams, "params"), ...C.getOrganizationController);

r.post("/", anyOf(allowAdmin), validate(S.OrgCreate), ...C.createOrganizationController);
r.patch("/:id",
  anyOf(allowAdmin),
  validate(S.OrgParams, "params"),
  validate(S.OrgUpdate),
  ...C.updateOrganizationController
);

r.delete("/:id",
  anyOf(allowAdmin),
  validate(S.OrgParams, "params"),
  validate(S.OrgDeleteQuery, "query"),
  ...C.deleteOrganizationController
);

r.post("/:id/restore",
  anyOf(allowAdmin),
  validate(S.OrgParams, "params"),
  ...C.restoreOrganizationController
);

export default r;
