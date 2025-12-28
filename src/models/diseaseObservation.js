const mongoose = require("mongoose");

const DISEASE_TYPES = [
  // Rice
  "PADDY_BLAST",
  "PADDY_BLB",
  "PADDY_SHEATH_BLIGHT",
  "PADDY_BROWN_SPOT",

  // Chilli
  "CHILLI_ANTHRACNOSE",
  "CHILLI_POWDERY_MILDEW",
  "CHILLI_THRIPS",

  // Black Gram
  "BLACKGRAM_POWDERY_MILDEW",
  "BLACKGRAM_LEAF_SPOT",
  "BLACKGRAM_YMV",

  // Maize
  "MAIZE_FAW",
  "MAIZE_LEAF_BLIGHT",
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