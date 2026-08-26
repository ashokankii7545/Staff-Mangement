import dotenv from 'dotenv';
dotenv.config();

const requiredVars = ['MONGO_URI', 'JWT_SECRET'];
for (const v of requiredVars) {
  if (!process.env[v]) {
    console.error(`❌ Missing required env var: ${v}`);
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '8080'),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  vpnapiKey: process.env.VPNAPI_KEY || '',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
};
