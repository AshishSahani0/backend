import { server } from "./app.js"; // Named import
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const PORT = process.env.PORT || 5000;

// Start the HTTP server (required for Socket.io)
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
