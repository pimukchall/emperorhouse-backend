import { Router } from "express";
import {
  listOrganizationsController,
  getOrganizationController,
  createOrganizationController,
  updateOrganizationController,
  deleteOrganizationController,
  restoreOrganizationController,
} from "../controllers/organizations.controller.js";

const router = Router();

router.get("/", listOrganizationsController);
router.get("/:id", getOrganizationController);
router.post("/", createOrganizationController);
router.put("/:id", updateOrganizationController);
router.delete("/:id", deleteOrganizationController);
router.post("/:id/restore", restoreOrganizationController);

export default router;
