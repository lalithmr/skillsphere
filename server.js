const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 4111;

// Setup View Engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Challenge 1: Form Handling (Body Parser) -Day22
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup Session
app.use(session({
  secret: 'skillsphere_secret',
  resave: false,
  saveUninitialized: false
}));

// Setup Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy Configuration
passport.use(new LocalStrategy({
  usernameField: 'email'
}, async (email, password, done) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return done(null, false, { message: 'Incorrect email.' });
    }
    // In a real app, you would use bcrypt to compare passwords
    if (user.password !== password) {
      return done(null, false, { message: 'Incorrect password.' });
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// Serialize and Deserialize User
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Challenge 2: Database Integration -Day22
// Connect to MongoDB
mongoose.connect('mongodb+srv://lalithmr:lalithmr@cluster0.cxeqd1q.mongodb.net/skillsphere-lms')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));


// Routes

// Home route
app.get('/', (req, res) => {
  res.render('home');
});

// Challenge 3: Deployment Status Route
app.get('/status', (req, res) => {
  res.send('App is live');
});

// Challenge 2: Integration Testing endpoint
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

//  Challenge 1: Registration Form
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const newUser = new User({ name, email, password, role });
    await newUser.save();
    console.log('Data successfully saved for user:', email); // Challenge 2: Confirmed via console log
    res.send(`Registration successful for ${name}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error during registration');
  }
});

// Login Form
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', passport.authenticate('local', {
  failureRedirect: '/login'
}), (req, res) => {
  // Redirect based on role
  if (req.user.role === 'admin') {
    res.redirect('/admin');
  } else {
    res.redirect('/dashboard');
  }
});

// User Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.render('dashboard', { user: req.user });
});

// Logout
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});

// Challenge 3: Authentication and RBAC Day22
// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Access Denied'); // Not logged in
  }
  if (req.user.role !== 'admin') {
    return res.status(403).send('Access Denied'); // Logged in but not admin
  }
  next();
};

app.get('/admin', isAdmin, (req, res) => {
  res.render('admin', { user: req.user });
});










//-----------------------------------------------------------------//
// Day 23 Challenge 3: API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many requests' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Skip rate limiter during automated tests
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', apiLimiter);
}

// Day 23 Challenge 1: CRUD API Setup (In-memory list)
let courses = [
  { id: 1, name: 'JavaScript Basics', duration: '3 weeks' }
];

// Get all courses
app.get('/api/courses', (req, res) => {
  res.json(courses);
});

// Create a new course (Day 23 Challenge 2: Input Validation)
app.post('/api/courses', [
  body('name').notEmpty().withMessage('Course name is required'),
  body('duration').notEmpty().withMessage('Duration is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const newCourse = {
    id: courses.length > 0 ? courses[courses.length - 1].id + 1 : 1,
    name: req.body.name,
    duration: req.body.duration
  };
  courses.push(newCourse);
  res.status(201).json(newCourse);
});

// Update a course
app.put('/api/courses/:id', [
  body('name').optional().notEmpty().withMessage('Course name cannot be empty'),
  body('duration').optional().notEmpty().withMessage('Duration cannot be empty')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const course = courses.find(c => c.id === parseInt(req.params.id));
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  if (req.body.name) course.name = req.body.name;
  if (req.body.duration) course.duration = req.body.duration;

  res.json(course);
});

// Delete a course
app.delete('/api/courses/:id', (req, res) => {
  const courseIndex = courses.findIndex(c => c.id === parseInt(req.params.id));
  if (courseIndex === -1) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const deletedCourse = courses.splice(courseIndex, 1);
  res.json(deletedCourse[0]);
});

//-----------------------------------------------------------------//
// Day 24 Challenge 1 & 2: File Upload and Serve Static Files
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

app.use('/materials', express.static('uploads'));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.send(`File uploaded successfully: ${req.file.originalname}`);
});

// Day 24 Challenge 3: Real-Time Chat
io.on('connection', (socket) => {
  console.log('A user connected for chat');

  socket.on('chat message', (msg) => {
    // broadcast to all clients
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from chat');
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
