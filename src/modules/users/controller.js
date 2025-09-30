import { asyncHandler } from "#utils/asyncHandler.js";
import { buildListResponse } from "#utils/pagination.js";
import * as S from "./schema.js";
import {
  listUsersService,
  getUserService,
  createUserService,
  updateUserService,
  softDeleteUserService,
  restoreUserService,
  setPrimaryDepartmentService,
  selfUpdateProfileService,
} from "./service.js";

export const listUsersController = [
  asyncHandler(async (req, res) => {
    const q = S.UserListQuery.parse(req.query);
    const out = await listUsersService(q);
    res.json({
      ok: true,
      ...buildListResponse({
        rows: out.rows,
        total: out.total,
        page: out.page,
        limit: out.limit,
        sortBy: out.sortBy,
        sort: out.sort,
      }),
    });
  }),
];

export const getUserController = [
  asyncHandler(async (req, res) => {
    const { id } = S.UserParams.parse(req.params);
    const data = await getUserService({ id });
    res.json({ ok: true, data });
  }),
];

export const createUserController = [
  asyncHandler(async (req, res) => {
    const body = S.UserCreate.parse(req.body ?? {});
    const data = await createUserService({ data: body });
    res.status(201).json({ ok: true, data });
  }),
];

export const updateUserController = [
  asyncHandler(async (req, res) => {
    const { id } = S.UserParams.parse(req.params);
    const body = S.UserUpdate.parse(req.body ?? {});
    const data = await updateUserService({ id, data: body });
    res.json({ ok: true, data });
  }),
];

export const softDeleteUserController = [
  asyncHandler(async (req, res) => {
    const { id } = S.UserParams.parse(req.params);
    const { hard } = S.DeleteQuery.parse(req.query);
    const data = await softDeleteUserService({ id, hard });
    res.json({ ok: true, data });
  }),
];

export const restoreUserController = [
  asyncHandler(async (req, res) => {
    const { id } = S.UserParams.parse(req.params);
    const data = await restoreUserService({ id });
    res.json({ ok: true, data });
  }),
];

export const setPrimaryDepartmentController = [
  asyncHandler(async (req, res) => {
    const { id } = S.UserParams.parse(req.params);
    const { departmentId } = S.SetPrimaryDept.parse(req.body ?? {});
    const data = await setPrimaryDepartmentService({ userId: id, departmentId });
    res.json({ ok: true, data });
  }),
];

export const selfUpdateProfileController = [
  asyncHandler(async (req, res) => {
    // requireAuth + requireMe ถูกครอบที่ routes แล้ว ⇒ มี uid แน่นอน
    const uid = Number(req.me?.id || req.user?.id || req.auth?.sub);
    const body = S.SelfUpdate.parse(req.body ?? {});
    const updated = await selfUpdateProfileService({ userId: uid, data: body });
    res.json({ ok: true, data: updated });
  }),
];
