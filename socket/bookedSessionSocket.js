// server side

import Message from "../models/messageSchema.js";
import User from "../models/userSchema.js";
import mongoose from "mongoose";

let onlineBookedUsers = 0;
const bookedUserSocketMap = new Map(); // userId → socketId

export const setupBookedSessionSocket = (io) => {
  const bookedNamespace = io.of("/booked");

  bookedNamespace.on("connection", (socket) => {
    onlineBookedUsers++;
    bookedNamespace.emit("updateOnlineUsers", { count: onlineBookedUsers });

    // Identify user and map
    socket.on("identify", ({ userId, role }) => {
      if (userId) {
        socket.userId = userId;
        bookedUserSocketMap.set(userId, socket.id);
        console.log(`User identified: ${userId} → ${socket.id}`);
      }
      if (role === "CollegePsychologist") {
        socket.join("psychologists");
      }
    });

    // Join chat room
    socket.on("joinRoom", ({ roomId, user, bookingId }) => {
      socket.join(roomId);
    });

    // Typing events
    socket.on("typing", ({ roomId, user }) => {
      socket.to(roomId).emit("userTyping", { userId: user._id });
    });
    socket.on("stopTyping", ({ roomId, userId }) => {
      socket.to(roomId).emit("userStopTyping", { userId });
    });

    // Chat messages
    socket.on(
      "sendMessage",
      async ({ roomId, sender, text, bookingId, fileUrl, fileType, isAnonymous }) => {
        if (!sender?._id || !mongoose.Types.ObjectId.isValid(sender._id)) return;
        const senderToSave = isAnonymous ? null : sender._id;

        const newMsg = new Message({
          roomId,
          sender: senderToSave,
          text: text || "",
          booking: bookingId,
          fileUrl: fileUrl || null,
          fileType: fileType || null,
        });
        await newMsg.save();

        let populatedMessage;
        if (isAnonymous) {
          const userDoc = await User.findById(sender._id);
          populatedMessage = {
            ...newMsg.toObject(),
            sender: {
              _id: userDoc._id,
              username: userDoc.username,
              profileImage: userDoc.profileImage || null,
            },
          };
        } else {
          populatedMessage = await newMsg.populate("sender", "username profileImage");
        }

        bookedNamespace.to(roomId).emit("newMessage", populatedMessage);
      }
    );

    // ---- Video call signaling ----

    socket.on("callUser", ({ userToCall, signalData, from, bookingId }) => {
      const targetSocketId = bookedUserSocketMap.get(userToCall);
      if (targetSocketId) {
        bookedNamespace.to(targetSocketId).emit("callOffer", signalData, from, bookingId);
        console.log(`callOffer: from ${from} → user ${userToCall}`);
      }
    });

    socket.on("acceptCall", ({ to, signal }) => {
      const targetSocketId = bookedUserSocketMap.get(to);
      if (targetSocketId) {
        bookedNamespace.to(targetSocketId).emit("callAnswer", signal);
        console.log(`callAnswer emitted to ${to}`);
      }
    });

    socket.on("iceCandidate", ({ to, candidate }) => {
      const targetSocketId = bookedUserSocketMap.get(to);
      if (targetSocketId) {
        bookedNamespace.to(targetSocketId).emit("iceCandidate", candidate);
        // Optional logging
        // console.log(`iceCandidate forwarded to ${to}`);
      }
    });

    socket.on("callEnded", ({ to }) => {
      const targetSocketId = bookedUserSocketMap.get(to);
      if (targetSocketId) {
        bookedNamespace.to(targetSocketId).emit("callEnded");
        console.log(`callEnded emitted to ${to}`);
      }
    });

    // Disconnect cleanup
    socket.on("disconnect", () => {
      onlineBookedUsers--;
      bookedNamespace.emit("updateOnlineUsers", { count: onlineBookedUsers });

      if (socket.userId) {
        bookedUserSocketMap.delete(socket.userId);
        console.log(`User disconnected: ${socket.userId}`);
      }
    });
  });
};
