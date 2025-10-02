// After (sendToken.js) - Use Lax for the Access Token
import dotenv from "dotenv";
dotenv.config({ quiet: true });

export const sendToken = async (user, statusCode, message, res) => {
    try {
        const token = user.getJWTToken(); // Access Token
        const refreshToken = user.getRefreshJWTToken(); // Refresh Token

        await user.save({ validateBeforeSave: false });

        const isProd = process.env.NODE_ENV === "production";
        
        // 1. SameSite for ACCESS Token (set to Lax for better Chrome compatibility)
        const accessTokenSameSite = isProd ? "Lax" : "Lax"; // <-- CHANGED from "None"
        
        // 2. SameSite for REFRESH Token (keep None as it's only used by the server)
        const refreshTokenSameSite = isProd ? "None" : "Lax";
        
        const cookieSecure = isProd;

        // Access Token Cookie Options (Shorter expiration)
        const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || "1", 10);
        const accessTokenOptions = {
            expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
            httpOnly: false, // <-- Change to FALSE, as you are reading this on the client (via js-cookie)
            secure: cookieSecure, 
            sameSite: accessTokenSameSite, // <-- NOW LAX
            path: "/",
        };

        // Refresh Token Cookie Options (Longer expiration)
        const refreshCookieExpireDays = parseInt(process.env.REFRESH_COOKIE_EXPIRE || "7", 10);
        const refreshTokenOptions = {
            expires: new Date(Date.now() + refreshCookieExpireDays * 24 * 60 * 60 * 1000),
            httpOnly: true, // <-- MUST be true for security
            secure: cookieSecure,
            sameSite: refreshTokenSameSite, // <-- Keep as None for cross-site refresh logic
            path: "/api/auth", 
        };

        res
            .status(statusCode)
            .cookie("token", token, accessTokenOptions) // Set Access Token (Lax, not httpOnly)
            .cookie("refreshToken", refreshToken, refreshTokenOptions) // Set Refresh Token (None, httpOnly)
            .json({
                success: true,
                message,
                token, // Pass the token in the body for the client to store/use immediately
            });
    } catch (error) {
        console.error("Error in sendToken:", error.message);
        res.status(500).json({
            success: false,
            message: "Token generation failed: " + error.message,
        });
    }
};