const mongoose = require('mongoose');
const License = require('./models/License'); // assuming it's in models/License.js

async function findLicense() {
  const uri = "mongodb://jithinragesh_db_user:Resolve%40pm12344@ac-3l85suz-shard-00-01.dumeo4p.mongodb.net:27017/Resolve-PM?ssl=true&authSource=admin&retryWrites=true&w=majority";
  
  try {
    await mongoose.connect(uri);
    const unusedLicense = await License.findOne({ isActivated: false });
    if (unusedLicense) {
      console.log('Unused license found:');
      console.log(unusedLicense.key);
    } else {
      console.log('No unused licenses found.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}

findLicense();
