const mongoose = require("mongoose");
const { EJSON, ObjectId } = require("bson");

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const Shop = require("../models/shop");
const axios = require("axios");
const { triggerSync } = require("../services/syncDebouncer");

const syncDocumentToOnline = async function () {
  triggerSync("global-sync", async () => {
    try {
      console.log("🔁 Triggering local sync: POST /api/sync");
      await axios.post(
        `http://${process.server.host}:${process.server.port}/api/sync?source=local`
      );
      console.log("✅ Local sync triggered successfully.");
    } catch (err) {
      console.error("❌ Failed to call /api/sync:", err.message);
    }
  });
};

const checkUpdate = async (req, res) => {
  console.log();
  const userAgent = req.headers["user-agent"];
  const currentVersion = userAgent.split("/")[1]; // Extract version from User-Agent

  // Your latest version info
  const latestVersion = {
    version: "1.0.8",
    releaseNotes: "🎉 New Features:\n• Improved performance\n• Bug fixes\n• Better offline sync\n• Enhanced security",
    releaseNotesUrl: "https://pointifypos.com/desktop/changelog",
    downloadUrl: {
      win32: "https://pointifypos.com/installers/Pointify POS Setup 1.0.0.exe",
      darwin: "https://pointifypos.com/pointify.dmg"
    },
    mandatory: true,
    minimumVersion: "1.0.0",
    releaseDate: "2025-07-25T10:00:00Z"
  };

  // Determine platform-specific download URL
  const platform = req.query.platform || "win32";
  const downloadUrl = latestVersion.downloadUrl[platform];

  // Check if update is available
  const needsUpdate =
    compareVersions(latestVersion.version, currentVersion) > 0;

  if (needsUpdate) {
    res.json({
      version: latestVersion.version,
      releaseNotes: latestVersion.releaseNotes,
      releaseNotesUrl: latestVersion.releaseNotesUrl,
      downloadUrl: downloadUrl,
      mandatory: latestVersion.mandatory,
      minimumVersion: latestVersion.minimumVersion,
      releaseDate: latestVersion.releaseDate,
    });
  } else {
    // No update available
    res.status(204).send(); // No Content
  }
};

function compareVersions(newVersion, currentVersion) {
  const parseVersion = (version) => {
    return version.split(".").map((num) => parseInt(num, 10));
  };

  const newVer = parseVersion(newVersion);
  const curVer = parseVersion(currentVersion);

  for (let i = 0; i < Math.max(newVer.length, curVer.length); i++) {
    const newNum = newVer[i] || 0;
    const curNum = curVer[i] || 0;

    if (newNum > curNum) return 1;
    if (newNum < curNum) return -1;
  }

  return 0;
}

function getExportDir(source) {
  if (source === "local") {
    // Use Electron's userData directory instead of snapshot location
    const userDataDir = process.env.POINTIFY_USER_DATA_DIR;
    if (userDataDir) {
      return path.join(userDataDir, "local_dumps");
    }
    // Fallback for development
    return path.join(__dirname, "../../local_dumps");
  } else {
    return path.join(__dirname, "../../../../pointify/website/exports");
  }
}
const initDatabase = async (req, res) => {
  let { source } = req.query;
  try {
    const payload = {};
    const recordCounts = {};

    const collection = mongoose.connection.db.collection("shopcategories");

    const docs = await collection.find().toArray();
    if (docs.length > 0) {
      payload["shopcategories"] = docs;
      recordCounts["shopcategories"] = docs.length;

      // mark as synced
      const ids = docs.map((doc) => doc._id);
      await collection.updateMany(
        { _id: { $in: ids } },
        { $set: { sync: true } }
      );
    }

    const exportDir = getExportDir(source);

    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    let fileName = `dump-shopcategories-${Date.now()}.json.gz`;

    if (docs.length === 0) {
      // Check for existing files
      const files = fs
        .readdirSync(exportDir)
        .filter(
          (f) => f.startsWith(`dump-shopcategories-`) && f.endsWith(".json.gz")
        )
        .map((f) => ({
          name: f,
          time: parseInt(
            f.split(`dump-shopcategories-`)[1].split(".json.gz")[0]
          ),
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 0) {
        const latestFile = files[0];
        return res.json({
          status: "success",
          message: "No new data found, serving the latest existing dump file.",
          fileName: latestFile.name,
          downloadUrl:
            source === "local"
              ? `${exportDir}/${latestFile.name}`
              : `https://pointifypos.com/exports/${latestFile.name}`,
          recordCounts: {},
          latestSyncTime: new Date(latestFile.time),
        });
      }

      return res.json({
        status: "empty",
        message: "No data found for shopcategories.",
        recordCounts: {},
        latestSyncTime: now,
      });
    }

    // Build and write payload
    const exportPayload = {
      meta: {
        recordCounts,
      },
      data: payload,
    };

    const gzipFilePath = path.join(exportDir, fileName);
    const jsonBuffer = Buffer.from(EJSON.stringify(exportPayload, null, 2));
    const gzipped = zlib.gzipSync(jsonBuffer);
    fs.writeFileSync(gzipFilePath, gzipped);

    console.log(`✅ Dump written to ${gzipFilePath}`);

    res.json({
      status: "success",
      message: "Compressed shopcategories dump created",
      fileName,
      downloadUrl:
        source === "local"
          ? `${exportDir}/${fileName}`
          : `https://pointifypos.com/exports/${fileName}`,
      recordCounts,
    });
  } catch (err) {
    console.error("❌ Error:", err.stack || err);
    res.status(500).send(`Server error: ${err.message}`);
  }
};

const cleanUpFiles = (req, res) => {
  let { fileName } = req.body;
  console.log(req.body);
  let pathh = path.join(
    __dirname,
    "../../../../pointify/website/exports/" + fileName
  );
  if (fileName) {
    fs.unlink(pathh, (err) => {
      if (err) {
        console.log(err);
      }
    });
  }
  res.json({ status: true });
};
// --------------------
// GET DUMP CONTROLLER
// --------------------
const getDump = async (req, res) => {
  const userId = req.params.id; // user id
  const { source,  force = 'false' } = req.query;
  console.log(req.query)

  if (!userId) return res.status(400).send("Missing userId");

  const userObjectId = new ObjectId(userId);

  // find shops owned by this admin
  const adminShops = await Shop.find(
    { adminId: userObjectId },
    { _id: 1 }
  ).lean();
  const adminShopIds = adminShops.map((s) => s._id);
  console.log(adminShopIds);

  const since = req.query.since ? new Date(req.query.since) : null;
  const now = new Date();

  try {
    const collectionsInfo = await mongoose.connection.db
      .listCollections()
      .toArray();
    const payload = {};
    const recordCounts = {};

    for (let coll of collectionsInfo) {
      const collName = coll.name;
      const collection = mongoose.connection.db.collection(collName);
      // let filter = {};
      if (
        adminShopIds.length === 0 &&
        [
          "activities",
          "adjustments",
          "awards",
          "banks",
          "inventories",
          "orders",
          "purchaseitems",
          "attendants",
          "badstocks",
          "cashflows",
          "cashflowcategories",
          "stockcounts",
          "customers",
          "expensecategories",
          "expenses",
          "userpayments",
          "products",
          "purchases",
          "purchasereturns",
          "saleitems",
          "salereturns",
          "sales",
          "suppliers",
          "producttransfers",
          "stockrequests",
        ].includes(collName)
      ) {
        continue; // 🚫 skip any shop/shopId dependent collections if no shops
      }

      let filter = {};
      if (
        [
          "activities",
          "adjustments",
          "awards",
          "banks",
          "inventories",
          "orders",
          "purchaseitems",
        ].includes(collName)
      ) {
        filter = { shop: { $in: adminShopIds } };
      } else if (["stockrequests"].includes(collName)) {
        filter = {
          $or: [
            { fromShop: { $in: adminShopIds } },
            { warehouse: { $in: adminShopIds } },
          ],
        };
      } else if (
        [
          // "attendants",
          "badstocks",
          "cashflows",
          "cashflowcategories",
          "stockcounts",
          "customers",
          "expensecategories",
          "expenses",
          "userpayments",
          "products",
          "purchases",
          "purchasereturns",
          "saleitems",
          "salereturns",
          "sales",
          "suppliers",
        ].includes(collName)
      ) {
        filter = { shopId: { $in: adminShopIds } };
      } else if (["producttransfers"].includes(collName)) {
        // filter = { $or: [{ fromShopId: { $in: adminShopIds } }, { toShopId: { $in: adminShopIds } }] };
        filter = {
          $and: [
            {
              $or: [
                { fromShopId: { $in: adminShopIds } },
                { toShopId: { $in: adminShopIds } },
              ],
            },
          ],
        };

        // Apply sync filter only when force is false
        if (force =='false') {
          filter.$and.push({
            $or: [{ sync: false }, { sync: { $exists: false } }],
          });
        }
      } else if (["admins"].includes(collName)) {
        filter = { _id: userObjectId };
      } else if (["productcategories"].includes(collName)) {
        filter = { admin: userObjectId };
      } else if (["shops", "attendants"].includes(collName)) {
        filter = { adminId: userObjectId };
      } else if (["subscriptions"].includes(collName)) {
        filter = { userId: userObjectId };
      } else if (["transactions"].includes(collName)) {
        filter = { user: userObjectId };
      } else if (
        ["measures", "packages", "shopcategories"].includes(collName)
      ) {
        if (force =='false') {
          filter = { $or: [{ sync: false }, { sync: { $exists: false } }] };
        }
      } else {
        continue;
      }

      // incremental since
      if (since) {
        const dateFieldMap = {
          products: "date",
          inventory: "date",
          shops: "createdAt",
          subscriptions: "createdAt",
          stockrequest: "createdAt",
        };
        const dateField = dateFieldMap[collName] || "createdAt";
        filter[dateField] = { $gte: since };
      }

      // always add sync filter
      if (force =='false') {
        filter.$or = [{ sync: false }, { sync: { $exists: false } }];
      }
      if ("settings" === collName) {
        filter = {};
      }
      // console.log(filter)
      const docs = await collection.find(filter).toArray();
      if (collName === "orderitems") {
        const neededProductIds = docs.map((doc) => doc.product).filter(Boolean);
        if (neededProductIds.length) {
          const missingProducts = await mongoose.connection.db
            .collection("products")
            .find({ _id: { $in: neededProductIds } })
            .toArray();
          if (missingProducts.length) {
            if (!payload["products"]) payload["products"] = [];
            payload["products"].push(...missingProducts);
            recordCounts["products"] =
              (recordCounts["products"] || 0) + missingProducts.length;
          }
        }
      }

      if (collName === "bundleitems") {
        const neededInventoryIds = docs.map((doc) => doc.item).filter(Boolean);
        console.log("neededInventoryIds ", neededInventoryIds);
        if (neededInventoryIds.length) {
          const allRelatedInventory = await mongoose.connection.db
            .collection("inventory")
            .find({ _id: { $in: neededInventoryIds } })
            .toArray();

          if (allRelatedInventory.length) {
            if (!payload["inventory"]) payload["inventory"] = [];
            payload["inventory"].push(...allRelatedInventory);
            recordCounts["inventory"] =
              (recordCounts["inventory"] || 0) + allRelatedInventory.length;
          }
        }
      }

      if (docs.length > 0) {
        payload[collName] = docs;
        recordCounts[collName] = docs.length;

        // mark as synced
        if (force =='false') {
          const ids = docs.map((doc) => doc._id);
          await collection.updateMany(
            { _id: { $in: ids } },
            { $set: { sync: true } }
          );
        }
      }
    }

    const exportDir = getExportDir(source);
    console.log("exportDir ", exportDir);
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    let fileName = `dump-${userId}-${Date.now()}.json.gz`;
    if (Object.keys(payload).length === 0) {
      if (fs.existsSync(exportDir)) {
        const files = fs
          .readdirSync(exportDir)
          .filter(
            (f) => f.startsWith(`dump-${userId}-`) && f.endsWith(".json.gz")
          )
          .map((f) => ({
            name: f,
            time: parseInt(f.split(`dump-${userId}-`)[1].split(".json.gz")[0]),
          }))
          .sort((a, b) => b.time - a.time); // latest first

        if (files.length > 0) {
          const latestFile = files[0];
          return res.json({
            status: "success",
            message:
              "No new data found, serving the latest existing dump file.",
            fileName: latestFile.name,
            downloadUrl:
              source === "local"
                ? `${exportDir}/${latestFile.name}`
                : `https://pointifypos.com/exports/${latestFile.name}`,
            recordCounts: {},
            latestSyncTime: new Date(latestFile.time),
          });
        }
      }
      return res.json({
        status: "empty",
        message: "No data found for this admin/user.",
        recordCounts: {},
        latestSyncTime: now,
      });
    }

    // build final payload
    const exportPayload = {
      meta: {
        generatedAt: now,
        userId,
        shops: adminShopIds,
        recordCounts,
        latestSyncTime: now,
      },
      data: payload,
    };
    const gzipFilePath = path.join(exportDir, fileName);
    const jsonBuffer = Buffer.from(EJSON.stringify(exportPayload, null, 2));
    const gzipped = zlib.gzipSync(jsonBuffer);
    fs.writeFileSync(gzipFilePath, gzipped);

    console.log(`✅ Dump written to ${gzipFilePath}`);

    res.json({
      status: "success",
      message: "Compressed dump created",
      fileName: `dump-${userId}.json.gz`,
      downloadUrl:
        source === "local"
          ? `${exportDir}/${fileName}`
          : `https://pointifypos.com/exports/${fileName}`,
      recordCounts,
      latestSyncTime: now,
    });
  } catch (err) {
    console.error("❌ Error:", err.stack || err);
    res.status(500).send(`Server error: ${err.message}`);
  }
};

function reviveBson(doc) {
  if (Array.isArray(doc)) {
    return doc.map(reviveBson); // Recursively fix each item in the array
  } else if (doc && typeof doc === "object") {
    if ("$oid" in doc && typeof doc.$oid === "string") {
      return new ObjectId(doc.$oid);
    }
    if ("$date" in doc && typeof doc.$date === "string") {
      return new Date(doc.$date);
    }

    // Recursively check nested fields
    for (const key in doc) {
      doc[key] = reviveBson(doc[key]);
    }
  }
  return doc;
}
const runFullSync = async (data) => {
  try {
    if (data.status === "empty" && data.downloadUrl) {
      console.log("⚠️ No data returned from server.");
      return;
    }

    console.log(`✅ Dump ready: ${data.downloadUrl}`);

    let fileBuffer;
    if (data.localPath?.startsWith("uploads/")) {
      console.log("✅ Importing from local file:", data.localPath);
      fileBuffer = fs.readFileSync(data.localPath);
      // continue with zlib.gunzipSync or your normal import
    } else if (data.downloadUrl.startsWith("http")) {
      console.log("📥 Downloading via HTTP...");
      const response = await axios.get(data.downloadUrl, {
        responseType: "arraybuffer",
      });
      fileBuffer = Buffer.from(response.data);
    } else {
      console.log("📥 Reading local file...");
      let localPath = data.downloadUrl;
      if (localPath.startsWith("file://")) {
        localPath = new URL(localPath).pathname;
        if (process.platform === "win32" && localPath.startsWith("/")) {
          localPath = localPath.slice(1);
        }
      }
      fileBuffer = fs.readFileSync(localPath);
    }

    console.log("📦 Decompressing...");
    const jsonBuffer = zlib.gunzipSync(fileBuffer);

    console.log("📝 Parsing JSON...");
    const dumpData = JSON.parse(jsonBuffer.toString());

    // revive ObjectIds from {$oid: "..."}
    reviveBson(dumpData);

    console.log("🚀 Starting data import...");
    for (const [collectionName, docs] of Object.entries(dumpData.data)) {
      const collection = mongoose.connection.db.collection(collectionName);
      console.log(`📂 Importing ${docs.length} docs into ${collectionName}...`);

      for (const doc of docs) {
        let query = { _id: doc._id };

        // If your data has unique fields (like email for admins), adjust
        if (collectionName === "admins" && doc.email) {
          query = { $or: [{ _id: doc._id }, { email: doc.email }] };
        }

        const { _id, ...updateDoc } = doc;

        await collection.updateOne(
          query,
          {
            $set: { ...updateDoc, sync: true },
            $setOnInsert: { _id },
          },
          { upsert: true }
        );
      }
    }
    console.log(`🎉 Full sync completed at ${new Date().toISOString()}`);

    return { success: true, message: "Full sync completed." };
  } catch (err) {
    console.error("❌ Sync error:", err.stack || err);
    return { success: false, message: err.message };
  }
};
// --------------------
// CONTROLLER TO TRIGGER IMPORT VIA HTTP
// --------------------
const pullImport = async (req, res) => {
  let {
    downloadUrl,
    latestSyncTime,
    id,
    status,
    offline = "offline",
  } = req.body;
  let response = await runFullSync({ downloadUrl, latestSyncTime, id, status });
  // await Admin.findByIdAndUpdate(id, { offline });
  res.json(response);
};
// or bson if using

const pullOnlineImport = async (req, res) => {
  console.log(req.file);
  let { latestSyncTime, id, status, offline = "offline" } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const filePath = req.file.path;
    console.log("📥 Received file at:", filePath);

    // Read and decompress
    const gzippedBuffer = fs.readFileSync(filePath);
    const jsonBuffer = zlib.gunzipSync(gzippedBuffer);
    const payload = EJSON.parse(jsonBuffer.toString());

    console.log("✅ Parsed payload from file:", Object.keys(payload));

    // Pass to your existing sync logic
    await runFullSync({
      localPath: req.file?.path,
      latestSyncTime,
      id,
      status,
    });

    // Mark admin offline or similar
    // await Admin.findByIdAndUpdate(id, { offline });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ success: true, message: "Full sync from file completed." });
  } catch (err) {
    console.error("❌ Import error:", err);
    res.status(500).json({ error: err.message });
  }
};

// --------------------
// EXPORT MODULE
// --------------------
// --------------------
// EXPORT MODULE
// --------------------
module.exports = {
  getDump,
  pullImport,
  pullOnlineImport,
  cleanUpFiles,
  initDatabase,
  checkUpdate,
  syncDocumentToOnline,
};
