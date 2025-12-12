const { registerUser, loginUser } = require("../services/authService");

async function register(req, res) {
  try {
    const { name, phone, password, role, mandal, district } = req.body;
    const { user, token } = await registerUser({
      name,
      phone,
      password,
      role,
      mandal,
      district,
    });
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || "Registration failed" });
  }
}

async function login(req, res) {
  try {
    const { phone, password } = req.body;
    console.log("Login attempt for phone:", phone, password);
    const { user, token } = await loginUser(phone, password);
    console.log("Login successful for user ID:", user.id);
    res.json({ user, token });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || "Login failed" });
  }
}

module.exports = { register, login };