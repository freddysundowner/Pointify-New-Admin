const mongoose = require("mongoose");
require("dotenv").config();

const envType = process.env.ENV_TYPE || 'dev';
const dbUrl = envType === 'dev'
  ? process.env.MONGO_URL_STAGING || 'mongodb://localhost:27017/pointify'
  : process.env.MONGO_URL;

const connectDB = async () => {
  await mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log(`✅ Connected to MongoDB at ${dbUrl}`);
};

module.exports = { connectDB, mongoose };
