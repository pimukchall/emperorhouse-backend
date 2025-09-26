import { Router } from "express";
import {
  listAssignmentsController,
  listByUserController,
  addOrUpdateAssignmentController,
  changeLevelController,
  endOrRenameAssignmentController,
  setPrimaryController,
} from "../controllers/user-departments.controller.js";
import { requireAuth, requireMe } from "../middlewares/auth.js";
import { canWriteUserDepartment } from "../middlewares/policy.js";

const r = Router();
r.use(requireAuth, requireMe);

// read (login users)
r.get("/:id", ...listAssignmentsController);
r.get("/users/:userId", ...listByUserController);

// write: admin | manager(target dept) ; MD(MGT) ห้าม write
r.post("/",                             canWriteUserDepartment(), ...addOrUpdateAssignmentController);
r.patch("/:udId",                       canWriteUserDepartment(), ...endOrRenameAssignmentController);
r.post("/change-level",                 canWriteUserDepartment(), ...changeLevelController);
r.post("/users/:userId/primary/:udId",  canWriteUserDepartment(), ...setPrimaryController);

export default r;
