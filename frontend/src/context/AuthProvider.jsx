import { useContext, createContext, useState } from "react";

const AuthContext = createContext({});

export const useAuth = () => {
    return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    accessToken: null,
    user: null,
  });

  return (
    <AuthContext.Provider value={{ auth, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
