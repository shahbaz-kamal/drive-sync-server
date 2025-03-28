const express = require("express");
const cors = require("cors");
const passport = require("passport");
const port = process.env.PORT || 5000;
const session = require("express-session");
require("dotenv").config();

const app = express();
// express session middleware
app.use(
  session({
    secret: process.env.SECRET, // Replace with a strong secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Use `true` in production with HTTPS
  })
);

// middleware
const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());

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
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: process.env.FRONTEND_URL,
  }),
  async (req, res) => {
    res.redirect(process.env.FRONTEND_URL);
  }
);
// sending user info to front end
app.get("/auth/user", async (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.json(null);
  }
});
