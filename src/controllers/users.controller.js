import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  listUsersService,
  getUserService,
  createUserService,
  updateUserService,
  softDeleteUserService,
  restoreUserService,
  setPrimaryDepartmentService,
} from "../services/users.service.js";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  name: z.string().trim().optional(),
  roleId: z.number().int().positive().optional(),
  orgId: z.number().int().positive().nullable().optional(),
  firstNameTh: z.string().trim().optional(),
  lastNameTh: z.string().trim().optional(),
  firstNameEn: z.string().trim().optional(),
  lastNameEn: z.string().trim().optional(),
  birthDate: z.string().datetime().nullable().optional(),
  gender: z
    .enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"])
    .nullable()
    .optional(),
});
const updateSchema = createSchema.partial();
const setPrimarySchema = z.object({
  departmentId: z.number().int().positive(),
});

export const listUsersController = [
  asyncHandler(async (req, res) => {
    const {
      page,
      limit,
      q,
      includeDeleted,
      roleId,
      departmentId,
      sortBy,
      sort,
    } = req.query;
    const result = await listUsersService({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      q: q ?? "",
      includeDeleted: ["1", "true", "yes"].includes(
        String(includeDeleted || "").toLowerCase()
      ),
      roleId: roleId ?? "",
      departmentId: departmentId ?? "",
      sortBy: sortBy ?? "id",
      sort: sort ?? "asc",
    });
    res.json({ ok: true, data: result.data, meta: result.meta });
  }),
];

export const getUserController = [
  asyncHandler(async (req, res) => {
    const data = await getUserService({ id: req.params.id });
    res.json({ ok: true, data });
  }),
];

export const createUserController = [
  asyncHandler(async (req, res) => {
    const data = await createUserService({
      data: createSchema.parse(req.body ?? {}),
    });
    res.status(201).json({ ok: true, data });
  }),
];

export const updateUserController = [
  asyncHandler(async (req, res) => {
    const data = await updateUserService({
      id: req.params.id,
      data: updateSchema.parse(req.body ?? {}),
    });
    res.json({ ok: true, data });
  }),
];

export const softDeleteUserController = [
  asyncHandler(async (req, res) => {
    const hard = ["1", "true"].includes(
      String(req.query?.hard || "").toLowerCase()
    );
    const data = await softDeleteUserService({ id: req.params.id, hard });
    res.json({ ok: true, data });
  }),
];

export const restoreUserController = [
  asyncHandler(async (req, res) => {
    const data = await restoreUserService({ id: req.params.id });
    res.json({ ok: true, data });
  }),
];

export const setPrimaryDepartmentController = [
  asyncHandler(async (req, res) => {
    const { departmentId } = setPrimarySchema.parse(req.body ?? {});
    const data = await setPrimaryDepartmentService({
      userId: Number(req.params.id),
      departmentId: Number(departmentId),
    });
    res.json({ ok: true, data });
  }),
];
