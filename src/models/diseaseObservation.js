const mongoose = require("mongoose");

const DISEASE_TYPES = [
  "PADDY_BLAST",
  "PADDY_BLB",
  "PADDY_SHEATH_BLIGHT",
  "PADDY_BROWN_SPOT",
];

const DiseaseObservationSchema = new mongoose.Schema(
  {
    plot: { type: mongoose.Schema.Types.ObjectId, ref: "Plot", required: true },
    observer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    observationDate: { type: Date, required: true },
    cropStage: { type: String, required: true },
    variety: { type: String, required: true },
    season: { type: String },
    nitrogenLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
    lastFungicideDate: { type: Date },
    diseases: [
      {
        type: { type: String, enum: DISEASE_TYPES, required: true },
        present: { type: Boolean, required: true },
        severityScore: { type: Number },   // IRRI 0–9
        severityPercent: { type: Number }, // % leaf area
      },
    ],
    photos: [{ type: String }], // URLs later from Cloudinary
  },
  { timestamps: true }
);

const DiseaseObservation = mongoose.model(
  "DiseaseObservation",
  DiseaseObservationSchema
);

module.exports = { DiseaseObservation, DISEASE_TYPES };