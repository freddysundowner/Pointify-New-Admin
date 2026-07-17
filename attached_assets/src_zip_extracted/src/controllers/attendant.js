const Attendant = require("../models/attendant");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin"); // Adjust the import path as needed

const loginByPin = async (req, res) => {
    let { pin } = req.body;
    console.log(req.body);
    let attendant = await Attendant.findOne({ uniqueDigits: pin });
    if (!attendant) {
        // If attendant not found, return a 401 Unauthorized response
        return res.status(401).json({ error: "Invalid pin" });
    }
    const token = jwt.sign(
        { uid: attendant.uniqueDigits, _id: attendant._id },
        process.env.jwtsecret,
        {
            expiresIn: "24h",
        },
    );
    res.status(200).json({
        token,
        expiresIn: 24 * 60 * 60 * 1000,
        userdata: {
            _id: attendant._id,
            email: attendant.email,
            uniqueDigits: attendant.uniqueDigits,
        },
    });
};

// Create Attendant with shopId
const createAttendant = async (req, res) => {
    try {
        const {
            username,
            uniqueDigits,
            password,
            shopId,
            adminId,
            permissions,
        } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const attendant = new Attendant({
            username,
            uniqueDigits,
            password: hashedPassword,
            shopId,
            adminId,
            permissions,
        });
        const newAttendant = await attendant.save();

        res.status(201).json(newAttendant);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error creating attendant" });
    }
};
const resetPasswordSms = async (req, res) => {
    try {
        const { id, password, phone } = req.body;
        const attendant = await Attendant.findById(id);
        if (!attendant) {
            return res.status(401).json({ error: "no user with that email" });
        }

        if (!attendant?.phone && !phone) {
            return res.status(401).json({ error: "enter phone number" });
        }
        if (!attendant?.phone && phone) {
            attendant.phone = phone;
            await attendant.save();
        }

        // generate new password and sms to the ower
        let newpassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
        attendant.password = newpassword;
        await attendant.save();
        let message = `Hello ${attendant.username}, your new password is ${password}`;
        await sendSms(attendant.phone, message);

        res.status(200).json({
            reset: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Password Reset failed", reset: false });
    }
};
// Get all Attendants
const getAllAttendants = async (req, res) => {
    try {
        let { id } = req.params;
        let { limit = 20, page = 1, username, shopId } = req.query; // ← add shopId
        let filter = {};
        if (id !== "admin") {
            filter.adminId = id;
        }
        if (shopId) {
            // ← add these
            filter.shopId = shopId; //   3 lines
        }
        if (username) {
            filter.username = { $regex: username, $options: "i" };
        }
        const attendants = await Attendant.find(filter)
            .populate("shopId")
            .limit(limit)
            .skip((page - 1) * limit);
        res.status(200).json({
            attendants,
            pagination: {
                total: await Attendant.countDocuments(filter),
                page,
                limit,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching attendants" });
    }
};

// Update Attendant with shopId
const updateAttendant = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            username,
            uniqueDigits,
            password,
            shopId,
            permissions,
            lastAppRatingDate,
            email,
            phone,
        } = req.body;
        let data = {};
        if (password) {
            let hashedPassword = password;
            hashedPassword = await bcrypt.hash(password, 10);
            data.password = hashedPassword;
        }
        if (lastAppRatingDate) {
            data["lastAppRatingDate"] = lastAppRatingDate;
        }
        if (username) {
            data["username"] = username;
        }
        if (uniqueDigits) {
            data["uniqueDigits"] = uniqueDigits;
        }
        if (shopId) {
            data["shopId"] = shopId;
        }
        if (email) {
            data["email"] = email;
        }
        if (phone) {
            data["phone"] = phone;
        }
        console.log("permissions", permissions);
        if (!permissions) {
            delete data["permissions"];
        }
        console.log(data);
        if (permissions) {
            data["permissions"] = permissions;
        }
        console.log(data);

        var updatedAttendant = await Attendant.findByIdAndUpdate(id, data, {
            new: true,
        });

        if (!updatedAttendant) {
            return res.status(404).json({ error: "Attendant not found" });
        }

        res.status(200).json(updatedAttendant);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error updating attendant" });
    }
};

// Delete Attendant
const deleteAttendant = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedAttendant = await Attendant.findByIdAndDelete(id);

        if (!deletedAttendant) {
            return res.status(404).json({ error: "Attendant not found" });
        }

        return res.status(200).json({ message: "Attendant deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error deleting attendant" });
    }
};

// Get Attendants by Shop ID
const getAttendantsByShopOrAdminId = async (req, res) => {
    try {
        const { shopId, adminId } = req.query;
        let filter = {};
        if (shopId) {
            filter.shopId = shopId;
        }
        if (adminId) {
            filter.adminId = adminId;
            const adminRes = await Admin.findById(adminId);
            filter.shopId = adminRes?.primaryShop;
        }
        const attendants = await Attendant.find(filter).populate("shopId");
        res.status(200).json(attendants);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error fetching attendants by shop or admin ID",
        });
    }
};

// Get Attendant by ID
const getAttendantById = async (req, res) => {
    try {
        const { id } = req.params;
        let attendant = await Attendant.findById(id).populate({
            path: "shopId",
            populate: { path: "subscription", populate: { path: "packageId" } },
        });

        if (!attendant) {
            return res.status(404).json({ error: "Attendant not found" });
        }
        // attendant.lastAppRatingDate = '2024-08-16T00:00:00.000Z';
        res.status(200).json(attendant);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching attendant by ID" });
    }
};

const loginAattendant = async (req, res) => {
    try {
        const { uid, password } = req.body;

        // Find the admin with the provided email
        const attendant = await Attendant.findOne({
            uniqueDigits: parseInt(uid),
        });
        if (!attendant) {
            // If attendant not found, return a 401 Unauthorized response
            return res
                .status(401)
                .json({ error: "Invalid user ID or password" });
        }
        const passwordMatch = await bcrypt.compare(
            password,
            attendant.password,
        );
        if (!passwordMatch) {
            // If passwords don't match, return a 401 Unauthorized response
            return res
                .status(401)
                .json({ error: "Invalid user ID or password" });
        }
        const token = jwt.sign(
            { uid: attendant.uniqueDigits, _id: attendant._id },
            process.env.jwtsecret,
            {
                expiresIn: "24h",
            },
        );
        res.status(200).json({
            token,
            expiresIn: 24 * 60 * 60 * 1000,
            userdata: {
                _id: attendant._id,
                email: attendant.email,
                uniqueDigits: attendant.uniqueDigits,
            },
        });
    } catch (error) {
        // console.error(error);
        res.status(500).json({ error: "Login failed" });
    }
};

module.exports = {
    createAttendant,
    getAllAttendants,
    getAttendantById,
    updateAttendant,
    deleteAttendant,
    getAttendantsByShopOrAdminId,
    loginAattendant,
    resetPasswordSms,
    loginByPin,
};
