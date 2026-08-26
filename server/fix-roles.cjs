require('dotenv').config();
const mongoose = require('mongoose');

async function fixRoles() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  
  const result = await usersCollection.updateMany(
    { role: 'user' },
    { $set: { role: 'STAFF' } }
  );
  
  const result2 = await usersCollection.updateMany(
    { role: 'admin' },
    { $set: { role: 'ADMIN' } }
  );

  const result3 = await usersCollection.updateMany(
    { role: 'staff' },
    { $set: { role: 'STAFF' } }
  );
  
  console.log('Roles fixed:', result.modifiedCount, result2.modifiedCount, result3.modifiedCount);
  process.exit(0);
}

fixRoles().catch(console.error);
