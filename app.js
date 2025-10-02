import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

// Routes & DB
import connectDB from "./db/db.js";
import authRouter from "./routes/authRouter.js";
import userRouter from "./routes/userRouter.js";
import bookingRouter from "./routes/bookingRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";
import adminRouter from "./routes/adminRouter.js";
import chatRouter from "./routes/chatRoutes.js";
import anonymousChatRouter from "./routes/anonymousChatRouter.js";
import journalRouter from "./routes/journalRoutes.js";
import emergencyRouter from "./routes/emergencyRoutes.js";

// Socket handlers
import { setupBookedSessionSocket } from "./socket/bookedSessionSocket.js";
import { setupAnonymousSessionSocket } from "./socket/anonymousSessionSocket.js";

dotenv.config({ quiet: true });

const app = express();
const server = http.createServer(app);

// ------------------- DATABASE -------------------
connectDB();

// ------------------- MIDDLEWARE -------------------
const ALLOWED_ORIGINS = [
    "https://saarthi01.netlify.app", // Your deployed production URL
    "http://localhost:5173",          // Your local development URL
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true); 

        // Check if the origin is in our allowed list
        if (ALLOWED_ORIGINS.includes(origin) || origin === process.env.FRONTEND_URL) {
            callback(null, true);
        } else {
            console.log(`❌ CORS Blocked: Origin ${origin} not allowed`);
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true, // allow cookies
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------- SOCKET.IO -------------------
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

// Setup separate namespaces
setupBookedSessionSocket(io);
setupAnonymousSessionSocket(io);

app.set("io", io);

// ------------------- API ROUTES -------------------
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/chat", chatRouter);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/admin", adminRouter);
app.use("/api/anonymous-chat", anonymousChatRouter);
app.use("/api/journal", journalRouter);
app.use("/api/emergency", emergencyRouter);

// ------------------- HEALTH CHECK -------------------
app.get("/", (req, res) => {
  res.status(200).json({ message: "Server is running!" });
});

// ------------------- ERROR HANDLER -------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export { app, server };
