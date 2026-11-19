import "dotenv/config";
import app from "./app";
import connectDB from "./config/database";
import mongoose from "mongoose";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`REALITY DREAMS API running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
    });

    // Graceful shutdown handling for cloud orchestrators (Docker, Kubernetes, Render, Railway, AWS)
    const handleShutdown = (signal: string) => {
      console.log(`\nReceived ${signal}. Gracefully closing HTTP server and database connections...`);
      server.close(async () => {
        try {
          await mongoose.disconnect();
          console.log("MongoDB connection closed cleanly.");
          process.exit(0);
        } catch (dbErr) {
          console.error("Error during MongoDB disconnection:", dbErr);
          process.exit(1);
        }
      });
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
  } catch (error) {
    console.error("Fatal startup error:", error);
    process.exit(1);
  }
};

startServer();
