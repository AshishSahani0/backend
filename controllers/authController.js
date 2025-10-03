import User from "../models/userSchema.js";
import Institution from "../models/institutionSchema.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationCode } from "../util/sendVerificationCode.js";
import sendEmail from "../util/sendEmail.js";
import { sendToken } from "../util/sendToken.js";
import {
  generateForgotPasswordEmailTemplate,
  generateVerificationSuccessEmailTemplate,
} from "../util/emailTemplate.js";

// -------------------- REGISTER USER --------------------
export const registerUser = async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    username = username.trim();
    email = email.toLowerCase().trim();

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8-16 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    const existingVerifiedUser = await User.findOne({ email, accountVerified: true });
    if (existingVerifiedUser) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered and verified.",
      });
    }

    const emailDomain = "@" + email.split("@")[1];
    const institution = await Institution.findOne({ emailDomain });
    if (!institution) {
      return res.status(400).json({
        success: false,
        message: "Your email domain does not belong to a registered institution.",
      });
    }

    await User.deleteMany({ email, accountVerified: false });

    // NOTE: Hashing will happen via the pre('save') hook in userSchema.js
    const user = await User.create({
      username,
      email,
      password, // Pass the raw password, schema hook will hash it
      role: "Student",
      institution: institution._id,
      passwordUpdated: true, 
      accountVerified: false,
    });

    const verificationCode = user.generateVerificationCode();
    // Save user with code (validation skipped since we just created it)
    await user.save({ validateBeforeSave: false }); 

   
    sendVerificationCode(verificationCode, user.email);
    

    return res.status(201).json({
      success: true,
      message: "Registration successful. An OTP has been sent to your email for verification.",
      otpRequired: true,
      user: { email: user.email },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "An account with this email already exists for this institution." });
    }
    return res.status(500).json({ success: false, message: "Server error during registration." });
  }
};

// -------------------- VERIFY OTP --------------------
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (user.accountVerified) {
      return res.status(400).json({ success: false, message: "Account is already verified." });
    }
    if (!user.verificationCode || user.verificationCodeExpire < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP is invalid or has expired." });
    }
    if (parseInt(otp) !== user.verificationCode) {
      return res.status(400).json({ success: false, message: "Invalid OTP provided." });
    }

    user.accountVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpire = undefined;
    await user.save();

    const html = generateVerificationSuccessEmailTemplate(user.username);
    sendEmail({ to: user.email, subject: "🎉 Your SAARTHI Account is Verified!", html });

    res.status(200).json({
      success: true,
      message: "Account successfully verified. You can now log in.",
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ success: false, message: "Server error during OTP verification." });
  }
};

// -------------------- RESEND OTP --------------------
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.accountVerified) return res.status(400).json({ success: false, message: "Account is already verified." });

    const verificationCode = user.generateVerificationCode();
    await user.save({ validateBeforeSave: false });

    sendVerificationCode(verificationCode, user.email);

    res.status(200).json({
      success: true,
      message: `A new OTP has been sent to ${user.email}.`,
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
  }
};

// -------------------- LOGIN USER --------------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    // Select password explicitly
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    if (!user.accountVerified) {
      return res.status(403).json({ success: false, message: "Your account is not verified. Please check your email for an OTP." });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated." });
    }

    // Use the new method from the schema
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    
    // Generate both tokens, which will also hash and store the refresh token hash
    // sendToken handles the refresh token generation which updates user.refreshTokenHash
    sendToken(user, 200, "Login successful", res);
    
    // The user object sent to sendToken has the updated refreshTokenHash, 
    // but the actual saving logic is handled inside the sendToken utility 
    // to keep the controller cleaner, or it should be done here:
    // await user.save({ validateBeforeSave: false }); // <-- If you want to save the hash right here

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
};

// -------------------- LOGOUT USER --------------------
export const logoutUser = async (req, res) => {
  try {
    const isProd = process.env.NODE_ENV === "production";
    
    // Optional: Revoke the refresh token by clearing the hash in the database
    if (req.user && req.user._id) {
        await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: undefined }, { new: true, runValidators: false });
    }
    
    // Base options for cookie clearing
    const expiredOptions = {
        expires: new Date(0),
        httpOnly: true,
        // Ensure secure and sameSite are set for clearing in production
        secure: isProd, 
        sameSite: isProd ? "None" : "Lax",
        path: "/", // Path used for the 'token' cookie
    };
    
    // Refresh token path must match the setting path
    const refreshTokenExpiredOptions = {
        ...expiredOptions,
        path: "/api/auth", // Must match the original path set in sendToken
    };

    res.status(200)
      .cookie("token", "loggedout", expiredOptions) // Clear Access Token
      .cookie("refreshToken", "loggedout", refreshTokenExpiredOptions) // Clear Refresh Token
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ success: false, message: "Logout failed." });
  }
};


// -------------------- FORGOT PASSWORD --------------------
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase().trim(), accountVerified: true });
    if (!user) return res.status(404).json({ success: false, message: "No verified user found with this email." });

    const resetToken = user.getResetPasswordToken();
    // Save user with token
    await user.save({ validateBeforeSave: false }); 

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const html = generateForgotPasswordEmailTemplate(resetUrl);

    sendEmail({ to: user.email, subject: "🔐 SAARTHI Password Reset Request", html });

    res.status(200).json({ success: true, message: `Password reset link sent to ${user.email}.` });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    // Clear tokens on error to allow user to try again
    await User.findOneAndUpdate({ "email": req.body.email }, { resetPasswordToken: undefined, resetPasswordExpire: undefined });
    res.status(500).json({ success: false, message: "Could not send reset email. Please try again." });
  }
};

// -------------------- RESET PASSWORD --------------------
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword || password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8-16 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({ resetPasswordToken, resetPasswordExpire: { $gt: Date.now() } }).select("+password");
    if (!user) return res.status(400).json({ success: false, message: "Reset token is invalid or has expired." });

    // Use schema method for comparison
    const isSamePassword = await user.comparePassword(password);
    if (isSamePassword) return res.status(400).json({ success: false, message: "New password cannot be the same as the old one." });

    // Set raw password, pre-save hook will hash and set passwordUpdated
    user.password = password; 
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    // Save user and generate/set tokens
    sendToken(user, 200, "Password reset successfully", res);
    
    // NOTE: If sendToken only generates the hash, you must save here
    await user.save(); 
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
};

// -------------------- UPDATE PASSWORD --------------------
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ success: false, message: "All password fields are required." });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ success: false, message: "New passwords do not match." });
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8-16 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    
    // Use schema method for comparison
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ success: false, message: "Current password is incorrect." });
    
    // Set raw password, pre-save hook will hash and set passwordUpdated
    user.password = newPassword; 
    await user.save();
    
    res.status(200).json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Update Password Error:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
};

// -------------------- GET ME --------------------
export const getMe = async (req, res) => {
  try {
    const user = req.user;
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        passwordUpdated: user.passwordUpdated,
        profileImage: user.profileImage,
        institution: user.institution,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch user data." });
  }
};



export const refreshToken = async (req, res) => {
  try {
    const user = req.user; // Populated by isRefreshTokenAuthenticated middleware
    
    // Generate a new JWT access token
    const newToken = user.getJWTToken();
    
    // Get access token expiry in days for frontend cookie use
    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || "1", 10);
    
    // Set cookie options for the ACCESS TOKEN
    const cookieOptions = {
      expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
      httpOnly: true,
      // Ensure secure and sameSite are set for the new token in production
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      path: "/",
    };

    res.status(200)
      .cookie("token", newToken, cookieOptions)
      .json({
        success: true,
        message: "Token refreshed successfully.",
        token: newToken,
        // Pass the new access token expiry for frontend cookie management if needed
        expiresIn: cookieExpireDays, 
      });
  } catch (error) {
    console.error("Token Refresh Error:", error);
    res.status(500).json({ success: false, message: "Server error during token refresh." });
  }
};