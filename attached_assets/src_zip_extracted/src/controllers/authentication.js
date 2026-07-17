const Admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose"); // Import the mongoose module
const transporter = require("../shared/emailsetup"); // Import your Nodemailer setup
require("dotenv").config();
const {
  generateOTP,
  calculateOtpExpirationTime,
  isOtpExpired,
} = require("../shared/functions");
const Affliate = require("../models/affliate");

const resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "no user with that email" });
    }

    let otp = generateOTP();
    let otp_expiry = calculateOtpExpirationTime(5);
    admin.otp = otp;
    admin.otp_expiry = otp_expiry;
    await admin.save();

    const replacements = {
      username: admin.username,
      otp,
      otp_expiry,
    };
    transporter.sendEmail(
      email,
      "Password Reset",
      "resetpassword",
      replacements
    );

    res.status(200).json({
      reset: true,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Password Reset failed", reset: false });
  }
};

const resetPasswrod = async (req, res) => {
  try {
    const { email, otp, newpassword } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Invalid email" });
    }
    if (isOtpExpired(admin.otp_expiry)) {
      return res.status(401).json({ error: "Otp has expired", retry: false });
    }
    if (otp != admin.otp) {
      return res.status(401).json({ error: "invalid otp", retry: true });
    }

    if (newpassword) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(newpassword, salt);
      admin.otp = null;
      admin.otp_expiry = null;

      const welcomeReplacements = {
        username: admin.username,
      };
      transporter.sendEmail(
        email,
        "Password Changed",
        "passwordChanged",
        welcomeReplacements
      );

      await admin.save();
    }
    await admin.save();

    res.status(200).json({
      reset: true,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Login failed", reset: false });
  }
};
const saveAdminLocally = async (req, res) => {
  console.log(req.body);
};
const register = async (req, res) => {
  try {
    // Create a new admin and save it
    let {
      email,
      password,
      phone,
      username,
      referal,
      app_version = "0",
      platform = "n/a",
      affliate = "",
    } = req.body;
    let affliateID = null;
    if (affliate) {
      affliateID = await Affliate.findOne({ code: affliate });
    }
    let payload = {
      email: email.trim(),
      password: await bcrypt.hash(password, await bcrypt.genSalt(10)),
      phone,
      username,
      app_version,
      platform,
      referal: referal == "" ? null : referal,
      affliate: affliateID != null ? affliateID?._id : null,
    };
    const newAdmin = new Admin(payload);
    await newAdmin.save();
    // Create a JWT token
    const token = jwt.sign({ id: newAdmin._id }, process.env.jwtsecret, {
      expiresIn: "24h",
    });
    const welcomeReplacements = {
      username: username,
    };
    transporter.sendEmail(
      email,
      "Welcome to Pointify",
      "welcome",
      welcomeReplacements
    );

    res.status(201).json({
      message: "Admin registered successfully",
      token,
      status: true,
      userdata: {
        _id: newAdmin._id,
        email: newAdmin.email,
        phone: newAdmin.phone,
      },
    });
  } catch (error) {
    console.log(error);
    if (error.code === 11000 && error.keyPattern.email === 1) {
      res
        .status(400)
        .json({ error: "Email address is already in use.", status: false });
    } else if (error.code === 11000 && error.keyPattern.username === 1) {
      res
        .status(400)
        .json({ error: "username address is already in use.", status: false });
    } else {
      res.status(500).json({ error: "Registration failed", status: false });
    }
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the admin with the provided email
    const admin = await Admin.findOne({ email: email.trim() })
      .populate("attendantId", "username")
      .populate({
        path: "primaryShop",
        populate: {
          path: "subscription",
          populate: {
            path: "packageId",
          },
        },
      });

    if (!admin) {
      // If admin not found, return a 401 Unauthorized response
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      // If passwords don't match, return a 401 Unauthorized response
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign(
      { email: admin.email, _id: admin._id },
      process.env.jwtsecret,
      {
        expiresIn: "24h",
      }
    );

    res.status(200).json({
      token,
      expiresIn: 24 * 60 * 60 * 1000,
      userdata: admin,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    let admin = await Admin.findById(new mongoose.Types.ObjectId(id));
    if (!admin) {
      return res.status(401).json({ error: "no admin exists" });
    }
    if (
      (admin.emailVerified == false || admin.emailVerified == null) &&
      admin.emailVerificationDate == null
    ) {
      let today = new Date();
      const response = await Admin.findByIdAndUpdate(
        id,
        { emailVerificationDate: new Date(today.setDate(today.getDate() + 5)) },
        {
          new: true,
        }
      )
        .populate("attendantId", "username")
        .populate({
          path: "primaryShop",
          populate: {
            path: "subscription",
            populate: {
              path: "packageId",
            },
          },
        });
      return res.status(200).json(response);
    } else {
      const response = await Admin.findById(new mongoose.Types.ObjectId(id))
        .populate("attendantId", "username")
        .populate({
          path: "primaryShop",
          populate: {
            path: "subscription",
            populate: {
              path: "packageId",
            },
          },
        });
      return res.status(200).json(response);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Login failed" });
  }
};

module.exports = {
  register,
  login,
  getUserById,
  resetPasswrod,
  resetPasswordRequest,
  saveAdminLocally,
};
