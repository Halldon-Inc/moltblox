/**
 * File upload routes for Moltblox API
 * Handles avatar and game thumbnail uploads using multer with disk storage.
 * Files are stored on a Render persistent disk (/opt/render/uploads)
 * or ./uploads locally for development.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { randomUUID, createHash } from 'crypto';
import { existsSync, mkdirSync, statSync, openSync, readSync, closeSync, unlinkSync } from 'fs';
import { join, extname, resolve } from 'path';
import { requireAuth } from '../middleware/auth.js';

const router: Router = Router();

// ---------------------
// Upload directory
// ---------------------

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure the upload directory exists at startup
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[Uploads] Created upload directory: ${UPLOAD_DIR}`);
}

// ---------------------
// Allowed image types
// ---------------------

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Map file extensions to proper Content-Type values for serving. */
const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// ---------------------
// CORS allowed origins
// ---------------------

const ALLOWED_ORIGINS = [
  process.env.WEB_URL || 'http://localhost:3000',
  process.env.SERVER_URL || 'http://localhost:3001',
];

// ---------------------
// Magic bytes validation
// ---------------------

function validateMagicBytes(filePath: string): boolean {
  const buf = Buffer.alloc(12);
  let fd: number | undefined;
  try {
    fd = openSync(filePath, 'r');
    readSync(fd, buf, 0, 12, 0);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  // PNG: 89 50 4E 47
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  // JPEG: FF D8 FF
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  // WebP: 52 49 46 46 ... 57 45 42 50
  const webp =
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50;
  return png || jpeg || webp;
}

/**
 * File filter: only accept image files (jpg, png, webp).
 */
function imageFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .png, and .webp image files are allowed'));
  }
}

// ---------------------
// Multer storage config
// ---------------------

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const uniqueName = `${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

/** Avatar upload: max 2 MB, single file */
const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

/** Thumbnail upload: max 5 MB, single file */
const thumbnailUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// ---------------------
// Multer error handler
// ---------------------

function handleMulterError(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'PayloadTooLarge',
        message: 'File exceeds the maximum allowed size',
      });
      return;
    }
    res.status(400).json({
      error: 'BadRequest',
      message: err.message,
    });
    return;
  }

  if (err instanceof Error && err.message.includes('image files are allowed')) {
    res.status(400).json({
      error: 'BadRequest',
      message: err.message,
    });
    return;
  }

  next(err);
}

// ---------------------
// Routes
// ---------------------

/**
 * POST /uploads/avatar
 * Upload a user avatar image (max 2 MB, jpg/png/webp).
 * Requires authentication.
 */
router.post(
  '/avatar',
  requireAuth,
  avatarUpload.single('avatar'),
  handleMulterError,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'No file uploaded. Send a file in the "avatar" field.',
        });
        return;
      }

      // Validate magic bytes match claimed file type
      if (!validateMagicBytes(req.file.path)) {
        unlinkSync(req.file.path);
        res.status(400).json({
          error: 'BadRequest',
          message: 'File content does not match an allowed image type',
        });
        return;
      }

      res.status(201).json({
        filename: req.file.filename,
        url: `/api/v1/uploads/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /uploads/thumbnail
 * Upload a game thumbnail image (max 5 MB, jpg/png/webp).
 * Requires authentication.
 */
router.post(
  '/thumbnail',
  requireAuth,
  thumbnailUpload.single('thumbnail'),
  handleMulterError,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'No file uploaded. Send a file in the "thumbnail" field.',
        });
        return;
      }

      // Validate magic bytes match claimed file type
      if (!validateMagicBytes(req.file.path)) {
        unlinkSync(req.file.path);
        res.status(400).json({
          error: 'BadRequest',
          message: 'File content does not match an allowed image type',
        });
        return;
      }

      res.status(201).json({
        filename: req.file.filename,
        url: `/api/v1/uploads/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /uploads/:filename
 * Serve an uploaded file by filename. Public access (no auth required).
 *
 * Optimizations:
 *   - 1-year immutable cache (filenames are UUIDs, content never changes)
 *   - ETag based on file mtime + size for conditional request support
 *   - Explicit Content-Type from extension (avoids MIME sniffing)
 *   - CORS header so a CDN or external embed can fetch images directly
 */
router.get('/:filename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = req.params;

    // Sanitize: only allow alphanumeric, hyphens, dots, and underscores
    if (!/^[\w\-.]+$/.test(filename)) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid filename',
      });
      return;
    }

    const filePath = resolve(join(UPLOAD_DIR, filename));
    const resolvedUploadDir = resolve(UPLOAD_DIR);

    // H8: Prevent path traversal
    if (!filePath.startsWith(resolvedUploadDir)) {
      res.status(403).json({ error: 'Forbidden', message: 'Invalid file path' });
      return;
    }

    // Check file exists before sending (sendFile handles 404 but we want a JSON error)
    if (!existsSync(filePath)) {
      res.status(404).json({
        error: 'NotFound',
        message: 'File not found',
      });
      return;
    }

    // ── File stats (for ETag) ──────────────────────────────
    const stat = statSync(filePath);

    // ── ETag: hash of mtime + size (lightweight, no file read) ──
    const etagSource = `${stat.mtimeMs}:${stat.size}`;
    const etag = `"${createHash('md5').update(etagSource).digest('hex')}"`;

    // If the client already has a matching version, return 304
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    // ── Content-Type from extension ────────────────────────
    const ext = extname(filename).toLowerCase();
    const contentType = EXT_TO_CONTENT_TYPE[ext];
    if (contentType) {
      res.set('Content-Type', contentType);
    }

    // ── Cache headers ──────────────────────────────────────
    // UUID filenames are unique per upload, so content is immutable.
    // 1 year max-age + immutable tells browsers and CDNs to never revalidate.
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('ETag', etag);

    // ── CORS for CDN / external embeds ─────────────────────
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

export default router;
