const Staff = require("../models/staff");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const login = async (req, res) => {
    try {
        console.log(req.body)
        const { email, password } = req.body;

        // Find the admin with the provided email
        const admin = await Staff.findOne({ email: email.trim() });
        console.log(admin)

        if (!admin) {
            // If admin not found, return a 401 Unauthorized response
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const passwordMatch = await bcrypt.compare(password, admin.password);

        console.log(passwordMatch)
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
            userdata: {
                _id: admin._id,
                email: admin.email,
                username: admin.username
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    login,
};