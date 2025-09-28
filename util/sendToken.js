import dotenv from "dotenv";
dotenv.config({ quiet: true });

export const sendToken = (user, statusCode, message, res) => {
  try {
    const token = user.getJWTToken();
    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || "7", 10);

    const cookieOptions = {
      expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",  // must be true in prod
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // 'None' allows cross-site cookies
      path: "/",
    };

    res
      .status(statusCode)
      .cookie("token", token, cookieOptions)
      .json({ 
        success: true, 
        message, 
        token // send token in response body too for header-based requests if needed
      });
  } catch (error) {
    console.error("Error in sendToken:", error.message);
    res.status(500).json({
      success: false,
      message: "Token generation failed: " + error.message,
    });
  }
};
