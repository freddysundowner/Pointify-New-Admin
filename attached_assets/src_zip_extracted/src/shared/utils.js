let END_POINTS = {
  DEPOSIT: "mpesa/stkpush/v1/processrequest",
  WITHDRAW: "mpesa/b2c/v1/paymentrequest",
  GENERATE_TOKEN: 'oauth/v1/generate?grant_type=client_credentials',
  CONFIRMATION: 'https://api.pointifypos.com/payment/confirmation',
  VALIDATION: 'https://api.pointifypos.com/payment/validation',
  CANCELLED: 'https://api.aviatorgam.com/cancelled',
  QUEUETIMEOURURL: "https://api.aviatorgam.com/aviator/confirmation",
  RESULTURL: "https://api.pointifypos.com/payments/withdraw/response",
  TRANSACTIONSTATUS: "mpesa/transactionstatus/v1/query",
  REVERSE: "mpesa/reversal/v1/request"
};



module.exports = {
  END_POINTS,
};
