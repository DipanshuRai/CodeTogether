import axios from "axios";
import { LANGUAGE_VERSIONS } from "../constants.js";

export const executeCode = async (language, sourceCode, stdin="") => {
    
  try {
    if (!language || !LANGUAGE_VERSIONS[language]) {       
      throw new Error(`Unsupported language: ${language}`);
    }
    
    if (!sourceCode || typeof sourceCode !== "string") {
      throw new Error("Invalid source code");
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

    const response = await axios.post("https://emkc.org/api/v2/piston/execute", payload);

    return response.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      throw new Error(`API Error: ${error.response.data.message || error.response.statusText}`);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error("Network Error: Could not connect to the execution service");
    } else {
      // Something happened in setting up the request
      throw new Error(`Execution Error: ${error.message}`);
    }
  }
};