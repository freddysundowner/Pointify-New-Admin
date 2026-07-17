const axios = require("axios");
const { triggerSync } = require("../services/syncDebouncer");
// const syncDocumentToOnline = async function () {
//   triggerSync("global-sync", async () => {
//     try {
//       console.log("🔁 Triggering local sync: POST /api/sync");
//       await axios.post(
//         `http://${process.env.host}:${process.env.port}/api/sync?source=local`
//       );
//       console.log("✅ Local sync triggered successfully.");
//     } catch (err) {
//       console.error("❌ Failed to call /api/sync:", err.message);
//     }
//   });
// }; 
module.exports = function markUnsyncedPlugin(schema) {
  // Automatically set `sync: false` before save
  schema.pre("save", function (next) {
    this.sync = false;
    next();
  });

  // Automatically set `sync: false` before any update
  schema.pre(["updateOne", "findOneAndUpdate", "updateMany"], function (next) {
    const update = this.getUpdate();
    if (!update.$set) update.$set = {};
    update.$set.sync = false;
    next();
  });

  // schema.post("save", function (_doc, next) {
  //   syncDocumentToOnline().catch(console.error);
  //   next();
  // });

  // schema.post(["updateOne", "findOneAndUpdate"], function (_res, next) {
  //   syncDocumentToOnline().catch(console.error);
  //   next();
  // });
};

// call methods in the sync controller
