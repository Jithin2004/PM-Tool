const mongoose = require('mongoose');
const License = require('./models/License');

async function createLicense() {
  const uri = "mongodb://jithinragesh_db_user:Resolve%40pm12344@ac-3l85suz-shard-00-01.dumeo4p.mongodb.net:27017/Resolve-PM?ssl=true&authSource=admin&retryWrites=true&w=majority";
  
  try {
    await mongoose.connect(uri);
    
    const { randomBytes } = require('crypto');
    const parts = [
      randomBytes(2).toString('hex').toUpperCase(),
      randomBytes(2).toString('hex').toUpperCase(),
      randomBytes(2).toString('hex').toUpperCase(),
      randomBytes(2).toString('hex').toUpperCase()
    ];
    const key = parts.join('-');
    
    const license = new License({
      key: key,
      plan: 'ENTERPRISE',
      seats: 50,
      isActivated: false
    });
    
    await license.save();
    console.log('Created license: ' + key);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}

createLicense();
