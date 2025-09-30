import { asyncHandler } from "#utils/asyncHandler.js";
import { AppError } from "#utils/appError.js";
import { buildListResponse } from "#utils/pagination.js";
import * as S from "./schema.js";
import {
  submitContactService,
  listContactsService,
  getContactService,
  deleteContactService,
} from "./service.js";

// POST /contacts  (public)
export const createContactController = [
  asyncHandler(async (req, res) => {
    const body = S.ContactCreate.parse(req.body ?? {});
    const result = await submitContactService({ body });
    res.status(201).json({ ok: true, ...result });
  }),
];

// GET /contacts  (admin)
export const listContactsController = [
  asyncHandler(async (req, res) => {
    const q = S.ContactListQuery.parse(req.query);
    const out = await listContactsService(q);
    res.json({ ok: true, ...buildListResponse(out) });
  }),
];

// GET /contacts/:id  (admin)
export const getContactController = [
  asyncHandler(async (req, res) => {
    const { id } = S.ContactParams.parse(req.params);
    const data = await getContactService({ id });
    if (!data) throw AppError.notFound("CONTACT_NOT_FOUND");
    res.json({ ok: true, data });
  }),
];

// DELETE /contacts/:id  (admin)
export const deleteContactController = [
  asyncHandler(async (req, res) => {
    const { id } = S.ContactParams.parse(req.params);
    const data = await deleteContactService({ id });
    res.json({ ok: true, data });
  }),
];
