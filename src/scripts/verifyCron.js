require("dotenv").config({ path: "../../.env" });
const { triggerRiskRecompute } = require("../controllers/cronController");

// Mock Express Objects
const req = {
    query: {
        key: process.env.CRON_SECRET,
        daysWindow: "7",
        mode: "FORECAST"
    },
    headers: {}
};

const res = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        console.log(`[Response ${this.statusCode}]`, data);
    }
};

const next = (err) => console.error("Next called with error:", err);

async function testCron() {
    console.log("🧪 Testing Trigger Risk Recompute...");
    console.log("Secret used:", process.env.CRON_SECRET);

    const start = Date.now();
    await triggerRiskRecompute(req, res, next);
    const end = Date.now();

    console.log(`⏱️ Execution Time: ${end - start}ms (Should be very fast, <50ms)`);

    if (res.statusCode === 202) {
        console.log("✅ SUCCESS: Controller returned 202 Accepted immediately.");
    } else {
        console.error("❌ FAILURE: Controller did not return 202.");
    }

    // We won't see the background log immediately unless we wait, but the test is for the API response.
    // To verify background work, we'd need to mock the service or keep the process alive.
    console.log("Waiting 2 seconds to see if background logs appear...");
    await new Promise(r => setTimeout(r, 2000));
    process.exit(0);
}

testCron();
