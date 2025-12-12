const jwt = require("jsonwebtoken");
const { User } = require("../models/user");
const { ENV } = require("../config/env");

function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
  });
}

async function registerUser(input) {
  const existing = await User.findOne({ phone: input.phone });
  if (existing) {
    const err = new Error("User already exists with this phone");
    err.statusCode = 400;
    throw err;
  }

  const user = new User(input);
  await user.save();
  const token = generateToken(user);
  return { user, token };
}

async function loginUser(phone, password) {
  const user = await User.findOne({ phone });
  if (!user) {
    const err = new Error("Invalid credentials");
    err.statusCode = 400;
    throw err;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error("Invalid credentials");
    err.statusCode = 400;
    throw err;
  }

  const token = generateToken(user);
  return { user, token };
}

module.exports = { registerUser, loginUser };