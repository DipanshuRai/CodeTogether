import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { axiosPrivate } from "../api/axios";
import "./Loader.css";


const PersistLogin = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { auth, setAuth } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const verifyRefreshToken = async () => {
      try {
        const res=await axiosPrivate.post('/api/auth/refresh-token');
        setAuth({
            accessToken: res.data.accessToken,
            user: res.data.user
        })
      } finally {
        isMounted && setIsLoading(false);
      }
    };
    !auth?.accessToken ? verifyRefreshToken() : setIsLoading(false);

    return () => {
      isMounted = false;
    };
  }, [auth?.accessToken]);

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
