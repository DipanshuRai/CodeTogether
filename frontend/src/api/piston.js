import axios from "axios";
import { LANGUAGE_VERSIONS } from "../utils/constants.js";

const MAX_CODE_LENGTH = 100000; // 100 KB limit for source code
const MAX_STDIN_LENGTH = 10000;  // 10 KB limit for stdin

export const Piston = async (language, sourceCode, stdin="") => {
    
  try {
    if (!language || !LANGUAGE_VERSIONS[language]) {       
      throw new Error(`Unsupported language: ${language}`);
    }
    
    if (!sourceCode || typeof sourceCode !== "string") {
      throw new Error("Source code must be a non-empty string");
    }

    if (sourceCode.length > MAX_CODE_LENGTH) {
        throw new Error(`Source code exceeds the maximum limit of ${MAX_CODE_LENGTH / 1000} KB.`);
    }
    if (stdin.length > MAX_STDIN_LENGTH) {
        throw new Error(`Input (stdin) exceeds the maximum limit of ${MAX_STDIN_LENGTH / 1000} KB.`);
    }
    
    const payload = {
      language: language,
      version: LANGUAGE_VERSIONS[language],
      files: [
        {
          content: sourceCode,
        },
      ],
      stdin: stdin,
    };

    const response = await axios.post(import.meta.env.VITE_PISTON_API_URL, payload);

    return response.data;
  } catch (error) {
    if (error.response) {
      const apiErrorMessage = error.response.data.message || error.response.statusText;
      console.error("API Error:", apiErrorMessage);
      throw new Error(`Execution Service Error: ${apiErrorMessage}`);
    } else if (error.request) {
      console.error("Network Error:", error.request);
      throw new Error("Network Error: Could not connect to the execution service.");
    } else {
      console.error("Client-side Error:", error.message);
      throw new Error(`${error.message}`);
    }
  }
};