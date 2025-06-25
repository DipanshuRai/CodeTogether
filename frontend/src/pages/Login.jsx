import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import "./Signup.css";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = (e) => {
    setIsLoading(true);
    e.preventDefault();
        
  };

  return (
    <div className="signup-page">
      <form onSubmit={handleSubmit} className="signup-form">
        <div className="input">
          <label className="label">Full Name</label>
          <div className="input-wrapper">
            <User className="input-icon" />
            <input
              type="text"
              value={formData.name}
              placeholder="Fullname"
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="input-container"
            />
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
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
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
          {isLoading ? <Loader2 className="input-icon spin" /> : "SignUp"}
        </button>

                <div className="form-footer">
        <p>
          Already have an account?{" "}
          <Link to="/login" className="login-link">
            Login in
          </Link>
        </p>
      </div>
      </form>
    </div>
  );
};

export default Login;
