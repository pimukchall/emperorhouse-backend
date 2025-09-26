import multer from "multer";

const ACCEPTED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (!ACCEPTED.has(file.mimetype)) {
    const err = new Error("ไฟล์ที่อัพโหลดต้องเป็น jpeg/png/webp/gif เท่านั้น");
    err.code = "FILE_TYPE_NOT_ALLOWED";
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}

export const uploadAvatarSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}).single("avatar");

export const uploadSignatureSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
}).single("signature");
