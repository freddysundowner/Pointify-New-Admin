const Admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose"); // Import the mongoose module
const {sendEmailNew} = require("../shared/emailsetup"); // Import your Nodemailer setup
const { sendSms } = require("../shared/functions");
const RenewToken = require("../models/renewtoken");
const Shop = require("../models/shop");
require("dotenv").config();
const {
  generateOTP,
  calculateOtpExpirationTime,
  isOtpExpired,
} = require("../shared/functions");
const Affliate = require("../models/affliate");


const getRenewData = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // Find the token and check it hasn't expired
    const renewToken = await RenewToken.findOne({
      token,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!renewToken) {
      return res.status(404).json({
        error: "This link has expired or is invalid. Please contact support.",
      });
    }

    // Load the admin
    const admin = await Admin.findById(renewToken.adminId)
      .select("_id username email phone")
      .lean();

    if (!admin) {
      return res.status(404).json({ error: "Account not found." });
    }

    // Load their shops
    const shops = await Shop.find({ adminId: renewToken.adminId })
      .select("_id name")
      .lean();

    return res.status(200).json({
      success: true,
      admin: {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        phone: admin.phone,
      },
      shops,
    });
  } catch (error) {
    console.error("getRenewData error:", error);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
};

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

     await sendEmailNew({
      recipientEmail: email,
      subject: 'Reset Your Pointify Password',
      recipientName: admin.username,
      slug: 'password-reset',
      placeholders: {
        otp: otp,
        otp_expiry: new Date(otp_expiry).toLocaleString("en-US", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
      },
    });

    res.status(200).json({
      reset: true, 
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Password Reset failed", reset: false });
  }
};

const resetPasswordSms = async (req, res) => {
  try {
    const { id, password } = req.body;
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(401).json({ error: "no user with that email" });
    }

    // generate new password and sms to the ower
    let newpassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
    admin.password = newpassword;
    await admin.save();
    let message = `Hello ${admin.username}, your new password is ${password}`;
    await sendSms(admin.phone, message);

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

      
     await sendEmailNew({
      recipientEmail: email,
      subject: 'Password Reset Success',
      recipientName: admin.username,
      slug: 'password-reset-success'
    });

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
const registerAdmin = async (req, res) => {
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
    await sendEmailNew(
      {
        recipientEmail: email,
        subject: "Welcome to Pointify",
        recipientName: username,
        slug: "welcome",
        placeholders: {
          username: username,
        },
      },
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

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);

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

const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    let admin = await Admin.findById(new mongoose.Types.ObjectId(id)).populate({
    path: 'primaryShop',
    populate: {
      path: 'shopCategoryId'
    }
  });
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
        { new: true }
      )
        .populate("attendantId", "username")
        .populate({
          path: "primaryShop",
          populate: [
            {
              path: "subscription",
              populate: {
                path: "packageId",
              },
            },
            {
              path: "shopCategoryId",
            },
          ],
        });
      return res.status(200).json(response);
    } else {
      const response = await Admin.findById(new mongoose.Types.ObjectId(id))
        .populate("attendantId", "username")
        .populate({
          path: "primaryShop",
          populate: [
            {
              path: "subscription",
              populate: {
                path: "packageId",
              },
            },
            {
              path: "shopCategoryId",
            },
          ],
        });
      return res.status(200).json(response);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Login failed" });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAdminById,
  resetPasswrod,
  resetPasswordRequest,
  saveAdminLocally, resetPasswordSms, getRenewData
};
