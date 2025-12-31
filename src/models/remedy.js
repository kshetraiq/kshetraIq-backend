const mongoose = require("mongoose");
const { DISEASE_TYPES } = require("./diseaseObservation");

const RemedySchema = new mongoose.Schema(
    {
        crop: {
            type: String,
            required: true,
            enum: ["RICE", "CHILLI", "BLACKGRAM", "MAIZE"],
        },
        disease: {
            type: String,
            required: true,
            enum: DISEASE_TYPES,
        },
        naturalRemedies: [{ type: String }],
        chemicalRemedies: [{ type: String }],
    },
    { timestamps: true }
);

// Ensure one remedy document per disease
RemedySchema.index({ crop: 1, disease: 1 }, { unique: true });

const Remedy = mongoose.model("Remedy", RemedySchema);
module.exports = { Remedy };
