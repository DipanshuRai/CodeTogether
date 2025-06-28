import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.log("Error in generateAccessAndRefreshToken controller: ", error);
    return res.status(500).json({ message: "Internal Server error" });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {    
    const incomingRefreshToken = req.cookies.refreshToken;

    if (!incomingRefreshToken) {
      return res.status(400).json({ message: "Unauthorized request" });
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
    } catch (err) {
      return res
        .status(400)
        .json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decodedToken._id);

    if (!user) {
      return res.status(400).json({ message: "Invalid refresh token" });
    }

    if (incomingRefreshToken !== user.refreshToken) {
      return res.status(400).json({ message: "Refresh token expired" });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, {...options, maxAge: 7 * 24 * 60 * 60 * 1000})
      .json({
        user,
        success: true,
        message: "Access token refreshed",
        accessToken,
      });

  } catch (error) {
    console.log("Error in refreshAccessToken controller: ", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const signup = async (req, res) => {
  try {    
    const { fullname, email, password } = req.body;

    if (!fullname || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be atleast 6 characters" });
    }

    const user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const newUser = await User.create({
      fullname,
      email,
      password,
    });

    if (!newUser) {
      return res.status(400).json({ message: "Registration failed" });
    }

    const {accessToken, refreshToken}=await generateAccessAndRefreshTokens(newUser._id);
    newUser.password=undefined;

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, {...options, maxAge: 7 * 24 * 60 * 60 * 1000})
      .json({
        newUser,
        success: true,
        message: "Registrated successfull",
        accessToken,
      });

  } catch (error) {
    console.log("Error in signup controller: ", error);
    res.status(500).json({message: "Internal server error"});
  }
};

export const login = async(req, res) => {
  try {
    const{email, password}=req.body;

    if(!password && !email){
        return res.status(400).json({messsage: "All fields required"});
    }

    const user=await User.findOne({email}).select("-refreshToken");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({message: "Invalid credentials"});
    }

    const {accessToken, refreshToken}=await generateAccessAndRefreshTokens(user._id);
      
    user.password=undefined;

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    };
    
    res
    .status(200)
    .cookie("accessToken", accessToken, {...options, maxAge: 15 * 60 * 1000}) // 15m
    .cookie("refreshToken", refreshToken, options)
    .json({
      success: true,
      message: "Logged in successfully",
      user,
      accessToken,
    });
  } catch (error) {
    console.log("Error in login controller: ", error);
    res.status(500).json({message: "Internal server error"});
  } 
};

export const logout = async(req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: undefined }})

    const options={
      httpOnly:true,
      secure:true,
      sameSite: "Strict",
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json({ success: true, message: "Logged out successfully" })
  } catch (error) {
    console.log("Error in logout controller: ", error);
    res.status(500).json({message: "Internal server error"});
  }
};
