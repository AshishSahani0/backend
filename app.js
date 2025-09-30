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

// Socket handlers (separated)
import { setupBookedSessionSocket } from "./socket/bookedSessionSocket.js";
import { setupAnonymousSessionSocket } from "./socket/anonymousSessionSocket.js";

// Load environment variables
dotenv.config({ quiet: true });

const app = express();
const server = http.createServer(app);

// ------------------- DATABASE -------------------
connectDB();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ------------------- MIDDLEWARE -------------------

// Allow all origins
app.use(cors({
  origin: ["https://saarthi01.netlify.app"], // frontend
  credentials: true, // very important
  methods: ["GET","POST","PUT","DELETE","PATCH"],
}));


// ------------------- SOCKET.IO -------------------
const io = new Server(server, {
  cors: {
    origin:["https://saarthi01.netlify.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

// Setup separate namespaces
setupBookedSessionSocket(io);
setupAnonymousSessionSocket(io);

app.set("io", io); 

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// ------------------- EXPORT -------------------
export { app, server };
