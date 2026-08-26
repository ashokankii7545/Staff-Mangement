import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const latestUser = await User.findOneAndDelete({ role: 'STAFF' }, { sort: { createdAt: -1 } });
  console.log('Deleted user:', latestUser?.email);
  process.exit(0);
});
