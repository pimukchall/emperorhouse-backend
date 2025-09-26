import { Router } from "express";
import {
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  softDeleteUserController,
  restoreUserController,
  setPrimaryDepartmentController,
} from "../controllers/users.controller.js";
import { requireAuth, requireMe } from "../middlewares/auth.js";
import { canWriteUser } from "../middlewares/policy.js";

const r = Router();
r.use(requireAuth, requireMe);

// read
r.get("/", ...listUsersController);
r.get("/:id", ...getUserController);

// write: admin | owner | manager(same dept) ; MD(MGT) ห้าม write
r.post("/",                    canWriteUser(), ...createUserController);
r.patch("/:id",                canWriteUser(), ...updateUserController);
r.delete("/:id",               canWriteUser(), ...softDeleteUserController);
r.post("/:id/restore",         canWriteUser(), ...restoreUserController);
r.post("/:id/primary-department", canWriteUser(), ...setPrimaryDepartmentController);

export default r;
