//models
const Setting = require("../models/Setting");

//global setting controller
const saveSettings = async (req, res) => {
  try {
    const exists = await Setting.findOne({ name: req.body.name });
    if (exists) {
      await Setting.updateOne({ name: req.body.name }, req.body);
      return res.send({
        message: "Setting Updated Successfully!",
      });
    }
    const newGlobalSetting = new Setting(req.body);
    await newGlobalSetting.save();
    res.send({
      message: "Setting Added Successfully!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};
const getSettings = async (req, res) => {
  let {type}  = req.query;
  try {
    if(!type){
      let globalSetting = await Setting.find();
      //make all be one thing object without the name
      let allsettings = {};
      globalSetting.forEach(setting => {
        allsettings[setting.name] = setting.setting
      })
      //remove name key 
      
      return res.json(allsettings);
    }
    if(type == "APP_CONFIG"){
      type = "APP_SETTINGS"
    }
    const globalSetting = await Setting.findOne({ name: type });
    return res.json(globalSetting?.setting??{});
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
}


module.exports = {
  saveSettings,
  getSettings
};
