const express = require('express');
const cors = require('cors');
const authMiddleware = require('./middleware/authMiddleware');

const port = 5000;
const app = express();

app.use(express.json());

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// API routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/teachers', require('./routes/teacherRoutes'));
app.use('/classes', require('./routes/classRoutes'));
app.use('/students', require('./routes/studentRoutes'));

app.listen(port, () => console.log(`Server Started on Port ${port}`));