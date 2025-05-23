const express = require("express");
const router = express.Router();
const uploadMiddleware = require('../middleware/uploadMiddleware');
const uploadController = require('../controllers/uploadController');

router.get("/", (req, res) => res.send("API en funcionamiento."));
router.post('/upload-inventory', uploadMiddleware.single('file'), uploadController.uploadFile);
router.get('')

module.exports = router;
