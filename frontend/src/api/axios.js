import axios from "axios";

const BASE_URL="http://localhost:5000";

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
        axiosPrivate.defaults.headers['Authorization'] = `Bearer ${newAccessToken}`;
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
