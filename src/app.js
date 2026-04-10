const express = require("express");
const cors = require("cors");
// const { buildCorsOptions } = require("./config/corsOptions");
const authRoutes = require("./routes/authRoutes");
const scoreRoutes = require("./routes/scoreRoutes");

function createApp() {
  const app = express();
  // const corsOptions = buildCorsOptions();

  app.use(cors());

  app.use(express.json());

  app.use("/api", authRoutes);
  app.use("/api", scoreRoutes);

  return app;
}

module.exports = {
  createApp,
};
