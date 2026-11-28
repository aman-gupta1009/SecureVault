
import { PPTXViewer } from "pptxviewjs";
import { parseMsDoc, renderMsDoc } from "@file-viewer/doc";
import DOMPurify from "dompurify";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api"
).replace(/\/$/, "");

const styles = `
.sv-page{color:var(--sv-text);width:100%;min-width:0;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.sv-page *{box-sizing:border-box}
.sv-page .sv-eyebrow{color:var(--sv-accent);font-size:11px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase}
.sv-page .sv-heading{margin:8px 0;font-size:clamp(25px,3vw,32px);font-weight:750;letter-spacing:-1px}
.sv-page .sv-muted{color:var(--sv-text-muted);font-size:13px;line-height:1.7}
.sv-page .sv-card{min-width:0;border:1px solid var(--sv-border);border-radius:17px;background:var(--sv-surface);box-shadow:var(--sv-shadow)}
.sv-page .sv-button{min-height:41px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 15px;border:1px solid var(--sv-border);border-radius:10px;background:var(--sv-surface-raised);color:var(--sv-text);font-size:12px;font-weight:700;cursor:pointer;transition:160ms ease}
.sv-page .sv-button:hover{border-color:var(--sv-accent)}
.sv-page .sv-button-primary{background:var(--sv-accent);border-color:var(--sv-accent);color:var(--sv-accent-text)}
.sv-page .sv-button-danger{color:var(--sv-danger)}
.sv-page .sv-button:disabled{opacity:.5;cursor:not-allowed}
.sv-page .sv-input,.sv-page .sv-select{width:100%;min-height:43px;padding:0 13px;color:var(--sv-text);background:var(--sv-input-bg);border:1px solid var(--sv-border);border-radius:10px;outline:none;font-size:12px}
.sv-page .sv-input:focus,.sv-page .sv-select:focus{border-color:var(--sv-accent)}
.sv-page .sv-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:23px 0}
.sv-page .sv-stat{padding:18px}
.sv-page .sv-stat-label{color:var(--sv-text-muted);font-size:12px}
.sv-page .sv-stat-value{margin-top:12px;font-size:26px;font-weight:750;letter-spacing:-.7px;overflow-wrap:anywhere}
.sv-page .sv-stat-foot{margin-top:8px;color:var(--sv-text-muted);font-size:11px}
.sv-page .sv-dropzone{padding:27px 18px;border:1px dashed var(--sv-border);border-radius:15px;background:var(--sv-surface-raised);text-align:center;transition:160ms ease}
.sv-page .sv-file-icon{width:39px;height:39px;flex-shrink:0;display:grid;place-items:center;border:1px solid var(--sv-border);border-radius:11px;background:var(--sv-surface-raised);color:var(--sv-accent);font-size:10px;font-weight:800}
.sv-page .sv-table-wrap{overflow-x:auto}
.sv-page .sv-table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}
.sv-page .sv-table th{padding:13px 17px;color:var(--sv-text-muted);background:var(--sv-surface-raised);font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}
.sv-page .sv-table td{padding:13px 17px;border-top:1px solid var(--sv-border);font-size:12px}
.sv-page .sv-status{display:inline-flex;padding:5px 9px;border-radius:99px;background:var(--sv-success-bg);color:var(--sv-success-text);font-size:10px;font-weight:800}
.sv-page .sv-empty{padding:30px 16px;color:var(--sv-text-muted);text-align:center;font-size:12px}
.sv-page .sv-notice{padding:13px 15px;margin-top:14px;border:1px solid var(--sv-border);border-radius:12px;background:var(--sv-surface);font-size:12px;line-height:1.7;overflow-wrap:anywhere}
.sv-page .sv-notice-error{border-color:var(--sv-danger);color:var(--sv-danger)}
.sv-page .sv-notice-success{color:var(--sv-success-text)}
.sv-page .sv-actions{display:flex;gap:7px;align-items:center}
.sv-page .sv-pagination{padding:13px 17px;border-top:1px solid var(--sv-border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.sv-page .sv-local-file{display:flex;align-items:center;gap:10px;padding:11px 13px;border:1px solid var(--sv-border);border-radius:10px;text-align:left;min-width:0}
.sv-page .sv-local-file:hover{border-color:var(--sv-accent)}

.sv-page .sv-toast{position:fixed;z-index:1200;right:26px;top:24px;width:min(430px,calc(100vw - 32px));display:flex;align-items:flex-start;gap:13px;padding:16px 17px;border:1px solid var(--sv-border);border-radius:16px;background:var(--sv-surface);color:var(--sv-text);box-shadow:0 22px 70px rgba(0,0,0,.28);animation:sv-toast-in .22s ease-out}
.sv-page .sv-toast-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:11px;background:var(--sv-success-bg);color:var(--sv-success-text);font-size:17px;font-weight:900}
.sv-page .sv-toast-error .sv-toast-icon{background:color-mix(in srgb,var(--sv-danger) 13%,transparent);color:var(--sv-danger)}
.sv-page .sv-toast-info .sv-toast-icon{background:color-mix(in srgb,var(--sv-accent) 14%,transparent);color:var(--sv-accent)}
.sv-page .sv-toast-message{min-width:0;flex:1;font-size:12px;line-height:1.65;overflow-wrap:anywhere}
.sv-page .sv-toast-title{display:block;margin:0 0 3px;font-size:12px;font-weight:800}
.sv-page .sv-toast-close{width:27px;height:27px;flex:0 0 27px;border:0;border-radius:8px;background:transparent;color:var(--sv-text-muted);font-size:18px;cursor:pointer}
.sv-page .sv-toast-close:hover{background:var(--sv-surface-raised);color:var(--sv-text)}
.sv-page .sv-dialog-backdrop{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;padding:20px;background:rgba(3,8,6,.68);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);animation:sv-fade-in .16s ease-out}
.sv-page .sv-dialog{width:min(460px,100%);overflow:hidden;border:1px solid var(--sv-border);border-radius:22px;background:var(--sv-surface);color:var(--sv-text);box-shadow:0 30px 100px rgba(0,0,0,.42);animation:sv-dialog-in .2s ease-out}
.sv-page .sv-dialog-top{padding:25px 25px 18px;display:flex;gap:15px;align-items:flex-start}
.sv-page .sv-dialog-icon{width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--sv-danger) 28%,var(--sv-border));border-radius:15px;background:color-mix(in srgb,var(--sv-danger) 12%,var(--sv-surface-raised));color:var(--sv-danger)}
.sv-page .sv-dialog-title{margin:1px 0 7px;font-size:17px;font-weight:800;letter-spacing:-.35px}
.sv-page .sv-dialog-copy{margin:0;color:var(--sv-text-muted);font-size:12px;line-height:1.7;overflow-wrap:anywhere}
.sv-page .sv-dialog-filename{display:block;margin-top:13px;padding:11px 12px;border:1px solid var(--sv-border);border-radius:10px;background:var(--sv-surface-raised);font-size:12px;font-weight:700;overflow-wrap:anywhere}
.sv-page .sv-dialog-warning{margin:0 25px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--sv-danger) 22%,var(--sv-border));border-radius:10px;background:color-mix(in srgb,var(--sv-danger) 7%,var(--sv-surface));color:var(--sv-danger);font-size:11px;line-height:1.6}
.sv-page .sv-dialog-actions{display:flex;justify-content:flex-end;gap:9px;padding:20px 25px 23px}
.sv-page .sv-dialog-delete{min-height:42px;padding:0 16px;border:1px solid var(--sv-danger);border-radius:10px;background:var(--sv-danger);color:#fff;font-size:12px;font-weight:800;cursor:pointer;transition:160ms ease}
.sv-page .sv-dialog-delete:hover{filter:brightness(1.08);transform:translateY(-1px)}
.sv-page .sv-dialog-delete:disabled{opacity:.55;cursor:not-allowed;transform:none}
@keyframes sv-toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes sv-fade-in{from{opacity:0}to{opacity:1}}
@keyframes sv-dialog-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
@media(max-width:520px){.sv-page .sv-toast{right:16px;top:16px}.sv-page .sv-dialog-top{padding:21px 19px 16px}.sv-page .sv-dialog-warning{margin:0 19px}.sv-page .sv-dialog-actions{padding:17px 19px 20px}}
@media(max-width:650px){.sv-page .sv-stat-grid{grid-template-columns:1fr}.sv-page .sv-stat{padding:15px}.sv-page .sv-stat-value{font-size:23px}.sv-page .sv-toolbar{flex-direction:column;align-items:stretch!important}.sv-page .sv-actions{flex-wrap:wrap}}
`;

const CATEGORY_DEFINITIONS = {
  Documents: new Set(["pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv", "tsv", "xls", "xlsx", "ods", "ppt", "pptx", "odp", "json", "xml"]),
  Images: new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "tif", "tiff", "ico", "heic", "heif", "avif"]),
  Videos: new Set(["mp4", "m4v", "mov", "avi", "mkv", "webm", "wmv", "flv", "mpeg", "mpg", "3gp", "ogv"]),
  Audio: new Set(["mp3", "wav", "aac", "m4a", "ogg", "oga", "flac", "wma", "aiff", "aif", "opus"]),
  Archives: new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz", "zst", "cab", "iso"]),
};

function getFileCategory(file) {
  const name = String(file?.originalName || "");
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const mime = String(file?.mimeType || "").split(";")[0].trim().toLowerCase();
  for (const [category, extensions] of Object.entries(CATEGORY_DEFINITIONS)) {
    if (extensions.has(extension)) return category;
  }
  if (mime.startsWith("image/")) return "Images";
  if (mime.startsWith("video/")) return "Videos";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("wordprocessing") || mime.includes("msword") || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("presentation") || mime.includes("powerpoint")) return "Documents";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z") || mime.includes("compressed") || mime.includes("archive") || mime.includes("x-tar")) return "Archives";
  return "Other files";
}

function formatBytes(bytes = 0) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );

  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function getMimeTypeFromName(fileName = "") {
  const extension = String(fileName).split(".").pop().toLowerCase();
  const types = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    zip: "application/zip",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  };
  return types[extension] || "application/octet-stream";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fileType(file) {
  const name = file?.originalName || "";
  const extension = name.includes(".")
    ? name.split(".").pop().toUpperCase()
    : "";

  if (extension) return extension.slice(0, 5);

  const mime = file?.mimeType || "";

  return mime.startsWith("image/")
    ? "IMAGE"
    : mime.startsWith("video/")
      ? "VIDEO"
      : mime.startsWith("audio/")
        ? "AUDIO"
        : "FILE";
}

function resolvePreviewMimeType(blobMimeType, file) {
  const normalizedBlobMime = String(blobMimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  const normalizedFileMime = String(file?.mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (
    normalizedBlobMime &&
    normalizedBlobMime !== "application/octet-stream"
  ) {
    return normalizedBlobMime;
  }

  if (
    normalizedFileMime &&
    normalizedFileMime !== "application/octet-stream"
  ) {
    return normalizedFileMime;
  }

  const extension = String(file?.originalName || "")
    .split(".")
    .pop()
    .toLowerCase();

  const extensionTypes = {
    pdf: "application/pdf",
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    txt: "text/plain",
    doc: "application/msword",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  return (
    extensionTypes[extension] ||
    normalizedBlobMime ||
    normalizedFileMime ||
    ""
  );
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  return {
    message: text || `Request failed (${response.status})`,
  };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : options.body
          ? { "Content-Type": "application/json" }
          : {}),
      ...options.headers,
    },
  });

  const body = await readResponse(response);

  if (!response.ok || body.success === false) {
    const error = new Error(
      body.message || `Request failed (${response.status})`
    );

    error.status = response.status;
    error.body = body;

    throw error;
  }

  return body;
}

// SHA-256 helper.
// Iska output backend ke fileHash ke saath compare hoga.
async function calculateSHA256(blob) {
  if (!window.crypto?.subtle) {
    throw new Error(
      "SHA-256 verification is unavailable. Open SecureVault using localhost in Chrome or Edge."
    );
  }

  const buffer = await blob.arrayBuffer();
  const digest = await window.crypto.subtle.digest("SHA-256", buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeHash(value) {
  if (!value) return "";

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^0x/, "");
}

function getFriendlyError(error) {
  if (error?.status === 401) {
    return "Your login session may have expired. Please log in again.";
  }

  if (error?.status === 423 || error?.status === 403) {
    return "The vault may be locked or access may be restricted. Unlock your vault before continuing.";
  }

  if (error?.status === 413) {
    return "The upload was rejected because the request is too large.";
  }

  return error?.message || "Something went wrong. Please try again.";
}

export default function Files({ onNavigate, categoryFilter = null }) {
  const searchTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  const [files, setFiles] = useState([]);

  const [vaultCount, setVaultCount] = useState(null);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyFileId, setBusyFileId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [vaultLocked, setVaultLocked] = useState(false);
  const [unlockFormOpen, setUnlockFormOpen] = useState(false);
  const [vaultPassword, setVaultPassword] = useState("");
  const [unlockingVault, setUnlockingVault] = useState(false);

  const [preview, setPreview] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [pptxInfo, setPptxInfo] = useState({
    current: 0,
    total: 0,
    error: "",
  });

  const pptxCanvasRef = useRef(null);
  const pptxViewerRef = useRef(null);

  // Local folder selection states.
  const [localFiles, setLocalFiles] = useState([]);
  const [selectedLocalNames, setSelectedLocalNames] = useState([]);
  const [sourceFolderName, setSourceFolderName] = useState("");
  const [folderLoading, setFolderLoading] = useState(false);

  // ----------------------------------------------------------
  // OFFICE FILE PREVIEW
  // ----------------------------------------------------------

  useEffect(() => {
    if (!preview) return;

    let cancelled = false;
    let viewer = null;

    async function renderOfficeFile() {
      const extension = String(preview.file.originalName || "")
        .split(".")
        .pop()
        .toLowerCase();

      try {
        // Legacy Microsoft Word .doc preview.
        if (extension === "doc") {
          const arrayBuffer = await preview.blob.arrayBuffer();

          const parsed = parseMsDoc(arrayBuffer);
          const rendered = renderMsDoc(parsed);

          if (cancelled) return;

          setDocPreview({
            html: DOMPurify.sanitize(rendered.html),
            css: rendered.css || "",
          });

          return;
        }

        // Microsoft PowerPoint .pptx preview.
        if (extension === "pptx") {
          if (!pptxCanvasRef.current) {
            throw new Error("PowerPoint preview canvas is unavailable.");
          }

          viewer = new PPTXViewer({
            canvas: pptxCanvasRef.current,
          });

          pptxViewerRef.current = viewer;

          viewer.on("loadStart", () => {
            console.log("PPTX: Loading started");
          });

          viewer.on("loadComplete", (data) => {
            console.log("PPTX: Loading completed", data);
          });

          viewer.on("renderComplete", (slideIndex) => {
            console.log("PPTX: Slide rendered", slideIndex);
          });

          viewer.on("slideChanged", (slideIndex) => {
            console.log("PPTX: Slide changed", slideIndex);
          });

          const presentationFile = new File(
            [preview.blob],
            preview.file.originalName,
            {
              type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            }
          );

          await viewer.loadFile(presentationFile);

          const core = viewer.processor?.processor;

          console.log(
            "OUTER PROCESSOR KEYS:",
            Object.keys(viewer.processor || {})
          );

          console.log(
            "INNER PROCESSOR KEYS:",
            Object.keys(core || {})
          );

          console.log("INNER SLIDES:", core?.slides);

          console.log(
            "PRESENTATION DATA:",
            viewer.processor?.presentation
          );

          console.log(
            "INNER DRAWING DOCUMENT:",
            core?.drawingDocument
          );

          console.log(
            "INNER GRAPHICS:",
            core?.drawingDocument?.graphics
          );

          const firstSlide = core?.slides?.[0];

          console.log(
            "FIRST SLIDE KEYS:",
            Object.keys(firstSlide || {})
          );

          console.log("FIRST SLIDE OBJECT:", firstSlide);

          console.log(
            "FIRST SLIDE COMMON DATA:",
            firstSlide?.commonSlideData
          );

          console.log("FIRST SLIDE C.SLD:", firstSlide?.cSld);

          console.log(
            "FIRST SLIDE SHAPE TREE:",
            firstSlide?.commonSlideData?.shapeTree
          );

          const graphics = core?.drawingDocument?.graphics;
          const renderCanvas = graphics?._context?.canvas;

          if (renderCanvas) {
            try {
              const ctx = renderCanvas.getContext("2d");

              const pixels = ctx.getImageData(
                0,
                0,
                renderCanvas.width,
                renderCanvas.height
              ).data;

              let nonWhitePixels = 0;
              let paintedPixels = 0;

              for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] > 0) paintedPixels++;

                if (
                  pixels[i + 3] > 0 &&
                  (pixels[i] < 245 ||
                    pixels[i + 1] < 245 ||
                    pixels[i + 2] < 245)
                ) {
                  nonWhitePixels++;
                }
              }

              console.log("INTERNAL CANVAS PIXEL TEST:", {
                width: renderCanvas.width,
                height: renderCanvas.height,
                paintedPixels,
                nonWhitePixels,
              });
            } catch (error) {
              console.error(
                "Canvas pixel inspection failed:",
                error
              );
            }
          }

          if (cancelled) {
            viewer.destroy?.();
            return;
          }

          await viewer.render(pptxCanvasRef.current);

          const canvas = pptxCanvasRef.current;
          const ctx = canvas?.getContext("2d");

          if (ctx) {
            const pixels = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            ).data;

            let paintedPixels = 0;
            let nonWhitePixels = 0;

            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i + 3] > 0) paintedPixels++;

              if (
                pixels[i + 3] > 0 &&
                (pixels[i] < 245 ||
                  pixels[i + 1] < 245 ||
                  pixels[i + 2] < 245)
              ) {
                nonWhitePixels++;
              }
            }

            console.log("PIXELS AFTER PPTX RENDER:", {
              width: canvas.width,
              height: canvas.height,
              paintedPixels,
              nonWhitePixels,
            });
          }

          if (cancelled) return;

          setPptxInfo({
            current: viewer.getCurrentSlideIndex() || 0,
            total: viewer.getSlideCount() || 0,
            error: "",
          });
        }
      } catch (error) {
        console.error("Office preview error:", error);

        if (!cancelled) {
          setDocPreview(null);

          setPptxInfo({
            current: 0,
            total: 0,
            error: error.message || "Could not render this Office file.",
          });
        }
      }
    }

    renderOfficeFile();

    return () => {
      cancelled = true;

      if (viewer) {
        viewer.destroy?.();
      }

      if (pptxViewerRef.current === viewer) {
        pptxViewerRef.current = null;
      }
    };
  }, [preview]);

  // ----------------------------------------------------------
  // SEARCH
  // ----------------------------------------------------------

  useEffect(() => {
    searchTimerRef.current = setTimeout(() => {
      setAppliedSearch(search.trim());
    }, 300);

    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  // Auto-dismiss transient custom notifications. Keep operation progress visible.
  useEffect(() => {
    if (!notice || (notice.type === "info" && uploading)) return undefined;

    const timeout = window.setTimeout(
      () => setNotice(null),
      notice.type === "error" ? 6500 : 4500
    );

    return () => window.clearTimeout(timeout);
  }, [notice, uploading]);

  const mimeTypes = useMemo(() => {
    return [
      ...new Set(
        files.map((file) => file.mimeType).filter(Boolean)
      ),
    ].sort();
  }, [files]);

  // ----------------------------------------------------------
  // LOAD VAULT FILES
  // ----------------------------------------------------------

  const loadFiles = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    const makeParams = (page, limit) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: appliedSearch,
        sortBy,
        sortOrder,
      });
      if (typeFilter !== "All types") params.set("mimeType", typeFilter);
      return params;
    };

    try {
      // Category filtering is performed against the complete vault inventory,
      // not only the currently visible server page. Fetch every backend page,
      // then apply the selected category and paginate the matching results.
      if (categoryFilter) {
        const first = await apiRequest(`/vault/files?${makeParams(1, 100).toString()}`);
        if (requestId !== requestIdRef.current) return;
        const firstData = first.data || {};
        let allFiles = Array.isArray(firstData.files) ? [...firstData.files] : [];
        const totalPages = Math.max(1, Number(firstData.pagination?.totalPages || 1));

        for (let page = 2; page <= totalPages; page += 1) {
          const result = await apiRequest(`/vault/files?${makeParams(page, 100).toString()}`);
          if (requestId !== requestIdRef.current) return;
          const pageFiles = result.data?.files;
          if (Array.isArray(pageFiles)) allFiles.push(...pageFiles);
        }

        if (requestId !== requestIdRef.current) return;
        const matchingFiles = allFiles.filter((file) => getFileCategory(file) === categoryFilter);
        const total = matchingFiles.length;
        const totalPagesFiltered = Math.ceil(total / pagination.limit);
        const safePage = Math.min(Math.max(1, pagination.page), Math.max(1, totalPagesFiltered));
        const startIndex = (safePage - 1) * pagination.limit;

        setFiles(matchingFiles.slice(startIndex, startIndex + pagination.limit));
        setPagination((current) => ({
          ...current,
          page: safePage,
          total,
          totalPages: totalPagesFiltered,
          hasPreviousPage: safePage > 1,
          hasNextPage: safePage < totalPagesFiltered,
        }));
      } else {
        const result = await apiRequest(`/vault/files?${makeParams(pagination.page, pagination.limit).toString()}`);
        if (requestId !== requestIdRef.current) return;
        const data = result.data || {};
        setFiles(Array.isArray(data.files) ? data.files : []);
        setPagination((current) => ({ ...current, ...(data.pagination || {}) }));
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      if (error?.status === 423 || error?.status === 403) setVaultLocked(true);
      setFiles([]);
      setNotice({ type: "error", text: getFriendlyError(error) });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    appliedSearch,
    typeFilter,
    sortBy,
    sortOrder,
    categoryFilter,
  ]);

  useEffect(() => {
    loadFiles();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadFiles]);

  // ----------------------------------------------------------
  // VAULT COUNT
  // ----------------------------------------------------------

  const loadVaultCount = useCallback(async () => {
    try {
      const result = await apiRequest("/vault/files/count");

      setVaultCount(Number(result.data?.total ?? 0));
    } catch (error) {
      console.error("Could not load vault file count:", error);
    }
  }, []);

  useEffect(() => {
    loadVaultCount();
  }, [loadVaultCount, refreshVersion]);

  // ----------------------------------------------------------
  // VAULT STATUS
  // ----------------------------------------------------------

  const loadVaultStatus = useCallback(async () => {
    try {
      const result = await apiRequest("/vault/status");
      const locked = result.data?.isLocked;

      setVaultLocked(locked === true);

      if (locked === false) {
        setUnlockFormOpen(false);
        setVaultPassword("");
      }
    } catch (error) {
      console.error("Could not load vault status:", error);
    }
  }, []);

  useEffect(() => {
    loadVaultStatus();

    const statusInterval = setInterval(() => {
      loadVaultStatus();
    }, 3000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [loadVaultStatus]);

  // ----------------------------------------------------------
  // UNLOCK VAULT
  // ----------------------------------------------------------

  async function handleUnlockVault(event) {
    event.preventDefault();

    if (!vaultPassword.trim()) {
      setNotice({
        type: "error",
        text: "Please enter your account password to unlock the vault.",
      });
      return;
    }

    setUnlockingVault(true);
    setNotice(null);

    try {
      const result = await apiRequest("/vault/unlock", {
        method: "POST",
        body: JSON.stringify({
          password: vaultPassword,
        }),
      });

      setVaultLocked(false);
      setUnlockFormOpen(false);
      setVaultPassword("");

      setNotice({
        type: "success",
        text: result.message || "Vault unlocked successfully.",
      });

      setRefreshVersion((version) => version + 1);

      await loadFiles();
    } catch (error) {
      setNotice({
        type: "error",
        text: getFriendlyError(error),
      });
    } finally {
      setUnlockingVault(false);
    }
  }

  // ----------------------------------------------------------
  // SEARCH / FILTER / SORT
  // ----------------------------------------------------------

  function updateSearch(value) {
    setSearch(value);

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  }

  function updateType(value) {
    setTypeFilter(value);

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  }

  function changeSort(value) {
    const [nextSortBy, nextSortOrder] = value.split(":");

    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  }

  // ----------------------------------------------------------
  // SELECT SOURCE FOLDER
  // ----------------------------------------------------------


async function selectSourceFolder() {
  if (uploading || folderLoading) return;

  if (!window.secureVault?.selectFiles) {
    setNotice({
      type: "error",
      text: "Native Choose Files is available in the SecureVault Electron desktop application. Please open the desktop app.",
    });
    return;
  }

  setFolderLoading(true);
  setNotice(null);

  try {
    const result = await window.secureVault.selectFiles();

    if (result.canceled || !result.files?.length) {
      return;
    }

    const discoveredFiles = result.files.map((file) => ({
      token: file.token,
      name: file.name,
      size: file.size,
      type: file.type || file.mimeType || getMimeTypeFromName(file.name),
    }));

    setLocalFiles(discoveredFiles);
    setSelectedLocalNames(
      discoveredFiles.map((file) => file.token)
    );

    setSourceFolderName(
      `${discoveredFiles.length} individual file(s) selected`
    );

    setNotice({
      type: "success",
      text: `${discoveredFiles.length} file(s) selected. Select the files you want to Hide.`,
    });
  } catch (error) {
    setNotice({
      type: "error",
      text: getFriendlyError(error),
    });
  } finally {
    setFolderLoading(false);
  }
}


  // ----------------------------------------------------------
  // SELECT / DESELECT LOCAL FILES
  // ----------------------------------------------------------


function toggleLocalFile(token) {
  setSelectedLocalNames((current) => {
    if (current.includes(token)) {
      return current.filter((item) => item !== token);
    }

    return [...current, token];
  });
}

function toggleAllLocalFiles() {
  if (selectedLocalNames.length === localFiles.length) {
    setSelectedLocalNames([]);
  } else {
    setSelectedLocalNames(
      localFiles.map((file) => file.token)
    );
  }
}

  // ----------------------------------------------------------
  // HIDE FILES
  //
  // 1. Read selected local file.
  // 2. Calculate local SHA-256.
  // 3. Upload to encrypted vault.
  // 4. Compare backend hash.
  // 5. Read local file again.
  // 6. Verify it has not changed.
  // 7. Remove original local file.
  //
  // If any step fails, original file is preserved.
  // ----------------------------------------------------------


async function hideSelectedFiles() {
  if (!window.secureVault?.readSelectedFile ||
      !window.secureVault?.removeVerifiedSource) {
    setNotice({
      type: "error",
      text: "SecureVault desktop file operations are unavailable. Please restart the Electron application.",
    });
    return;
  }

  if (selectedLocalNames.length === 0) {
    setNotice({
      type: "error",
      text: "Please select at least one file to Hide.",
    });
    return;
  }

  // IMPORTANT: Hiding does NOT require vault unlock.

  setUploading(true);
  setNotice({
    type: "info",
    text: "Hide operation started. Do not close SecureVault until it finishes.",
  });

  let movedCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  const messages = [];

  try {
    for (const token of selectedLocalNames) {
      const localFile = localFiles.find(
        (item) => item.token === token
      );

      if (!localFile) continue;

      try {
        if (localFile.size > 50 * 1024 * 1024) {
          throw new Error(
            "File exceeds the 50 MB per-file upload limit."
          );
        }

        // Read selected file through the secure Electron bridge.
        const source = await window.secureVault.readSelectedFile(token);

        if (
          source.size !== localFile.size ||
          !source.hash ||
          source.bytes.length !== source.size
        ) {
          throw new Error("Source file verification failed.");
        }

        const sourceHash = normalizeHash(source.hash);

        const blob = new Blob(
          [source.bytes],
          { type: localFile.type || getMimeTypeFromName(source.name) }
        );

        const formData = new FormData();

        formData.append(
          "files",
          blob,
          source.name
        );

        // Existing backend upload route works without vault unlock.
        const result = await apiRequest("/vault/upload", {
          method: "POST",
          body: formData,
        });

        const uploadedFile = result.data?.files?.[0];

        if (!uploadedFile?.fileId) {
          throw new Error(
            "Backend did not confirm the uploaded file. Original preserved."
          );
        }

        const backendHash = normalizeHash(
          uploadedFile.fileHash
        );

        if (!backendHash || backendHash !== sourceHash) {
          throw new Error(
            "SHA-256 verification failed. Original local file preserved."
          );
        }

        // Electron main process rechecks source file hash and
        // deletes it only when the expected hash matches.
        await window.secureVault.removeVerifiedSource(
          token,
          backendHash
        );

        movedCount++;

        setLocalFiles((current) =>
          current.filter((item) => item.token !== token)
        );

        setSelectedLocalNames((current) =>
          current.filter((item) => item !== token)
        );
      } catch (error) {
        failedCount++;

        const message =
          `${localFile.name}: ${getFriendlyError(error)}`;

        messages.push(message);

        if (
          error?.message?.toLowerCase().includes("preserved") ||
          error?.message?.toLowerCase().includes("changed") ||
          error?.message?.toLowerCase().includes("failed")
        ) {
          duplicateCount++;
        }
      }
    }

    setPagination((current) => ({
      ...current,
      page: 1,
    }));

    setRefreshVersion((version) => version + 1);

    // Reload vault inventory only when it is unlocked.
    if (!vaultLocked) {
      await loadFiles();
    }

    if (failedCount === 0) {
      setNotice({
        type: "success",
        text: `${movedCount} file(s) successfully encrypted, verified and moved into SecureVault.`,
      });
    } else {
      setNotice({
        type: "error",
        text:
          `Hide completed. ${movedCount} file(s) moved successfully. ` +
          `${failedCount} file(s) could not be completed. ` +
          (duplicateCount > 0
            ? "Some files may exist in both locations. Original files were preserved wherever verification failed. "
            : "") +
          messages.slice(0, 5).join(" | "),
      });
    }
  } finally {
    setUploading(false);
  }
}

  // ----------------------------------------------------------
  // PREVIEW FILE
  // ----------------------------------------------------------

  async function previewFile(file) {
    setBusyFileId(file.fileId);
    setPreviewLoading(true);
    setNotice(null);

    try {
      const response = await fetch(
        `${API_BASE}/vault/files/${encodeURIComponent(file.fileId)}/view`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        const body = await readResponse(response);

        throw Object.assign(
          new Error(
            body.message || `Preview failed (${response.status})`
          ),
          {
            status: response.status,
          }
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const mimeType = resolvePreviewMimeType(blob.type, file);

      setDocPreview(null);

      setPptxInfo({
        current: 0,
        total: 0,
        error: "",
      });

      setPreview({
        file,
        blob,
        url: objectUrl,
        mimeType,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: getFriendlyError(error),
      });
    } finally {
      setBusyFileId(null);
      setPreviewLoading(false);
    }
  }

  // ----------------------------------------------------------
  // PPTX SLIDE NAVIGATION
  // ----------------------------------------------------------

  async function changePptxSlide(direction) {
    const viewer = pptxViewerRef.current;

    if (!viewer) return;

    try {
      if (direction === "next") {
        await viewer.nextSlide();
      } else {
        await viewer.previousSlide();
      }

      setPptxInfo({
        current: viewer.getCurrentSlideIndex(),
        total: viewer.getSlideCount(),
        error: "",
      });
    } catch (error) {
      console.error("Slide navigation error:", error);
    }
  }

  // ----------------------------------------------------------
  // UNHIDE FILE
  //
  // 1. User selects destination folder.
  // 2. Download decrypted file from backend.
  // 3. Verify SHA-256.
  // 4. Write file to destination.
  // 5. Read it back and verify again.
  // 6. Delete encrypted vault copy.
  //
  // If vault deletion fails, both copies remain.
  // ----------------------------------------------------------

  async function restoreFile(file) {
    if (!window.secureVault?.saveRestoredFile) {
      setNotice({
        type: "error",
        text: "SecureVault native Save dialog is unavailable. Restart the Electron desktop application. Your vault copy has not been deleted.",
      });
      return;
    }

    if (vaultLocked) {
      setNotice({
        type: "error",
        text: "Unlock your vault before using Unhide.",
      });
      return;
    }

    setBusyFileId(file.fileId);
    setNotice({
      type: "info",
      text: "Preparing and verifying your file. The Windows Save dialog will open next.",
    });

    let localRestoreVerified = false;
    const originalName = file.originalName || "restored-file";

    try {
      // Request the decrypted original file from the authenticated backend.
      const response = await fetch(
        `${API_BASE}/vault/files/${encodeURIComponent(file.fileId)}/restore`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const body = await readResponse(response);
        throw Object.assign(
          new Error(body.message || `Restore failed (${response.status})`),
          { status: response.status }
        );
      }

      const blob = await response.blob();
      const expectedHash = normalizeHash(file.fileHash);

      if (!expectedHash) {
        throw new Error(
          "The vault did not provide a file integrity hash. The encrypted vault copy was preserved."
        );
      }

      // Verify decrypted bytes before showing them to the native Save dialog.
      const restoredHash = await calculateSHA256(blob);
      if (restoredHash !== expectedHash) {
        throw new Error(
          "SHA-256 verification failed. The file was not saved and the vault copy was preserved."
        );
      }

      // Electron preload requires Uint8Array and verifies the hash again in main.
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const saveResult = await window.secureVault.saveRestoredFile(
        originalName,
        bytes,
        expectedHash
      );

      if (saveResult?.canceled) {
        setNotice({
          type: "info",
          text: "Unhide cancelled. Your encrypted vault copy was preserved.",
        });
        return;
      }

      if (!saveResult?.saved || !saveResult?.verified) {
        throw new Error(
          "Windows did not confirm a verified save. The encrypted vault copy was preserved."
        );
      }

      localRestoreVerified = true;

      // Only remove the encrypted copy after Electron confirms the local file hash.
      const result = await apiRequest(
        `/vault/files/${encodeURIComponent(file.fileId)}`,
        { method: "DELETE" }
      );

      localRestoreVerified = false;

      setNotice({
        type: "success",
        text:
          result.message ||
          `"${originalName}" was restored and verified on your computer, then removed from SecureVault.`,
      });

      setPreview((current) => {
        if (current?.file.fileId === file.fileId) {
          URL.revokeObjectURL(current.url);
          return null;
        }
        return current;
      });

      setRefreshVersion((version) => version + 1);
      await loadFiles();
    } catch (error) {
      if (localRestoreVerified) {
        setNotice({
          type: "error",
          text:
            `"${originalName}" was saved and verified on your computer, but SecureVault could not remove its encrypted copy. Both copies have been preserved. ` +
            getFriendlyError(error),
        });
      } else {
        setNotice({
          type: "error",
          text: `${getFriendlyError(error)} The encrypted vault copy has been preserved.`,
        });
      }
    } finally {
      setBusyFileId(null);
    }
  }

  // ----------------------------------------------------------
  // CLOSE PREVIEW
  // ----------------------------------------------------------

  function closePreview() {
    setPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }

      return null;
    });

    setDocPreview(null);

    setPptxInfo({
      current: 0,
      total: 0,
      error: "",
    });
  }

  // ----------------------------------------------------------
  // PERMANENT DELETE FROM VAULT
  // ----------------------------------------------------------

  async function deleteFile(file) {
    if (vaultLocked) {
      setNotice({
        type: "error",
        text: "Unlock your vault before permanently deleting a file.",
      });
      return;
    }

    setBusyFileId(file.fileId);
    setNotice(null);

    try {
      const result = await apiRequest(
        `/vault/files/${encodeURIComponent(file.fileId)}`,
        {
          method: "DELETE",
        }
      );

      setFiles((currentFiles) =>
        currentFiles.filter(
          (item) => item.fileId !== file.fileId
        )
      );

      setPagination((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
      }));

      setNotice({
        type: "success",
        text: result.message || "File permanently deleted.",
      });

      setRefreshVersion((version) => version + 1);

      setPreview((current) => {
        if (current?.file.fileId === file.fileId) {
          URL.revokeObjectURL(current.url);
          return null;
        }

        return current;
      });

      await loadFiles();
    } catch (error) {
      setNotice({
        type: "error",
        text: getFriendlyError(error),
      });
    } finally {
      setBusyFileId(null);
    }
  }

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  return (
    <section className="sv-page">
      <style>{styles}</style>

      <header>
        <div className="sv-eyebrow">Secure storage</div>

        <h1 className="sv-heading">{categoryFilter ? `${categoryFilter} Files` : "My Files"}</h1>

        <p className="sv-muted">
          {categoryFilter ? `Browsing ${categoryFilter.toLowerCase()} stored in your encrypted vault.` : "Move files into your encrypted SecureVault and restore them to your computer whenever you need them."}
        </p>
      </header>

      {/* STATISTICS */}

      <div className="sv-stat-grid">
        <div className="sv-card sv-stat">
          <div className="sv-stat-label">Files in vault</div>

          <div className="sv-stat-value">
            {vaultCount === null ? "…" : vaultCount}
          </div>

          <div className="sv-stat-foot">
            Total files reported by the backend
          </div>
        </div>

        <div className="sv-card sv-stat">
          <div className="sv-stat-label">Files on this page</div>

          <div className="sv-stat-value">{files.length}</div>

          <div className="sv-stat-foot">
            Page {pagination.page} of{" "}
            {Math.max(pagination.totalPages || 0, 1)}
          </div>
        </div>

        <div className="sv-card sv-stat">
          <div className="sv-stat-label">Storage connection</div>

          <div
            className="sv-stat-value"
            style={{ fontSize: 20 }}
          >
            {loading ? "Connecting…" : "Backend linked"}
          </div>

          <div className="sv-stat-foot">
            File operations use your authenticated session
          </div>
        </div>
      </div>

      {/* HIDE FILES */}

      <section className="sv-card" style={{ padding: 20 }}>
        <div className="sv-eyebrow">Local file transfer</div>

        <h2 style={{ margin: "8px 0", fontSize: 19 }}>
          Hide files in SecureVault
        </h2>

        <p className="sv-muted" style={{ marginTop: 5 }}>
  Select files from anywhere on your computer.
  SecureVault encrypts and verifies each file before removing
  its original.
</p>

        <div className="sv-dropzone" style={{ marginTop: 15 }}>
          <div
            style={{
              fontSize: 30,
              marginBottom: 10,
            }}
          >
            🔐
          </div>

          <div style={{ fontSize: 14, fontWeight: 750 }}>
            {folderLoading
  ? "Opening file picker…"
  : "Select files from your computer"}
          </div>

          <p className="sv-muted" style={{ margin: "7px 0 15px" }}>
  Select individual files from Desktop, Documents, Downloads,
  external drives, or any other location.
</p>
          <button
            type="button"
            className="sv-button sv-button-primary"
            disabled={uploading || folderLoading}
            onClick={selectSourceFolder}
          >
           {folderLoading ? "Please wait…" : "📄 Choose Files"}
          </button>

          {sourceFolderName && (
            <p className="sv-muted" style={{ marginBottom: 0 }}>
              Selected files: <strong>{sourceFolderName}</strong>
            </p>
          )}
        </div>

        {localFiles.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div>
                <strong style={{ fontSize: 13 }}>
                  Files available to Hide
                </strong>

                <p className="sv-muted" style={{ margin: "4px 0 0" }}>
                  {selectedLocalNames.length} of {localFiles.length} selected
                </p>
              </div>

              <button
                type="button"
                className="sv-button"
                disabled={uploading}
                onClick={toggleAllLocalFiles}
              >
                {selectedLocalNames.length === localFiles.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: 9,
              }}
            >
              {localFiles.map((localFile) => (
                <label
                  key={localFile.token}
                  className="sv-local-file"
                  style={{
                    cursor: uploading ? "not-allowed" : "pointer",
                    opacity: uploading ? 0.65 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedLocalNames.includes(localFile.token)}
                    disabled={uploading}
                    onChange={() => toggleLocalFile(localFile.token)}
                  />

                  <span className="sv-file-icon">
                    {localFile.name.includes(".")
                      ? localFile.name.split(".").pop().toUpperCase().slice(0, 5)
                      : "FILE"}
                  </span>

                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {localFile.name}
                    </span>

                    <span className="sv-muted" style={{ fontSize: 10 }}>
                      {formatBytes(localFile.size)}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="sv-button sv-button-primary"
                disabled={
                  uploading ||
                  selectedLocalNames.length === 0
                }
                onClick={hideSelectedFiles}
              >
                {uploading
                  ? "Encrypting and moving files…"
                  : `🔒 Hide ${selectedLocalNames.length} selected file(s)`}
              </button>
            </div>
          </div>
        )}

        <p className="sv-muted" style={{ fontSize: 10, marginBottom: 0 }}>
          Select individual files using the native Windows file picker. Maximum file size: 50 MB per file. Keep SecureVault open until the operation finishes.
        </p>
      </section>

      {/* VAULT LOCK */}

      {vaultLocked && (
        <section
          className="sv-card"
          style={{
            marginTop: 14,
            marginBottom: 22,
            padding: "20px 22px",
            border: "1px solid var(--sv-accent)",
            borderRadius: 16,
            background:
              "linear-gradient(120deg, var(--sv-surface), var(--sv-surface-raised))",
            boxShadow: "var(--sv-shadow)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                minWidth: 0,
                flex: "1 1 320px",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 66,
                  height: 66,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 14,
                  background: "var(--sv-surface-raised)",
                  color: "var(--sv-accent)",
                  fontSize: 32,
                }}
              >
                🔒
              </div>

              <div>
                <h2
                  style={{
                    margin: "0 0 7px",
                    fontSize: 22,
                    fontWeight: 750,
                    letterSpacing: "-0.5px",
                  }}
                >
                  Unlock Your Vault
                </h2>

                <p className="sv-muted" style={{ margin: 0 }}>
                  Your vault is currently locked. Unlock it with your
                  account password to preview, restore, or delete files.
                </p>
              </div>
            </div>

            {!unlockFormOpen && (
              <button
                type="button"
                className="sv-button sv-button-primary"
                style={{
                  minHeight: 48,
                  padding: "0 22px",
                  fontSize: 13,
                  flexShrink: 0,
                }}
                onClick={() => {
                  setNotice(null);
                  setUnlockFormOpen(true);
                }}
              >
                🔒 Unlock Vault →
              </button>
            )}
          </div>

          {unlockFormOpen && (
            <form
              onSubmit={handleUnlockVault}
              style={{
                marginTop: 20,
                paddingTop: 18,
                borderTop: "1px solid var(--sv-border)",
              }}
            >
              <label
                htmlFor="files-vault-password"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Account password
              </label>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <input
                  id="files-vault-password"
                  className="sv-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your account password"
                  value={vaultPassword}
                  onChange={(event) =>
                    setVaultPassword(event.target.value)
                  }
                  required
                  disabled={unlockingVault}
                  style={{
                    flex: "1 1 240px",
                    minHeight: 46,
                  }}
                />

                <button
                  type="submit"
                  className="sv-button sv-button-primary"
                  disabled={
                    unlockingVault || !vaultPassword.trim()
                  }
                >
                  {unlockingVault ? "Unlocking…" : "Unlock Vault →"}
                </button>

                <button
                  type="button"
                  className="sv-button"
                  disabled={unlockingVault}
                  onClick={() => {
                    setUnlockFormOpen(false);
                    setVaultPassword("");
                    setNotice(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* PREMIUM THEME-MATCHED NOTIFICATIONS */}

      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          aria-live={notice.type === "error" ? "assertive" : "polite"}
          className={`sv-toast sv-toast-${notice.type || "info"}`}
        >
          <span className="sv-toast-icon" aria-hidden="true">
            {notice.type === "success" ? "✓" : notice.type === "error" ? "!" : "i"}
          </span>
          <div className="sv-toast-message">
            <strong className="sv-toast-title">
              {notice.type === "success"
                ? "Operation completed"
                : notice.type === "error"
                  ? "Action needs attention"
                  : "SecureVault"}
            </strong>
            {notice.text}
          </div>
          <button
            type="button"
            className="sv-toast-close"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* VAULT FILE INVENTORY */}

      <section
        className="sv-card"
        style={{ marginTop: 22, overflow: "hidden" }}
      >
        <div
          className="sv-toolbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            padding: 18,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15 }}>
              {categoryFilter ? `${categoryFilter} inventory` : "File inventory"}
            </h2>
            {categoryFilter && (
              <button type="button" className="sv-button" style={{ marginTop: 9, minHeight: 32 }} onClick={() => onNavigate?.("Files", { clearCategory: true })}>
                ← Show all files
              </button>
            )}

            <p className="sv-muted" style={{ margin: "5px 0 0" }}>
              Search, filter, preview, Unhide, or permanently delete
              files in your vault.
            </p>
          </div>

          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <input
              className="sv-input"
              aria-label="Search files"
              placeholder="Search files..."
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              style={{ width: 190 }}
            />

            <select
              className="sv-select"
              aria-label="Filter by file type"
              value={typeFilter}
              onChange={(event) => updateType(event.target.value)}
              style={{ width: 150 }}
            >
              <option value="All types">All types</option>

              {mimeTypes.map((mime) => (
                <option value={mime} key={mime}>
                  {mime}
                </option>
              ))}
            </select>

            <select
              className="sv-select"
              aria-label="Sort files"
              value={`${sortBy}:${sortOrder}`}
              onChange={(event) => changeSort(event.target.value)}
              style={{ width: 155 }}
            >
              <option value="date:desc">Newest first</option>
              <option value="date:asc">Oldest first</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="size:desc">Largest first</option>
              <option value="size:asc">Smallest first</option>
            </select>

            <button
              type="button"
              className="sv-button"
              disabled={loading}
              onClick={loadFiles}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="sv-table-wrap">
          <table className="sv-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Added</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {files.map((file) => (
                <tr key={file.fileId}>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        minWidth: 190,
                      }}
                    >
                      <span className="sv-file-icon">
                        {fileType(file)}
                      </span>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            overflowWrap: "anywhere",
                            whiteSpace: "normal",
                          }}
                        >
                          {file.originalName}
                        </div>

                        <div
                          className="sv-muted"
                          style={{
                            fontSize: 10,
                            marginTop: 3,
                          }}
                        >
                          Key version {file.keyVersion ?? "—"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>{file.mimeType || fileType(file)}</td>

                  <td>{formatBytes(file.fileSize)}</td>

                  <td style={{ color: "var(--sv-text-muted)" }}>
                    {formatDate(file.createdAt)}
                  </td>

                  <td>
                    <span className="sv-status">Encrypted</span>
                  </td>

                  <td>
                    <div className="sv-actions">
                      <button
                        type="button"
                        className="sv-button sv-button-primary"
                        disabled={
                          busyFileId !== null ||
                          loading ||
                          vaultLocked
                        }
                        onClick={() => previewFile(file)}
                        title={`Preview ${file.originalName}`}
                      >
                        {busyFileId === file.fileId
                          ? "Working…"
                          : "Preview"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && (
            <div className="sv-empty">
              Loading files from your vault…
            </div>
          )}

          {!loading && files.length === 0 && (
            <div className="sv-empty">
              {categoryFilter
                ? `No ${categoryFilter.toLowerCase()} found in your vault.`
                : appliedSearch || typeFilter !== "All types"
                  ? "No matching files. Try a different search or filter."
                  : "No files were returned by the backend. Select files above to Hide them."}
            </div>
          )}
        </div>

        <div className="sv-pagination">
          <span className="sv-muted">
            {pagination.total === 0
              ? "0 files"
              : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )} of ${pagination.total} file(s)`}
          </span>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="sv-button"
              disabled={loading || !pagination.hasPreviousPage}
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: Math.max(1, current.page - 1),
                }))
              }
            >
              ← Previous
            </button>

            <button
              type="button"
              className="sv-button"
              disabled={loading || !pagination.hasNextPage}
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
            >
              Next →
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "0 17px 15px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="sv-button"
            onClick={() => onNavigate?.("Backups")}
          >
            View backups →
          </button>
        </div>
      </section>

      {/* FILE PREVIEW MODAL */}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.file.originalName}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,.78)",
            display: "grid",
            placeItems: "center",
            padding: 18,
          }}
        >
          <div
            className="sv-card"
            style={{
              width: "min(100%, 1000px)",
              maxHeight: "90vh",
              overflow: "auto",
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  overflowWrap: "anywhere",
                }}
              >
                <h2 style={{ fontSize: 16, margin: 0 }}>
                  {preview.file.originalName}
                </h2>

                <p className="sv-muted">
                  Previewing decrypted content. Close this window
                  when finished.
                </p>
              </div>

              <button
                type="button"
                className="sv-button"
                onClick={closePreview}
              >
                Close
              </button>
            </div>

            <div
              style={{
                minHeight: 180,
                maxHeight: "60vh",
                overflow: "auto",
                marginTop: 14,
                border: "1px solid var(--sv-border)",
                borderRadius: 12,
                padding: 12,
                background: "var(--sv-surface-raised)",
              }}
            >
              {(() => {
                const extension = String(
                  preview.file.originalName || ""
                )
                  .split(".")
                  .pop()
                  .toLowerCase();

                // Images.
                if (preview.mimeType.startsWith("image/")) {
                  return (
                    <img
                      src={preview.url}
                      alt={preview.file.originalName}
                      style={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: "55vh",
                        objectFit: "contain",
                        margin: "auto",
                      }}
                    />
                  );
                }

                // PDF.
                if (preview.mimeType === "application/pdf") {
                  return (
                    <iframe
                      src={preview.url}
                      title={preview.file.originalName}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "65vh",
                        border: 0,
                        background: "#fff",
                      }}
                    />
                  );
                }

                // Video.
                if (preview.mimeType.startsWith("video/")) {
                  return (
                    <video
                      key={preview.url}
                      src={preview.url}
                      controls
                      playsInline
                      preload="metadata"
                      style={{
                        display: "block",
                        width: "100%",
                        maxHeight: "65vh",
                        margin: "0 auto",
                        background: "#000",
                      }}
                    />
                  );
                }

                // Audio.
                if (preview.mimeType.startsWith("audio/")) {
                  return (
                    <audio
                      src={preview.url}
                      controls
                      preload="metadata"
                      style={{ width: "100%" }}
                    />
                  );
                }

                // Legacy Word .doc.
                if (extension === "doc") {
                  if (!docPreview) {
                    return (
                      <p className="sv-muted">
                        Loading Word document...
                      </p>
                    );
                  }

                  return (
                    <div
                      style={{
                        background: "#fff",
                        color: "#222",
                        padding: 20,
                        minHeight: 400,
                        overflow: "auto",
                      }}
                    >
                      <style>{docPreview.css}</style>

                      <div
                        className="msdoc-root"
                        dangerouslySetInnerHTML={{
                          __html: docPreview.html,
                        }}
                      />
                    </div>
                  );
                }

                // PowerPoint .pptx.
                if (extension === "pptx") {
                  if (pptxInfo.error) {
                    return (
                      <p className="sv-notice sv-notice-error">
                        {pptxInfo.error}
                      </p>
                    );
                  }

                  return (
                    <div style={{ width: "100%" }}>
                      <canvas
                        ref={pptxCanvasRef}
                        width={1280}
                        height={720}
                        style={{
                          display: "block",
                          maxWidth: "100%",
                          maxHeight: "55vh",
                          aspectRatio: "16 / 9",
                          objectFit: "contain",
                          background: "#fff",
                          margin: "0 auto",
                        }}
                      />

                      {pptxInfo.total > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 14,
                            marginTop: 15,
                          }}
                        >
                          <button
                            type="button"
                            className="sv-button"
                            disabled={pptxInfo.current <= 0}
                            onClick={() =>
                              changePptxSlide("previous")
                            }
                          >
                            ← Previous
                          </button>

                          <span className="sv-muted">
                            Slide {pptxInfo.current + 1} of{" "}
                            {pptxInfo.total}
                          </span>

                          <button
                            type="button"
                            className="sv-button"
                            disabled={
                              pptxInfo.current >=
                              pptxInfo.total - 1
                            }
                            onClick={() =>
                              changePptxSlide("next")
                            }
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                // Plain text.
                if (
                  preview.mimeType === "text/plain" ||
                  extension === "txt"
                ) {
                  return (
                    <iframe
                      src={preview.url}
                      title={preview.file.originalName}
                      sandbox=""
                      style={{
                        width: "100%",
                        height: "55vh",
                        border: 0,
                      }}
                    />
                  );
                }

                return (
                  <p className="sv-muted">
                    Preview is not supported for this file type.
                  </p>
                );
              })()}
            </div>

            <div
              className="sv-actions"
              style={{
                marginTop: 16,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="sv-button sv-button-primary"
                disabled={
                  busyFileId !== null ||
                  vaultLocked
                }
                onClick={() => restoreFile(preview.file)}
              >
                {busyFileId === preview.file.fileId
                  ? "Restoring…"
                  : "Unhide"}
              </button>

              <button
                type="button"
                className="sv-button sv-button-danger"
                disabled={busyFileId !== null || vaultLocked}
                onClick={() => setConfirmDeleteFile(preview.file)}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM PERMANENT DELETE CONFIRMATION */}

      {confirmDeleteFile && (
        <div
          className="sv-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmDeleteFile(null);
            }
          }}
        >
          <section
            className="sv-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sv-delete-dialog-title"
            aria-describedby="sv-delete-dialog-description"
          >
            <div className="sv-dialog-top">
              <div className="sv-dialog-icon" aria-hidden="true">
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 className="sv-dialog-title" id="sv-delete-dialog-title">
                  Permanently delete file?
                </h2>
                <p className="sv-dialog-copy" id="sv-delete-dialog-description">
                  You are about to permanently remove this file from your SecureVault.
                </p>
                <span className="sv-dialog-filename">
                  {confirmDeleteFile.originalName || "Untitled file"}
                </span>
              </div>
            </div>

            <p className="sv-dialog-warning">
              This action cannot be undone. The encrypted vault copy will be permanently deleted.
            </p>

            <div className="sv-dialog-actions">
              <button
                type="button"
                className="sv-button"
                onClick={() => setConfirmDeleteFile(null)}
                disabled={busyFileId !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sv-dialog-delete"
                disabled={busyFileId !== null}
                onClick={() => {
                  const fileToDelete = confirmDeleteFile;
                  setConfirmDeleteFile(null);
                  deleteFile(fileToDelete);
                }}
              >
                Delete permanently
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
