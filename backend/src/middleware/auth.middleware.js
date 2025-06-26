import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const verifyJWT = async (req, res, next) => {
  try {
    const accesstoken =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer", "");

    if (!accesstoken) {
      return res.status(401).json({message: "Unauthorized: No token provided"});
    }

    const decodedToken = jwt.verify(accesstoken, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

    if (!user) {
      return res.status(401).json({message: "User not found"});
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("Error in verifyJWT middleware: ", error);
    res.status(500).json({message: "Internal server error"});
  }
};
