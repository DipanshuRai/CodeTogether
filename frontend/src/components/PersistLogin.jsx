import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { axiosPrivate } from "../api/axios";
import axios from "../api/axios";

const PersistLogin = () => {
  const { auth, setAuth, setIsLoading } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const verifyRefreshToken = async () => {
      try {
        const res = await axios.post(
          "/api/auth/refresh-token",
          {},
          { withCredentials: true }
        );
        setAuth({
          accessToken: res.data.accessToken,
          user: res.data.user,
        });
        axiosPrivate.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${res.data.accessToken}`;
      } catch (err) {
        console.error("Persistent login failed: No valid refresh token.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (!auth?.accessToken) {
      verifyRefreshToken();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  return <Outlet />;
};

export default PersistLogin;
