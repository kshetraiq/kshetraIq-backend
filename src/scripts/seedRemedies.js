require("dotenv").config({ path: "../../.env" }); // Adjust path if running from src/scripts
const mongoose = require("mongoose");
const { Remedy } = require("../models/remedy");
const { DISEASE_TYPES } = require("../models/diseaseObservation");

// Helper to reliably connect if running standalone
const connectDB = async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect("mongodb+srv://kshetraiq_db_user:uf7qQEEk8XdOtHng@cluster0.czjs4ic.mongodb.net/"); // Fallback for local
        console.log("MongoDB Connected");
    }
};

const SEED_DATA = [
    // --- RICE ---
    {
        crop: "RICE",
        disease: "PADDY_BLAST",
        naturalRemedies: [
            "Avoid excess nitrogen fertilizer application.",
            "Use resistant varieties available in your region.",
            "Spray Pseudomonas fluorescens @ 10g/liter of water.",
        ],
        chemicalRemedies: [
            "Spray Tricyclazole 75 WP @ 0.6g/liter.",
            "Isoprothiolane 40 EC @ 1.5ml/liter.",
            "Kasugamycin 3 SL @ 2.5 ml/liter.",
        ],
    },
    {
        crop: "RICE",
        disease: "PADDY_BLB",
        naturalRemedies: [
            "Ensure proper drainage of the field.",
            "Avoid clipping of leaf tips during transplanting.",
            "Apply fresh cow dung slurry (20%) to control initial spread.",
        ],
        chemicalRemedies: [
            "Streptocycline 1g + Copper Oxychloride 30g in 10 liters of water.",
            "Spray Plantomycin @ 1g/liter.",
        ],
    },
    {
        crop: "RICE",
        disease: "PADDY_SHEATH_BLIGHT",
        naturalRemedies: [
            "Apply Trichoderma viride @ 5g/liter.",
            "Maintain proper spacing to reduce humidity in the canopy.",
        ],
        chemicalRemedies: [
            "Spray Hexaconazole 5 EC @ 2ml/liter.",
            "Propiconazole 25 EC @ 1ml/liter.",
            "Validamycin 3L @ 2ml/liter.",
        ],
    },
    {
        crop: "RICE",
        disease: "PADDY_BROWN_SPOT",
        naturalRemedies: [
            "Apply targeted split doses of Nitrogen.",
            "Treat seeds with Trichoderma viride before sowing.",
        ],
        chemicalRemedies: [
            "Spray Mancozeb @ 2.5g/liter.",
            "Edifenphos 50 EC @ 1ml/liter.",
        ],
    },

    // --- CHILLI ---
    {
        crop: "CHILLI",
        disease: "CHILLI_ANTHRACNOSE",
        naturalRemedies: [
            "Remove and destroy infected fruits.",
            "Seed treatment with Pseudomonas fluorescens @ 10g/kg.",
        ],
        chemicalRemedies: [
            "Spray Propiconazole @ 1ml/liter.",
            "Azoxystrobin @ 1ml/liter.",
            "Wettable Sulphur @ 3g/liter.",
        ],
    },
    {
        crop: "CHILLI",
        disease: "CHILLI_POWDERY_MILDEW",
        naturalRemedies: [
            "Spray Wettable Sulphur @ 3g/liter.",
            "Ensure good air circulation in the field.",
        ],
        chemicalRemedies: [
            "Spray Hexaconazole @ 2ml/liter.",
            "Dinocap @ 1ml/liter.",
        ],
    },
    {
        crop: "CHILLI",
        disease: "CHILLI_THRIPS",
        naturalRemedies: [
            "Install blue sticky traps @ 50/acre.",
            "Spray Neem oil 10000 ppm @ 1ml/liter.",
        ],
        chemicalRemedies: [
            "Spray Fipronil @ 2ml/liter.",
            "Imidacloprid @ 0.5ml/liter.",
            "Spinosad @ 0.3ml/liter.",
        ],
    },

    // --- BLACKGRAM ---
    {
        crop: "BLACKGRAM",
        disease: "BLACKGRAM_POWDERY_MILDEW",
        naturalRemedies: [
            "Use resistant varieties.",
            "Spray 5% NSKE (Neem Seed Kernel Extract).",
        ],
        chemicalRemedies: [
            "Spray Wettable Sulphur @ 3g/liter.",
            "Carbendazim @ 1g/liter.",
        ],
    },
    {
        crop: "BLACKGRAM",
        disease: "BLACKGRAM_LEAF_SPOT",
        naturalRemedies: [
            "Remove infected plant debris.",
            "Seed treatment with Trichoderma.",
        ],
        chemicalRemedies: [
            "Spray Mancozeb @ 2.5g/liter.",
            "Chlorothalonil @ 2g/liter.",
        ],
    },
    {
        crop: "BLACKGRAM",
        disease: "BLACKGRAM_YMV",
        naturalRemedies: [
            "Install yellow sticky traps to control whitefly vector.",
            "Remove infected plants immediately (roguing).",
        ],
        chemicalRemedies: [
            "Spray Dimethoate @ 2ml/liter to control vector.",
            "Acetamiprid @ 0.2g/liter.",
        ],
    },

    // --- MAIZE ---
    {
        crop: "MAIZE",
        disease: "MAIZE_FAW",
        naturalRemedies: [
            "Install pheromone traps @ 10/acre.",
            "Apply dilute sand/lime in whorls.",
        ],
        chemicalRemedies: [
            "Spray Emamectin Benzoate @ 0.4g/liter.",
            "Spinetoram @ 0.5ml/liter.",
        ],
    },
    {
        crop: "MAIZE",
        disease: "MAIZE_LEAF_BLIGHT",
        naturalRemedies: [
            "Use resistant hybrids.",
            "Crop rotation with non-host crops.",
        ],
        chemicalRemedies: [
            "Spray Mancozeb @ 2.5g/liter.",
            "Azoxystrobin @ 1ml/liter.",
        ],
    },
];

const seedRemedies = async () => {
    await connectDB();
    console.log("🌱 Seeding Remedies...");

    for (const data of SEED_DATA) {
        // Only update if disease is valid in our system
        if (!DISEASE_TYPES.includes(data.disease)) {
            console.warn(`⚠️ Skipping unknown disease: ${data.disease}`);
            continue;
        }

        await Remedy.findOneAndUpdate(
            { crop: data.crop, disease: data.disease },
            data,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`✅ Seeded/Updated: ${data.disease}`);
    }

    console.log("🏁 Remedy Seeding Complete.");
    // process.exit(0); // Uncomment if running standalone
};

// Export for use or run if main module
if (require.main === module) {
    seedRemedies().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { seedRemedies };
