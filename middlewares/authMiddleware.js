import jwt from "jsonwebtoken";
import User from "../models/userSchema.js";
import dotenv from "dotenv";
dotenv.config({ quiet: true });


/**
 * Middleware to check if the user is authenticated (using Access Token)
 */
export const isAuthenticated = async (req, res, next) => {
  try {
    // ✅ 1. Try getting token from httpOnly cookie first (preferred and safer)
    let token = req.cookies?.token;

    // ✅ 2. If no token in cookie, try Authorization header (for redundancy/mobile/testing)
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // ❌ 3. No token at all
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access Denied: No access token provided. Please log in or refresh your token.",
      });
    }

    // ✅ 4. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 5. Fetch user data
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not found or account deactivated.",
      });
    }

    next();
  } catch (err) {
    console.error("isAuthenticated error:", err.message);
    
    // Explicitly return 401 when token is expired/invalid, prompting refresh logic on client
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token.",
      // Optional: Add a code to distinguish from 'Not logged in' if needed for client logic
      errorCode: "TOKEN_EXPIRED",
    });
  }
};


/**
 * Middleware to check if the authenticated user has the required role(s).
 */
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


/**
 * Middleware to authenticate using the Refresh Token (used only for the /refresh-token route)
 */
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
    // If refresh token fails, force user to log in again
    res.status(401).json({ success: false, message: "Invalid or expired refresh token. Please log in again." });
  }
};