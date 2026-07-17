const Setting = require("../models/Setting")

exports.settings = async (key)  => {
    var response = await Setting.findOne({name: key});
    return response;
}