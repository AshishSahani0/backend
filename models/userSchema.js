import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import crypto from "crypto";
// IMPORTANT: You must install bcryptjs or bcrypt
import bcrypt from "bcryptjs"; 

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      maxlength: [100, "Username cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    passwordUpdated: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["Student", "CollegePsychologist", "InstitutionAdmin", "MainAdmin"],
      default: "Student",
      required: true,
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: function () {
        return this.role !== "MainAdmin";
      },
    },
    accountVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profileImage: {
      public_id: { type: String, default: null },
      url: { type: String, default: null },
    },
    verificationCode: Number,
    verificationCodeExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Field to manage active refresh tokens for session control/revocation
    refreshTokenHash: String, 
  },
  { timestamps: true }
);

// Ensures email is unique within an institution
userSchema.index({ email: 1, institution: 1 }, { unique: true });

// -------------------- MONGOOSE HOOKS --------------------

// HASH PASSWORD BEFORE SAVING
userSchema.pre("save", async function (next) {
    // Only run this function if password was actually modified
    if (!this.isModified("password")) return next();

    // Hash the password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordUpdated = true; 
    next();
});

// -------------------- INSTANCE METHODS --------------------

// Method to compare candidate password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate 6-digit verification code
userSchema.methods.generateVerificationCode = function () {
  const code = Math.floor(100000 + Math.random() * 900000); // 6-digit code
  this.verificationCode = code;
  this.verificationCodeExpire = Date.now() + 5 * 60 * 1000; // 5 minutes validity
  return code;
};

// Generate JWT (Access Token)
userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "1h",
  });
};

// Generate JWT (Refresh Token) AND hash it for revocation
userSchema.methods.getRefreshJWTToken = function () {
  const refreshToken = jwt.sign(
    { id: this._id, role: this.role }, 
    process.env.JWT_REFRESH_SECRET, 
    {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d", 
    }
);
    
    // Hash the token itself to save a reference hash for revocation
    this.refreshTokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
    
    // NOTE: The calling controller must save the user document to persist refreshTokenHash
    
  return refreshToken;
};

// Method to verify if a refresh token belongs to this user (for revocation checks)
userSchema.methods.checkRefreshTokenHash = function (token) {
    if (!this.refreshTokenHash) return false;
    const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
    return hashedToken === this.refreshTokenHash;
};

// Generate Password Reset Token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes validity
  return resetToken;
};

const User = mongoose.model("User", userSchema);
export default User;