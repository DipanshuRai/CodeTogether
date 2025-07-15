import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { FaCode } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthProvider";
import { axiosPrivate } from "../api/axios";
import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
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
      toast.error("Both email and password are required.");
      setIsLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Invalid email format.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axiosPrivate.post("/api/auth/login", formData);
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

  const handleGoogleLoginSuccess = async (tokenResponse) => {
    setIsGoogleLoading(true);
    try {
      const googleUser = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }
      );

      const { data } = await axiosPrivate.post("/api/auth/google-login", {
        email: googleUser.data.email,
        fullname: googleUser.data.name,
        avatar: googleUser.data.picture,
      });

      const { accessToken, user } = data;
      setAuth({ accessToken, user });
      toast.success(data.message || "Login successful!");
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error("Google login failed. Please try again.");
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
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="header">
          <Link to="/" className="logo-container">
            <FaCode className="logo-icon" />
          </Link>
          <div className="title">
            <div className="title1">Code</div>
            <div className="title2">Together</div>
          </div>
          <p className="subtitle">Welcome back! Please log in to your account.</p>
        </div>

        <div className="input-group">
          <label className="label">Email</label>
          <div className="input-wrapper">
            <Mail className="input-icon" />
            <input
              type="email"
              value={formData.email}
              placeholder="e.g. dipanshu@example.com"
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="input-field"
            />
          </div>
        </div>

        <div className="input-group">
          <label className="label">Password</label>
          <div className="input-wrapper">
            <Lock className="input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              placeholder="Enter your password"
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="input-field"
            />
            <button
              type="button"
              className="eye-btn"
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

        <button
          type="submit"
          className="submit-btn"
          disabled={isLoading || isGoogleLoading}
        >
          {isLoading ? <Loader2 className="spinner-icon" /> : "Log In"}
        </button>

        <div className="separator1">
          <div className="line"></div>
          <span>OR</span>
          <div className="line"></div>
        </div>

        <button
          type="button"
          className="google-btn"
          onClick={() => googleLogin()}
          disabled={isLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className="spinner-icon" />
          ) : (
            <FcGoogle className="google-icon" />
          )}
          Log in with Google
        </button>

        <div className="form-footer">
          <p>
            Don't have an account?{" "}
            <Link to="/signup" className="footer-link">
              Sign Up
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;