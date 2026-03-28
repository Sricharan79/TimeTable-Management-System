require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/master', require('./routes/masterRoutes'));
app.use('/api/timetable', require('./routes/timetableRoutes'));

app.get('/', (req, res) => {
  res.send('API Running...');
});

app.listen(process.env.PORT, () =>
  console.log(`🚀 Server running on port ${process.env.PORT}`)
);