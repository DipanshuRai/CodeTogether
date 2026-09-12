import axios from "axios";

// Judge0 CE language ids. Source: https://ce.judge0.com/languages
// We keep the keys identical to our UI ids so nothing else has to change.
const JUDGE0_LANGUAGE_IDS = {
  c: 50,           // C (GCC 9.2.0)
  cpp: 54,         // C++ (GCC 9.2.0)
  java: 62,        // Java (OpenJDK 13.0.1)
  python: 71,      // Python (3.8.1)
  javascript: 63,  // JavaScript (Node.js 12.14.0)
  typescript: 74,  // TypeScript (3.7.4)
  csharp: 51,      // C# (Mono 6.6.0.161)
  php: 68,         // PHP (7.4.1)
  sql: 82,         // SQL (SQLite 3.27.2)
};

const MAX_CODE_LENGTH = 100000; // 100 KB
const MAX_STDIN_LENGTH = 10000; // 10 KB

// Configuration — all overridable via .env.
//   VITE_JUDGE0_URL  default https://judge0-ce.p.rapidapi.com
//   VITE_JUDGE0_KEY  required for RapidAPI; leave blank if self-hosted
//   VITE_JUDGE0_HOST default judge0-ce.p.rapidapi.com (RapidAPI requires this header)
const JUDGE0_URL =
  import.meta.env.VITE_JUDGE0_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_KEY = import.meta.env.VITE_JUDGE0_KEY || "";
const JUDGE0_HOST =
  import.meta.env.VITE_JUDGE0_HOST || "judge0-ce.p.rapidapi.com";

// Browser-safe base64 helpers (handle UTF-8 properly — `btoa` alone breaks
// on any non-ASCII char in the source / stdin).
const b64encode = (str) => {
  if (str == null || str === "") return "";
  const utf8 = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < utf8.length; i++) bin += String.fromCharCode(utf8[i]);
  return btoa(bin);
};

const b64decode = (str) => {
  if (!str) return "";
  try {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return str;
  }
};

const buildHeaders = () => {
  const h = { "Content-Type": "application/json" };
  if (JUDGE0_KEY) {
    h["X-RapidAPI-Key"] = JUDGE0_KEY;
    h["X-RapidAPI-Host"] = JUDGE0_HOST;
  }
  return h;
};

// Adapt a Judge0 submission response into the Piston-shaped object that
// EditorHeader.runCode already knows how to consume. That keeps the call
// site untouched even though the runner backend has changed.
const toPistonShape = (langId, lang, j0) => {
  const stdout = b64decode(j0.stdout);
  const stderr = b64decode(j0.stderr);
  const compileOutput = b64decode(j0.compile_output);
  const message = b64decode(j0.message);
  const statusId = j0.status?.id ?? 0; // 3 = Accepted
  const ok = statusId === 3;

  const result = {
    language: lang,
    version: String(langId),
    run: {
      stdout,
      stderr: stderr || (!ok && !compileOutput ? message : ""),
      output: `${stdout}${stderr || (!ok && !compileOutput ? message : "")}`,
      code: ok ? 0 : 1,
      signal: null,
    },
  };
  if (compileOutput) {
    result.compile = {
      stdout: "",
      stderr: compileOutput,
      output: compileOutput,
      code: 1,
    };
  }
  return result;
};

// Drop-in replacement for the old Piston runner. Same signature so the
// rest of the app keeps working without changes.
export const Piston = async (language, sourceCode, stdin = "") => {
  if (!language) throw new Error("No language selected");
  if (!sourceCode || typeof sourceCode !== "string" || !sourceCode.trim()) {
    throw new Error("Source code must be a non-empty string");
  }
  if (sourceCode.length > MAX_CODE_LENGTH) {
    throw new Error(`Source code exceeds the maximum limit of ${MAX_CODE_LENGTH / 1000} KB.`);
  }
  if (stdin && stdin.length > MAX_STDIN_LENGTH) {
    throw new Error(`Input (stdin) exceeds the maximum limit of ${MAX_STDIN_LENGTH / 1000} KB.`);
  }

  const languageId = JUDGE0_LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Unsupported language for Judge0: ${language}`);
  }

  if (!JUDGE0_KEY && JUDGE0_HOST.endsWith("rapidapi.com")) {
    throw new Error(
      "VITE_JUDGE0_KEY is not set. Add your RapidAPI key for Judge0 CE in frontend/.env."
    );
  }

  const url = `${JUDGE0_URL.replace(/\/$/, "")}/submissions?base64_encoded=true&wait=true`;
  const payload = {
    source_code: b64encode(sourceCode),
    language_id: languageId,
    stdin: b64encode(stdin || ""),
  };

  try {
    const response = await axios.post(url, payload, {
      timeout: 30000, // submissions+compile can be slow on the free tier
      headers: buildHeaders(),
    });
    return toPistonShape(languageId, language, response.data || {});
  } catch (error) {
    if (error.response) {
      const apiMessage =
        error.response.data?.message ||
        error.response.data?.error ||
        error.response.statusText ||
        `HTTP ${error.response.status}`;
      console.error("Judge0 API error:", error.response.status, error.response.data);
      // 429 = quota exhausted on RapidAPI free tier.
      if (error.response.status === 429) {
        throw new Error(
          "Daily Judge0 quota exceeded (RapidAPI free tier = 50 runs/day). Try again tomorrow or upgrade the plan."
        );
      }
      throw new Error(`Execution Service Error: ${apiMessage}`);
    }
    if (error.request) {
      console.error("Judge0 network error:", error.message);
      throw new Error("Network Error: could not reach the execution service.");
    }
    console.error("Judge0 client error:", error);
    throw new Error(error.message || "Unknown execution error");
  }
};
