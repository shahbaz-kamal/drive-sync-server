const express = require("express");
const cors = require("cors");
const passport = require("passport");
const port = process.env.PORT || 5000;
require("dotenv").config();

const app = express();
// middleware
app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.send("driveSync server is running");
});

//* setting up passport
const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      // secrets
      callbackURL: "/auth/google/callback",
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    (accessToken, refreshToken, profile, done) => {
      // will be handled by passport
      console.log("handled by passport callback function");
      return done(null, profile);
    }
  )
);

// saving the user object in the session
passport.serializeUser((user, done) => {
  done(null, user);
});
// retrieving the user object from the session
passport.deserializeUser((user, done) => {
  done(null, user);
});

app.listen(port, () => {
  console.log(`driveSync server is running on port ${port}`);
});

// *creating route for authentication
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get("/auth/google/callback", { failureRedirect: "/" }, async (req, res) => {
  res.redirect("/");
});
