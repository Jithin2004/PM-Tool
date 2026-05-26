const License = require('../models/License')

let keys = [
  "X7K-9M2-V4P-8LQ",
  "B3R-5N9-C1T-6JW",
  "H8F-2Y7-D4G-3MX",
  "W4P-9K6-L1R-5TV",
  "Q2M-8J3-X7N-9FC",
  "V6D-1Y5-H8B-2RG",
  "L9T-4W7-P3K-5MC",
  "N2C-8F6-J1X-9YQ",
  "R5B-9M4-V2H-7DT",
  "G3X-7K1-L8P-4NW"
]

exports.addLicense = async(req,res)=>{
    try{
       await Promise.all(keys.map(async (k) => {
            const existing = await License.findOne({ key: k });
            if (!existing) {
                await License.create({ key: k });
            }
       }));
       res.status(200).json({ success: true, message: 'All product keys initialized.' });
    }catch(e){
        console.log("error while adding key")
        console.error(e)
        res.status(500).json({ error: 'Failed to initialize keys' })
    }
}