require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const schoolRoutes = require('./routes/school.routes');
const classRoutes = require('./routes/class.routes');
const subjectRoutes = require('./routes/subject.routes');
const assignmentRoutes = require('./routes/assignment.routes');
const submissionRoutes = require('./routes/submission.routes');
const vivaRoutes = require('./routes/viva.routes');
const gradeRoutes = require('./routes/grade.routes');
const feeRoutes = require('./routes/fee.routes');
const reportRoutes = require('./routes/report.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const syllabusRoutes = require('./routes/syllabus.routes');
const notificationRoutes = require('./routes/notification.routes');
const activityLogRoutes = require('./routes/activitylog.routes');
const gradeScaleRoutes = require('./routes/gradeScale.routes');
const adminRoutes = require('./routes/admin.routes');
const deviceRoutes = require('./routes/device.routes');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io for real-time features (viva, notifications)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/viva', vivaRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/grade-scales', gradeScaleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/devices', deviceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Socket.io connection handling for viva sessions
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join viva room
  socket.on('join-viva', (vivaSessionId) => {
    socket.join(`viva-${vivaSessionId}`);
    console.log(`User ${socket.id} joined viva session ${vivaSessionId}`);
  });

  // WebRTC signaling for viva
  socket.on('viva-signal', (data) => {
    socket.to(`viva-${data.vivaSessionId}`).emit('viva-signal', {
      signal: data.signal,
      from: socket.id
    });
  });

  // Viva questions and responses
  socket.on('viva-question', (data) => {
    socket.to(`viva-${data.vivaSessionId}`).emit('viva-question', data);
  });

  socket.on('viva-response', (data) => {
    socket.to(`viva-${data.vivaSessionId}`).emit('viva-response', data);
  });

  // Notifications
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Lab Record Manager API ready`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, server, io };
