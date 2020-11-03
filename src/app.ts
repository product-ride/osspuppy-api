import express from 'express';
import morgan from 'morgan';

const app = express();
const API_SERVER_PORT = process.env.PORT || 8000;
const isProd = process.env.NODE_ENV === 'production';

// setup middlewares
app.use(morgan(isProd? 'short': 'dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'hello world' });
});

app.listen(API_SERVER_PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${API_SERVER_PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${API_SERVER_PORT} in development mode`);
  }
});
