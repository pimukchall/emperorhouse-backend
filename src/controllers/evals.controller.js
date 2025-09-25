// src/controllers/evals.controller.js
import {
  createEvaluation,
  getEvaluation,
  updateEvaluation,
  submitEvaluation,
  approveByManager,
  approveByMD,
  rejectEvaluation,
  deleteEvaluation,
  listEvaluations,
  listEligibleEvaluatees,
} from "../services/eval.service.js";

// helper ส่ง error เป็น JSON (ไม่ต้อง import จาก errors.js)
function sendErr(res, e, def = 400) {
  const status = e?.status || def;
  const payload = {
    ok: false,
    error: e?.code || e?.message || "BAD_REQUEST",
    message: e?.message || undefined,
  };
  return res.status(status).json(payload);
}

function currentUserId(req) {
  return req?.me?.id;
}

// ============== LIST / GET ==============
export async function listEvalsController(req, res) {
  try {
    const where = {};
    if (req.query.cycleId) where.cycleId = Number(req.query.cycleId);
    if (req.query.owner === "me") where.ownerId = currentUserId(req);
    if (req.query.ownerId) where.ownerId = Number(req.query.ownerId);
    if (req.query.status) where.status = String(req.query.status).toUpperCase();

    const rows = await listEvaluations(where);
    res.json({ ok: true, data: rows });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function getEvalController(req, res) {
  try {
    const row = await getEvaluation(Number(req.params.id));
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e, 404);
  }
}

// ============== CREATE / UPDATE / DELETE ==============
export async function createEvalController(req, res) {
  try {
    const byUserId = currentUserId(req);
    const body = req.body || {};
    const cycleId = Number(body.cycleId);
    const ownerId = Number(body.ownerId || byUserId); // ไม่ระบุ = สร้างให้ตัวเอง
    const managerId = body.managerId ? Number(body.managerId) : null;
    const mdId = body.mdId ? Number(body.mdId) : null;
    const type = body.type || "OPERATIONAL";

    if (!cycleId) return res.status(400).json({ ok: false, error: "CYCLE_ID_REQUIRED" });

    const row = await createEvaluation({
      cycleId,
      ownerId,
      managerId,
      mdId,
      type,
      byUserId,
    });
    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function updateEvalController(req, res) {
  try {
    const id = Number(req.params.id);
    const data = req.body || {};
    const row = await updateEvaluation(id, data, currentUserId(req));
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function deleteEvalController(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await deleteEvaluation(id);
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

// ============== FLOW (submit/approve/reject) ==============
export async function submitEvalController(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await submitEvaluation(id, currentUserId(req), {
      signature: req.body?.submitterSignature,
      comment: req.body?.submitterComment,
    });
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function approveManagerController(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await approveByManager(id, currentUserId(req), {
      signature: req.body?.managerSignature,
      comment: req.body?.managerComment,
    });
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function approveMDController(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await approveByMD(id, currentUserId(req), {
      signature: req.body?.mdSignature,
      comment: req.body?.mdComment,
    });
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function rejectEvalController(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await rejectEvaluation(id, currentUserId(req), req.body?.comment || "");
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

// ============== ELIGIBLE (เลือกผู้ถูกประเมินตามเงื่อนไข) ==============
export async function listEligibleController(req, res) {
  try {
    const cycleId = Number(req.params.cycleId || req.query.cycleId);
    if (!cycleId) return res.status(400).json({ ok: false, error: "CYCLE_ID_REQUIRED" });

    // ✅ กันเคสยังไม่ล็อกอิน/ไม่มี me.id
    if (!req?.me?.id) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const includeSelf  = String(req.query.includeSelf || "").toLowerCase() === "1" || String(req.query.includeSelf || "").toLowerCase() === "true";
    const includeTaken = String(req.query.includeTaken || "").toLowerCase() === "1" || String(req.query.includeTaken || "").toLowerCase() === "true";

    const arr = await listEligibleEvaluatees(cycleId, req.me.id, { includeSelf, includeTaken });

    // ถ้ากลับมาว่าง และอนุญาต includeSelf → ใส่ self เป็น fallback
    if ((!arr || arr.length === 0) && includeSelf) {
      const me = req.me;
      return res.json({
        ok: true,
        data: [{ id: me.id, firstNameTh: me.firstNameTh || "ฉัน", lastNameTh: me.lastNameTh || "" }],
        note: "FALLBACK_SELF",
      });
    }

    return res.json({ ok: true, data: arr });
  } catch (e) {
    const wantSelf = String(req.query.includeSelf || "").toLowerCase() === "1" || String(req.query.includeSelf || "").toLowerCase() === "true";
    if ((e?.code || e?.message) === "PROFILE_INCOMPLETE" && wantSelf && req?.me?.id) {
      const me = req.me;
      return res.json({
        ok: true,
        data: [{ id: me.id, firstNameTh: me.firstNameTh || "ฉัน", lastNameTh: me.lastNameTh || "" }],
        warning: "PROFILE_INCOMPLETE",
      });
    }
    return res.status(e?.status || 400).json({ ok: false, error: e?.code || e?.message || "BAD_REQUEST" });
  }
}

