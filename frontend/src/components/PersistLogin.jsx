import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { axiosPrivate } from "../api/axios";
import "./Loader.css";
import axios from "../api/axios";


const PersistLogin = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { auth, setAuth } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const verifyRefreshToken = async () => {
      try {
        const res=await axios.post('/api/auth/refresh-token',{},{withCredentials:true});
        setAuth({
            accessToken: res.data.accessToken,
            user: res.data.user
        });
        axiosPrivate.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
      } catch (err) {
        console.error("Persistent login failed");
      } finally {
        isMounted && setIsLoading(false);
      }
    };
    !auth?.accessToken ? verifyRefreshToken() : setIsLoading(false);

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      {isLoading ? (
        <div className="loading-indicator">
          <div></div>
          <div></div>
          <div></div>
        </div>
      ) : (
        <Outlet />
      )}
    </>
  );
};

export default PersistLogin;
