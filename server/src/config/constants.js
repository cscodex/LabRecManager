module.exports = {
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    },

    upload: {
        dir: process.env.UPLOAD_DIR || './uploads',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
        allowedTypes: {
            document: ['pdf', 'doc', 'docx', 'txt', 'md'],
            code: ['py', 'java', 'cpp', 'c', 'js', 'html', 'css', 'sql', 'json'],
            image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            archive: ['zip', 'rar', '7z']
        }
    },

    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    },

    grading: {
        gradeScale: [
            { letter: 'A+', minPercent: 90, points: 10 },
            { letter: 'A', minPercent: 80, points: 9 },
            { letter: 'B+', minPercent: 70, points: 8 },
            { letter: 'B', minPercent: 60, points: 7 },
            { letter: 'C+', minPercent: 50, points: 6 },
            { letter: 'C', minPercent: 40, points: 5 },
            { letter: 'D', minPercent: 33, points: 4 },
            { letter: 'F', minPercent: 0, points: 0 }
        ]
    },

    supportedLanguages: [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
        { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
        { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
        { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
        { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
        { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
        { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
        { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
        { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
        { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
        { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' }
    ],

    schoolBoards: [
        { code: 'CBSE', name: 'Central Board of Secondary Education' },
        { code: 'ICSE', name: 'Indian Certificate of Secondary Education' },
        { code: 'STATE', name: 'State Board' },
        { code: 'IB', name: 'International Baccalaureate' },
        { code: 'IGCSE', name: 'International General Certificate of Secondary Education' }
    ],

    indianStates: [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
        'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
        'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
        'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
        'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ]
};
