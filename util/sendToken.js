import dotenv from "dotenv";
dotenv.config({ quiet: true });

export const sendToken = (user, statusCode, message, res) => {
  try {
    const token = user.getJWTToken();
    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || "7", 10);

    const isProd = process.env.NODE_ENV === "production";

    const cookieOptions = {
      expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: isProd,? "None" : "Lax",           // Only true in production
      sameSite: isProd ? "None" : "Lax", // Lax for local dev
      path: "/",
    };

    res
      .status(statusCode)
      .cookie("token", token, cookieOptions)
      .json({
        success: true,
        message,
        token, // optional: for header-based requests
      });
  } catch (error) {
    console.error("Error in sendToken:", error.message);
    res.status(500).json({
      success: false,
      message: "Token generation failed: " + error.message,
    });
  }
};

