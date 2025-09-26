import multer from "multer";

const ACCEPTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
]);

function fileFilter(_req, file, cb) {
  if (ACCEPTED_MIME.has(file.mimetype)) return cb(null, true);
  return cb(new Error(`Unsupported mime type: ${file.mimetype}`));
}

// ----- Generic memory upload (ขยายง่าย ใช้ได้กับหลายฟิลด์) -----
const memoryStorage = multer.memoryStorage();

export const memoryUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB (ปรับได้)
    files: 10,                  // สูงสุด 10 ไฟล์ต่อคำขอ (ปรับได้)
  },
});

export const uploadAvatarSingle = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB เฉพาะ avatar
}).single("avatar");

export const uploadSignatureSingle = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB เฉพาะ signature
}).single("signature");
