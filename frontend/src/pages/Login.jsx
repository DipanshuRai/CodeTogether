import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { FaCode } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthProvider";
import { axiosPrivate } from "../api/axios";
import { useGoogleLogin } from "@react-oauth/google";
import axios from "../api/axios";
import "./Signup.css";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!formData.email.trim() || !formData.password.trim()) {
      toast.error("Field cannot be empty");
      setIsLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Invalid email format");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must contain atleast 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axiosPrivate.post("/api/auth/login", formData);
      console.log(response.data);
      
      const { accessToken, user } = response.data;
      setAuth({ accessToken, user });
      toast.success(response.data.message);
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLoginSuccess=async(tokenResponse)=>{
    setIsGoogleLoading(true);

    try{
      // Get user info from google
      const googleUser=await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: {Authorization: `Bearer ${tokenResponse.access_token}`},
        }
      );

      // Send user info to your backend
      const {data}=await axiosPrivate.post("/api/auth/google-login",{                
        email: googleUser.data.email,
        fullname: googleUser.data.name,
      });      

      // Set auth state from your backend's response
      const {accessToken, user}=data;
      setAuth({accessToken, user});
      toast.success(data.message || "Login successful");
      navigate("/");
    } catch(error) {
      toast.error("Google login failed")
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleLoginSuccess,
    onError: () => {
      toast.error("Google login was cancelled or failed.");
    },
  });

  return (
    <div className="signup-page">
      <form onSubmit={handleSubmit} className="signup-form">
        <div className="header">
          <div className="logo-container">
            <FaCode className="logo" />
          </div>
          <div className="title">
            <div className="title1">Code</div>
            <div className="title2">Together</div>
          </div>
        </div>
        <div className="input">
          <label className="label">Email</label>
          <div className="input-wrapper">
            <Mail className="input-icon" />
            <input
              type="email"
              value={formData.email}
              placeholder="Email"
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="input-container"
            />
          </div>
        </div>
        <div className="input">
          <label className="label">Password</label>
          <div className="input-wrapper">
            <Lock className="input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              placeholder="Password"
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="input-container"
            />
            <div className="eye">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <Eye className="input-icon" />
                ) : (
                  <EyeOff className="input-icon" />
                )}
              </button>
            </div>
          </div>
        </div>
        <button type="submit" className="signup-btn" disabled={isLoading}>
          {isLoading ? <Loader2 className="input-icon spin" /> : "Login"}
        </button>
        <div className="separator">
          <div className="line"></div>or<div className="line"></div>
        </div>
        <div className="google-signup">
          <button type="button" onClick={() => googleLogin()} className="google-signup-btn" disabled={isLoading || isGoogleLoading}>
            {isGoogleLoading ? <Loader2 className="input-icon spin" /> : <FcGoogle className="google-logo" />}
            Login with Google
          </button>
        </div>
        <div className="form-footer">
          <p>
            Don't have account{" "}
            <Link to="/signup" className="login-link">
              Signup
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;
