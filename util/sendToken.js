import dotenv from "dotenv";
dotenv.config({ quiet: true });

export const sendToken = async (user, statusCode, message, res) => {
  try {
    // 1. Generate both tokens. getRefreshJWTToken also sets user.refreshTokenHash.
    const token = user.getJWTToken(); // Access Token
    const refreshToken = user.getRefreshJWTToken(); // Refresh Token

    // Save the user to persist the new refreshTokenHash
    // NOTE: This must be called after getRefreshJWTToken()
    await user.save({ validateBeforeSave: false });

    const isProd = process.env.NODE_ENV === "production";
    const cookieSecure = isProd;
    const cookieSameSite = isProd ? "None" : "Lax";

    // Access Token Cookie Options (Shorter expiration)
    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || "1", 10); // Typically shorter (e.g., 1 day)
    const accessTokenOptions = {
      expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
      httpOnly: true,
      // CRITICAL: Set secure to true in production as your app is on HTTPS (Netlify)
      secure: cookieSecure, 
      // CRITICAL: Set SameSite to None in production for cross-site requests
      sameSite: cookieSameSite, 
      path: "/",
    };

    // Refresh Token Cookie Options (Longer expiration)
    const refreshCookieExpireDays = parseInt(process.env.REFRESH_COOKIE_EXPIRE || "7", 10); // Typically longer (e.g., 7 days)
    const refreshTokenOptions = {
        expires: new Date(Date.now() + refreshCookieExpireDays * 24 * 60 * 60 * 1000),
        httpOnly: true,
        // CRITICAL: Set secure to true in production
        secure: cookieSecure,
        // CRITICAL: Set SameSite to None in production
        sameSite: cookieSameSite,
        path: "/api/auth", // Set path to only refresh token endpoint for security/clarity
    };


    res
      .status(statusCode)
      .cookie("token", token, accessTokenOptions) // Set Access Token
      .cookie("refreshToken", refreshToken, refreshTokenOptions) // Set Refresh Token
      .json({
        success: true,
        message,
        token, // for interceptor (optional, but harmless)
      });
  } catch (error) {
    console.error("Error in sendToken:", error.message);
    res.status(500).json({
      success: false,
      message: "Token generation failed: " + error.message,
    });
  }
};