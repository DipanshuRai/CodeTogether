import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const userSchema=new mongoose.Schema(
    {
        email:{
            type: String,
            required: true,
            unique: true,
        },
        fullname:{
            type: String,
            required: true,
        },
        password:{
            type: String,
            required: true,
            minlength: 6,
        },
        refreshToken:{
            type: String
        }
    },
    {
        timestamps: true
    }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) 
    return next();
  this.password = await bcrypt.hash(this.password, 10); // Hash the plain text password with a salt round of 10
  next();
});

userSchema.methods = {
  comparePassword: async function (plainPassword) {
    return await bcrypt.compare(plainPassword, this.password);
  },

  generateAccessToken: function () {
    return jwt.sign(
      {
        _id: this._id,
        email: this.email,
        fullname: this.fullname,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      }
    );
  },

  generateRefreshToken: function () {
    return jwt.sign(
      {
        _id: this._id,
      },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
      }
    );
  },
};

const User=mongoose.model("User", userSchema);

export default User;