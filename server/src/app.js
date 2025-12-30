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
const aiRoutes = require('./routes/ai.routes');
const academicYearRoutes = require('./routes/academicYear.routes');
const pinRoutes = require('./routes/pin.routes');
const labRoutes = require('./routes/lab.routes');
const fileRoutes = require('./routes/file.routes');
const documentRoutes = require('./routes/document.routes');
const whiteboardRoutes = require('./routes/whiteboard.routes');
const auditRoutes = require('./routes/audit.routes');
const ticketRoutes = require('./routes/ticket.routes');
const procurementRoutes = require('./routes/procurement.routes');
const uploadRoutes = require('./routes/upload.routes');
const queryLogRoutes = require('./routes/querylog.routes');

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
app.use('/api/ai', aiRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/pin', pinRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/whiteboard', whiteboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin/query-logs', queryLogRoutes);

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

  // ===========================================
  // WHITEBOARD SHARING EVENTS
  // ===========================================

  // Instructor starts sharing whiteboard
  socket.on('whiteboard:start-share', (data) => {
    const { sessionId, instructorId, instructorName, targetType, targets, classId } = data;

    // Store session info on socket for later reference
    socket.whiteboardSession = { sessionId, instructorId, instructorName };

    // Join the whiteboard room
    socket.join(`whiteboard-${sessionId}`);

    console.log(`[Whiteboard] Instructor ${instructorName} started sharing session ${sessionId}`);

    // Broadcast to targets based on type
    if (targetType === 'class') {
      // Notify all students in the class
      io.to(`class-${classId}`).emit('whiteboard:shared-with-you', {
        sessionId,
        instructorName,
        targetType: 'class'
      });
    } else if (targetType === 'group') {
      // Notify students in selected groups
      targets.forEach(groupId => {
        io.to(`group-${groupId}`).emit('whiteboard:shared-with-you', {
          sessionId,
          instructorName,
          targetType: 'group'
        });
      });
    } else if (targetType === 'student') {
      // Notify specific students
      targets.forEach(studentId => {
        io.to(`user-${studentId}`).emit('whiteboard:shared-with-you', {
          sessionId,
          instructorName,
          targetType: 'student'
        });
      });
    }
  });

  // Instructor stops sharing whiteboard
  socket.on('whiteboard:stop-share', (data) => {
    const { sessionId } = data;

    console.log(`[Whiteboard] Session ${sessionId} stopped sharing`);

    // Notify all viewers
    io.to(`whiteboard-${sessionId}`).emit('whiteboard:ended', { sessionId });

    // Leave the room
    socket.leave(`whiteboard-${sessionId}`);
    socket.whiteboardSession = null;
  });

  // Drawing event from instructor - broadcast to viewers
  socket.on('whiteboard:draw', (data) => {
    const { sessionId } = data;

    // Broadcast to all viewers except sender
    socket.to(`whiteboard-${sessionId}`).emit('whiteboard:draw', data);
  });

  // Clear canvas event
  socket.on('whiteboard:clear', (data) => {
    const { sessionId } = data;

    socket.to(`whiteboard-${sessionId}`).emit('whiteboard:clear', data);
  });

  // Instructor broadcasts canvas state to all viewers
  socket.on('whiteboard:canvas-state', (data) => {
    const { sessionId, imageData } = data;

    // Broadcast to all viewers in the session room
    socket.to(`whiteboard-${sessionId}`).emit('whiteboard:canvas-state', {
      sessionId,
      imageData
    });
  });

  // Student requests current canvas state when joining
  socket.on('whiteboard:request-state', (data) => {
    const { sessionId } = data;

    // Join the whiteboard viewing room
    socket.join(`whiteboard-${sessionId}`);

    // Request the instructor to send current canvas state
    socket.to(`whiteboard-${sessionId}`).emit('whiteboard:state-requested', {
      sessionId,
      requesterId: socket.id
    });
  });

  // Instructor sends canvas state to new viewer
  socket.on('whiteboard:send-state', (data) => {
    const { sessionId, imageData, targetSocketId } = data;

    io.to(targetSocketId).emit('whiteboard:canvas-state', {
      sessionId,
      imageData
    });
  });

  // Join class/group rooms for whiteboard notifications
  socket.on('join-class', (classId) => {
    socket.join(`class-${classId}`);
  });

  socket.on('join-group', (groupId) => {
    socket.join(`group-${groupId}`);
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
