const mongoose = require("mongoose");
const { DISEASE_TYPES } = require("./diseaseObservation");

const AdvisorySchema = new mongoose.Schema(
  {
    plot: { type: mongoose.Schema.Types.ObjectId, ref: "Plot", required: true },
    disease: { type: String, enum: DISEASE_TYPES, required: true },
    riskSeverity: { type: String, enum: ["GREEN", "ORANGE", "RED"], required: true },
    date: { type: Date, required: true },
    title: { type: String, required: true },
    messageEn: { type: String, required: true },
    messageTe: { type: String },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    source: {
      type: String,
      enum: ["TEMPLATE_RULE", "OFFICER", "SYSTEM"],
      default: "TEMPLATE_RULE",
    },
  },
  { timestamps: true }
);

const Advisory = mongoose.model("Advisory", AdvisorySchema);
module.exports = { Advisory };