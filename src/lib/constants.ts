export const APP_NAME = "SecureQuest";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const ALLOWED_FILE_TYPES = ["xlsx", "docx", "pdf"] as const;
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];
