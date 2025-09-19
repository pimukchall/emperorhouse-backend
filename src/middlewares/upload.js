import multer from "multer";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// ใช้ memory storage เพื่อให้ controller จัดการเส้นทางปลายทาง (ต่อ user) เอง
const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (!ACCEPTED.has(file.mimetype)) {
    return cb(new Error("Only jpeg/png/webp/gif allowed"));
  }
  cb(null, true);
}

// upload สำหรับ avatar (จำกัด 2MB)
export const uploadAvatarSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single("avatar");

// upload สำหรับ signature (จำกัด 1MB)
export const uploadSignatureSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1 * 1024 * 1024 },
}).single("signature");
