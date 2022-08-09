const admin = require("firebase-admin");

const {firebaseConfig} = require("./secrets");

const initializeFirebaseAdmin = () => {
  admin.initializeApp(firebaseConfig);
  return admin;
};

module.exports = initializeFirebaseAdmin;
