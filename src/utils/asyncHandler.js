export const asyncHandler = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.then === "function") return out.catch(next);
    return out;
  } catch (err) {
    return next(err);
  }
};