export const asyncHandler = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    // ถ้าเป็น Promise ให้ catch แล้วส่งเข้า next
    if (out && typeof out.then === "function") out.catch(next);
  } catch (err) {
    next(err);
  }
};