const express = require("express");
const scoreController = require("../controllers/scoreController");

const router = express.Router();

router.post("/scores", scoreController.createScore);
router.get("/scores", scoreController.getScores);

module.exports = router;
