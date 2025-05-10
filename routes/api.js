const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.send("API en funcionamiento."));

module.exports = router;
