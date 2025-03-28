const express = require("express");
const cors = require("cors");
const passport = require("passport");
const port = process.env.PORT || 5000;
const session = require("express-session");

require("dotenv").config();
const { google } = require("googleapis");
const multer = require("multer");
const { Readable } = require("stream");

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

// Google OAuth Configuration
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const oauth2client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);
//* setting up passport
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
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
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
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/drive.file"],
    accessType: "offline", //to get a refresh token
    prompt: "consent", //force consent to ensure refresh token is recieved
  })
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

// *lopgout routes
app.get("/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    req.session.destroy(() => {
      res.clearCookie("connect.sid"); // Clear session cookie
      res.json({ message: "Logged out successfully" });
    });
  });
});

// *google drive
// multer configuration for file upload

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Single file upload
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Google Drive Service
const drive = google.drive({ version: "v3", auth: oauth2client });
// Helper function to convert Buffer to stream
const bufferToStream = (buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
};
// google drive service helper

const uploadToDrive = async (file, user) => {
  try {
    // Create a new OAuth2 client instance for each request
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.REDIRECT_URI
    );

    // Set credentials from the authenticated user
    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const response = await drive.files.create({
      requestBody: {
        name: file.originalname,
        mimeType: file.mimetype,
        parents: ["root"], // Your folder ID
      },
      media: {
        mimeType: file.mimetype,
        body: bufferToStream(file.buffer),
      },
      fields: "id,name,webViewLink,webContentLink",
    });

    return response.data;
  } catch (error) {
    console.error("Drive Upload Error:", error);
    throw error;
  }
};

// upload endpoint
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const uploadedFile = await uploadToDrive(req.file, req.user);

    res.json({
      success: true,
      file: {
        id: uploadedFile.id,
        name: uploadedFile.name,
        webViewLink: uploadedFile.webViewLink,
        webContentLink: uploadedFile.webContentLink,
      },
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({
      success: false,
      error: "File upload failed",
      details: error.message,
      googleApiError: error.errors,
    });
  }
});
