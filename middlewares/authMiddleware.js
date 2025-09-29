import jwt from "jsonwebtoken";
import User from "../models/userSchema.js";
import dotenv from "dotenv";
dotenv.config({ quiet: true });



export const isAuthenticated = async (req, res, next) => {
  try {
    // ✅ Get token from cookie or Authorization header
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // ❌ No token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not logged in",
      });
    }

    // ✅ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Attach user to request
    req.user = await User.findById(decoded.id).select("-password");

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};



export const isAuthorized = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user?.role}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};

export const isStudent = (req, res, next) => {
  if (req.user.role !== "Student") {
    return res.status(403).json({ success: false, message: "Access denied: Only for students" });
  }
  next();
};

export const isCollegePsychologist = (req, res, next) => {
  if (req.user.role !== "CollegePsychologist") {
    return res.status(403).json({ success: false, message: "Access denied: Only for psychologists" });
  }
  next();
};



export const isRefreshTokenAuthenticated = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "No refresh token provided." });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Invalid refresh token or user is inactive." });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid or expired refresh token." });
  }
};
