const { registerUrlC2B } = require("../shared/functions");

exports.registerMpesaUrl = async (req, res) => {
    
    let response = await registerUrlC2B();
        console.log("response",response);
        res.json({
            response
        });
};
