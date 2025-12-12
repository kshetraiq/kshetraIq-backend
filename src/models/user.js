const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES } = require("../utils/roles");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      default: ROLES.FARMER,
    },
    mandal: { type: String },
    district: { type: String },
  },
  { timestamps: true }
);

// 🔧 FIXED: async hook WITHOUT next()
UserSchema.pre("save", async function () {
  const user = this;
  // if password not modified, do nothing
  if (!user.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model("User", UserSchema);
module.exports = { User };