const express = require('express');
const cors = require('cors');
const authMiddleware = require('./middleware/authMiddleware');

const port = 5000;
const app = express();

app.use(express.json());

// Allow all CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// If using credentials (cookies/auth), do **NOT** use `origin: '*'` — see note below.
app.options('*', cors());

app.use('/auth', require('./routes/authRoutes'));
app.use('/teachers', require('./routes/teacherRoutes'));
app.use('/classes', require('./routes/classRoutes'));
app.use('/students', require('./routes/studentRoutes'));

app.listen(port, () => console.log(`Server Started on Port ${port}`));
