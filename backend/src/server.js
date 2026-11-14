const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Nova Clinic OS API is running",
  });
});

app.listen(PORT, () => {
  console.log(`Nova Clinic OS API running on port ${PORT}`);
});