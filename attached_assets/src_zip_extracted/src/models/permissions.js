// models/Permission.js
const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    value: [{
        type: String,
        lowercase: true,
        trim: true
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Permission', permissionSchema);