import { axiosPrivate } from "./axios";

export async function authenticateWithLiveblocks(room) {
  try {
    const response = await axiosPrivate.post("/api/liveblocks/auth", {
      room,
    });
    
    return {
      token: response.data.token,
    };
  } catch (error) {
    console.error("Failed to authenticate with Liveblocks:", error);
    throw error;
  }
}