const mongoose = require("mongoose");

const PlotSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    district: { type: String, required: true },  // Guntur / Krishna
    mandal: { type: String, required: true },    // Chilakaluripet / Vuyyuru
    village: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    areaAcre: { type: Number },
    crop: {
      type: String,
      enum: ["RICE", "CHILLI", "BLACKGRAM", "MAIZE"],
      default: "RICE"
    },
    variety: { type: String, required: true },
    sowingDate: { type: Date, required: true },
    irrigationType: { type: String },  // canal / bore / tank
    season: { type: String },          // Kharif / Rabi / Summer
  },
  { timestamps: true }
);

const Plot = mongoose.model("Plot", PlotSchema);
module.exports = { Plot };