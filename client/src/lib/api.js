import axios from 'axios';
import { useAuthStore } from './store';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to add auth token and session header
api.interceptors.request.use((config) => {
    const { accessToken, selectedSessionId } = useAuthStore.getState();
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // Include selected academic session for session-scoped data
    if (selectedSessionId) {
        config.headers['X-Academic-Session'] = selectedSessionId;
    }
    return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = useAuthStore.getState().refreshToken;
                const { data } = await axios.post('/api/auth/refresh', { refreshToken });

                useAuthStore.getState().setAuth(
                    useAuthStore.getState().user,
                    data.data.accessToken,
                    refreshToken
                );

                originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                useAuthStore.getState().logout();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (data) => api.post('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me'),
    changePassword: (data) => api.put('/auth/password', data),
    updateProfile: (data) => api.put('/auth/profile', data),
};

// Files API - Cloudinary uploads
export const filesAPI = {
    getStatus: () => api.get('/files/status'),
    upload: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    delete: (fileId) => api.delete(`/files/${fileId}`),
};

// Documents API - PDF, DOCX, XLS management
export const documentsAPI = {
    getAll: (params) => api.get('/documents', { params }),
    getById: (id) => api.get(`/documents/${id}`),
    upload: (file, data) => {
        const formData = new FormData();
        formData.append('file', file);
        if (data.name) formData.append('name', data.name);
        if (data.description) formData.append('description', data.description);
        if (data.category) formData.append('category', data.category);
        if (data.isPublic) formData.append('isPublic', data.isPublic);
        return api.post('/documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    update: (id, data) => api.put(`/documents/${id}`, data),
    delete: (id) => api.delete(`/documents/${id}`),
    getPublic: (id) => api.get(`/documents/${id}/public`),
    // Document sharing
    share: (id, data) => api.post(`/documents/${id}/share`, data),
    getShared: (params) => api.get('/documents/shared', { params }),
    getShares: (id) => api.get(`/documents/${id}/shares`),
    removeShare: (shareId) => api.delete(`/documents/shares/${shareId}`),
};

// Devices API - for camera, mic, speaker testing
export const devicesAPI = {
    getTestStatus: () => api.get('/devices/test-status'),
    testCamera: (data) => api.post('/devices/test-camera', data),
    testMic: (data) => api.post('/devices/test-mic', data),
    testSpeaker: (data) => api.post('/devices/test-speaker', data),
    testAll: (data) => api.post('/devices/test-all', data),
};

// Assignments API
export const assignmentsAPI = {
    getAll: (params) => api.get('/assignments', { params }),
    getById: (id) => api.get(`/assignments/${id}`),
    create: (data) => api.post('/assignments', data),
    update: (id, data) => api.put(`/assignments/${id}`, data),
    publish: (id) => api.post(`/assignments/${id}/publish`),
    addTarget: (id, data) => api.post(`/assignments/${id}/targets`, data),
    removeTarget: (targetId) => api.delete(`/assignments/targets/${targetId}`),
    uploadFiles: (id, files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        return api.post(`/assignments/${id}/files`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    // PDF attachment
    uploadPdf: (id, file) => {
        const formData = new FormData();
        formData.append('pdf', file);
        return api.post(`/assignments/${id}/pdf`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    removePdf: (id) => api.delete(`/assignments/${id}/pdf`),
    delete: (id) => api.delete(`/assignments/${id}`),
};

// Submissions API
export const submissionsAPI = {
    getAll: (params) => api.get('/submissions', { params }),
    getById: (id) => api.get(`/submissions/${id}`),
    getMySubmissions: (params) => api.get('/submissions/my', { params }),
    getPendingReview: (params) => api.get('/submissions/pending', { params }),
    create: (data) => {
        const formData = new FormData();
        Object.keys(data).forEach((key) => {
            if (key === 'files') {
                data.files.forEach((file) => formData.append('attachments', file));
            } else {
                formData.append(key, data[key]);
            }
        });
        return api.post('/submissions', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    update: (id, data) => api.put(`/submissions/${id}`, data),
    updateStatus: (id, status) => api.put(`/submissions/${id}/status`, { status }),
};

// Viva API
export const vivaAPI = {
    getSessions: (params) => api.get('/viva/sessions', { params }),
    getSession: (id) => api.get(`/viva/sessions/${id}`),
    scheduleSession: (data) => api.post('/viva/sessions', data),
    scheduleStandaloneSession: (data) => api.post('/viva/sessions/schedule', data),
    startSession: (id) => api.put(`/viva/sessions/${id}/start`),
    completeSession: (id, data) => api.put(`/viva/sessions/${id}/complete`, data),
    getQuestions: (params) => api.get('/viva/questions', { params }),
    addQuestion: (data) => api.post('/viva/questions', data),
    getAvailableStudents: (params) => api.get('/viva/available-students', { params }),
    // Waiting room
    joinSession: (id) => api.post(`/viva/sessions/${id}/join`),
    getParticipants: (id) => api.get(`/viva/sessions/${id}/participants`),
    getMyStatus: (id) => api.get(`/viva/sessions/${id}/my-status`),
    admitParticipant: (sessionId, participantId) => api.put(`/viva/sessions/${sessionId}/admit/${participantId}`),
    rejectParticipant: (sessionId, participantId) => api.put(`/viva/sessions/${sessionId}/reject/${participantId}`),
    admitAll: (id) => api.put(`/viva/sessions/${id}/admit-all`),
    leaveSession: (id) => api.put(`/viva/sessions/${id}/leave`),
    // Time management
    getTimeStatus: (id) => api.get(`/viva/sessions/${id}/time-status`),
    autoStart: (id) => api.put(`/viva/sessions/${id}/auto-start`),
    autoEnd: (id) => api.put(`/viva/sessions/${id}/auto-end`),
    checkAutoStart: () => api.get('/viva/sessions/check-auto-start'),
    markMissed: (id, reason) => api.put(`/viva/sessions/${id}/mark-missed`, { reason }),
    cleanupExpired: () => api.get('/viva/sessions/cleanup-expired'),
    // Recording
    uploadRecording: (id, file, duration) => {
        const formData = new FormData();
        formData.append('recording', file);
        formData.append('duration', duration || 0);
        return api.post(`/viva/sessions/${id}/recording`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    getRecordingUrl: (filename) => `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'}/viva/recordings/${filename}`,
};

// Grades API
export const gradesAPI = {
    getAll: (params) => api.get('/grades', { params }),
    getById: (id) => api.get(`/grades/${id}`),
    create: (data) => api.post('/grades', data),
    grade: (submissionId, data) => api.post('/grades', { submissionId, ...data }),
    update: (id, data) => api.put(`/grades/${id}`, data),
    publish: (id) => api.post(`/grades/${id}/publish`),
    getHistory: (id) => api.get(`/grades/${id}/history`),
    getFinalMarks: (params) => api.get('/grades/final-marks', { params }),
    calculateFinalMarks: (data) => api.post('/grades/final-marks/calculate', data),
};

// Classes API
export const classesAPI = {
    getAll: (params) => api.get('/classes', { params }),
    getById: (id) => api.get(`/classes/${id}`),
    getStudents: (id) => api.get(`/classes/${id}/students`),
    getGroups: (id) => api.get(`/classes/${id}/groups`),
    create: (data) => api.post('/classes', data),
    enroll: (id, data) => api.post(`/classes/${id}/enroll`, data),
    createGroup: (id, data) => api.post(`/classes/${id}/groups`, data),
    autoGenerateGroups: (id) => api.post(`/classes/${id}/groups/auto-generate`),
    deleteGroup: (classId, groupId) => api.delete(`/classes/${classId}/groups/${groupId}`),
    addGroupMember: (classId, groupId, studentId) => api.post(`/classes/${classId}/groups/${groupId}/members`, { studentId }),
    removeGroupMember: (classId, groupId, studentId) => api.delete(`/classes/${classId}/groups/${groupId}/members/${studentId}`),
    getUngroupedStudents: (classId) => api.get(`/classes/${classId}/ungrouped-students`),
};

// Labs API
export const labsAPI = {
    getAll: () => api.get('/labs'),
    getById: (id) => api.get(`/labs/${id}`),
    create: (data) => api.post('/labs', data),
    update: (id, data) => api.put(`/labs/${id}`, data),
    delete: (id) => api.delete(`/labs/${id}`),
    // Item types
    getItemTypes: () => api.get('/labs/item-types'),
    // Items (inventory)
    getItems: (labId, type) => api.get(`/labs/${labId}/items`, { params: type ? { type } : {} }),
    getAllPCs: () => api.get('/labs/items/pcs'),
    createItem: (labId, data) => api.post(`/labs/${labId}/items`, data),
    updateItem: (labId, itemId, data) => api.put(`/labs/${labId}/items/${itemId}`, data),
    deleteItem: (labId, itemId) => api.delete(`/labs/${labId}/items/${itemId}`),
    // Reports
    getInventoryReports: () => api.get('/labs/inventory-reports'),
    // Image upload
    uploadImage: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/labs/upload-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    // Import history
    getImportHistory: () => api.get('/labs/import-history'),
    saveImportHistory: (labId, data) => api.post(`/labs/${labId}/import-history`, data),
    // Maintenance history
    getMaintenanceHistory: (itemId) => api.get(`/labs/items/${itemId}/maintenance`),
    addMaintenanceRecord: (itemId, data) => api.post(`/labs/items/${itemId}/maintenance`, data),
    // Group assignment
    assignPcToGroup: (groupId, pcId) => api.put(`/labs/groups/${groupId}/assign-pc`, { pcId }),
    // Equipment Shifting
    createShiftRequest: (itemId, toLabId, reason) => api.post('/labs/shift-requests', { itemId, toLabId, reason }),
    getShiftRequests: (params) => api.get('/labs/shift-requests', { params }),
    approveShiftRequest: (requestId, adminNotes) => api.put(`/labs/shift-requests/${requestId}/approve`, { adminNotes }),
    rejectShiftRequest: (requestId, adminNotes) => api.put(`/labs/shift-requests/${requestId}/reject`, { adminNotes }),
    completeShiftRequest: (requestId, notes) => api.put(`/labs/shift-requests/${requestId}/complete`, { notes }),
    getItemShiftHistory: (itemId) => api.get(`/labs/items/${itemId}/shift-history`),
};

// Users API
export const usersAPI = {
    getAll: (params) => api.get('/users', { params }),
    getById: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
    searchStudents: (query) => api.get('/users/search/students', { params: { query } }),
};

// Dashboard API
export const dashboardAPI = {
    getStats: () => api.get('/dashboard/stats'),
    getActivity: () => api.get('/dashboard/activity'),
    getDeadlines: () => api.get('/dashboard/deadlines'),
    getHealth: () => api.get('/dashboard/health'),
};

// Reports API
export const reportsAPI = {
    getStudentProgress: (studentId) => api.get(`/reports/student-progress/${studentId}`),
    getClassSummary: (classId, params) => api.get(`/reports/class-summary/${classId}`, { params }),
    getAssignmentAnalytics: (assignmentId) => api.get(`/reports/assignment-analytics/${assignmentId}`),
};

// Notifications API
export const notificationsAPI = {
    getAll: (params) => api.get('/notifications', { params }),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put('/notifications/read-all'),
    getUnreadCount: () => api.get('/notifications/unread-count'),
};

// Profile API
export const profileAPI = {
    get: () => api.get('/auth/me'),
    update: (data) => api.put('/auth/profile', data),
    updatePassword: (data) => api.put('/auth/password', data),
    uploadAvatar: (file) => {
        const formData = new FormData();
        formData.append('avatar', file);
        return api.post('/auth/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};

// Grade Scales API
export const gradeScalesAPI = {
    getAll: () => api.get('/grade-scales'),
    getAllIncludingInactive: () => api.get('/grade-scales/all'),
    getHistory: (params) => api.get('/grade-scales/history', { params }),
    create: (data) => api.post('/grade-scales', data),
    update: (id, data) => api.put(`/grade-scales/${id}`, data),
    delete: (id) => api.delete(`/grade-scales/${id}`),
    reset: () => api.post('/grade-scales/reset'),
};

// Academic Years API
export const academicYearsAPI = {
    getAll: (params) => api.get('/schools/academic-years', { params }),
    getCurrent: () => api.get('/schools/academic-years/current'),
    create: (data) => api.post('/schools/academic-years', data),
    update: (id, data) => api.put(`/schools/academic-years/${id}`, data),
    setCurrent: (id) => api.put(`/schools/academic-years/${id}/set-current`),
};

// Admin API (Student import/export)
export const adminAPI = {
    getStats: () => api.get('/admin/stats'),
    importStudents: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/admin/students/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    exportStudentsCSV: (params) => api.get('/admin/students/export/csv', {
        params,
        responseType: 'blob'
    }),
    exportStudentsPDF: (params) => api.get('/admin/students/export/pdf', {
        params,
        responseType: 'blob'
    }),
    downloadTemplate: () => api.get('/admin/students/template', {
        responseType: 'blob'
    }),
    bulkAssignStudents: (studentIds, classId) => api.post('/admin/students/bulk-assign', {
        studentIds, classId
    }),
    generatePin: (userId) => api.post(`/pin/${userId}/generate-pin`),
};

export default api;

