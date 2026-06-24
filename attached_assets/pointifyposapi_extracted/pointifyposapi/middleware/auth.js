// middleware/auth.js
const jwt = require('jsonwebtoken');
// const verifyToken = (req, res, next) => {
//   console.log("Route hit:", req.method, req.originalUrl);
//   console.log("Authorization header:", req.headers["authorization"]);

//   const authHeader = req.headers["authorization"];
//   const token = authHeader && authHeader.split(" ")[1];

//   console.log("Extracted token:", token);

//   if (!token) {
//     return res.status(401).json({ message: "Access token required" });
//   }

//   jwt.verify(token, process.env.jwtsecret, (err, user) => {
//     if (err) {
//       console.log("JWT error:", err.message);
//       return res.status(401).json({ message: "Invalid or expired token" });
//     }

//     console.log("Decoded user:", user);
//     req.user = user;
//     next();
//   });
// };

// module.exports = verifyToken;
const verifyToken = (req, res, next) => {
  return next();
  // console.log("req.path ",req.path);
  const excludedRoutes = ["/confirmation", "/validation", "/payments"];
  // Block all GET requests to /sync/:id
  // const syncRouteRegex = /^\/sync\/[a-fA-F0-9]{24}$/; // Assuming MongoDB-like ObjectId

  // if (syncRouteRegex.test(req.path)) {
  //   return res.status(403).json({ message: 'Access to /sync is blocked' });
  // }
  if (excludedRoutes.includes(req.path)) {
    return next();
  }
  const syncRouteRegex = /^\/sync\/[^/]+$/; // matches /sync/<anything-without-slash>

  if (syncRouteRegex.test(req.path)) {
    return res.status(403).json({ message: 'Access to /sync is blocked' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.jwtsecret, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  });
};

module.exports = verifyToken;
