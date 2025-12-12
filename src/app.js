const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const routes = require("./routes");
const { errorHandler } = require("./middlewares/error");

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000", // frontend origin (no *)
    credentials: true,               // allow cookies / auth headers
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "ap-agri-guard-backend" });
});

app.use("/api", routes);



// error handler
app.use(errorHandler);

module.exports = app;