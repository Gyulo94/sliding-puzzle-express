require("dotenv").config();
const { createApp } = require("./src/app");
const { ensureSchema } = require("./src/config/database");

const PORT = process.env.PORT || 3000;
const app = createApp();

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
