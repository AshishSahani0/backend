import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/userSchema.js";

dotenv.config({ quiet: true });

const seedMainAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      dbName: process.env.DB_NAME,
    });

    const existingAdmin = await User.findOne({ role: "MainAdmin" });

    if (existingAdmin) {
      console.log("MainAdmin already exists");
      process.exit(0);
    }

    // Pre-hashed password (bcrypt hash for "123456789")
    const preHashedPassword = "$2b$12$DHVsBoQIlFPwiuLHIERJXOWvWLrdKXLfKiNErQDoQ9pwwT2FO1SWC";

    // Admin user data
    const adminData = {
      _id: new mongoose.Types.ObjectId("68b85b9c2654596fd483fafe"),
      username: "Ashish Sahani",
      email: "ashishsahani6392@gmail.com",
      password: preHashedPassword,
      passwordUpdated: true,
      role: "MainAdmin",
      accountVerified: true,
      isActive: true,
      registrationAttempts: 0,
      profileImage: {
        public_id: null,
        url: null,
      },
      createdAt: new Date("2025-09-03T15:15:40.093Z"),
      updatedAt: new Date("2025-09-19T02:05:26.999Z"),
    };

    // Insert directly to MongoDB to bypass pre-save hooks
    const result = await User.collection.insertOne(adminData);

    console.log("MainAdmin seeded with _id:", result.insertedId.toHexString());
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedMainAdmin();
