// validationUtils.js

module.exports.handleValidationErrors = (error, res) => {
  if (error.name === "ValidationError") {
    const errors = {};

    for (const key in error.errors) {
      if (error.errors.hasOwnProperty(key)) {
        const fieldName = key;
        const errorMessage = error.errors[key].message;
        errors[fieldName] = errorMessage;
      }
    }

    return res.status(400).json({ error: "Validation error", errors });
  }

  // Handle other errors or general server errors
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
};

module.exports.toDateFormat = (date) => {
  return new Date(new Date(date).setUTCHours(23, 59, 59, 999));
};
module.exports.fromDateFormat = (date) => {
  return new Date(new Date(date).setUTCHours(0, 0, 0, 0));
};