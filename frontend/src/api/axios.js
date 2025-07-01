import axios from "axios";

const BASE_URL="http://localhost:5000";
// const BASE_URL="http://192.168.0.113:5000";

export default axios.create({
    baseURL: BASE_URL
});

export const axiosPrivate=axios.create({
    baseURL: BASE_URL,
    headers: {'Content-Type': 'application/json'},
    withCredentials: true
});

// Attach the interceptor
axiosPrivate.interceptors.response.use(
  response => response, // return the response if no error
  async error => {
    const originalRequest = error.config;

    // Check if the failed request was for the refresh token endpoint ***
    if (originalRequest.url === '/api/auth/refresh-token') {
        // If the refresh token request itself fails, we can't recover.
        // Here you would typically handle logout logic.
        console.error("Refresh token is invalid or expired. Logging out.");
        return Promise.reject(error);
    }

    // If token is expired and it's not a retry already
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          "/api/auth/refresh-token",
          {},
          { withCredentials: true }
        );
        console.log("Token refresh response: ",res);
        
        const newAccessToken = res.data.accessToken;

        // Set new token in headers
        axiosPrivate.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

        // Retry the original request
        return axiosPrivate(originalRequest);
      } catch (refreshErr) {
        console.error("Token refresh failed", refreshErr);
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);
