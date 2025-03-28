const express = require("express");
const cors = require("cors");
const passport = require("passport");
const port = process.env.PORT || 5000;
require("dotenv").config();

const app = express();
// middleware
app.use(cors());
app.use(express.json());


app.get("/",async(req,res)=>{
    res.send("driveSync server is running")
})


app.listen(port,()=>{
    console.log(`driveSync server is running on port ${port}`)
})
