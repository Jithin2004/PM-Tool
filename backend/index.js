require('dotenv').config()
const express = require('express')
const connectDB = require('./config/db')

const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  }
  next();
});

app.get('/',(req,res)=>{
    res.status(200).json({
        message:'welcome to pm-tool server'
    })
})

const licenseRoute = require('./routes/licenseRoute')
app.use("/",licenseRoute)

app.get('/test',(req,res)=>{
    res.status(200).json({
        message:'test route success backend running successfully'
    })
})

app.listen(PORT,async()=>{
    await connectDB()
    console.log("app is running")
})