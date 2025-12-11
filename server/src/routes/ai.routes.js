const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Predefined practical suggestions by subject/programming language
const PRACTICAL_SUGGESTIONS = {
    // Computer Science / Programming
    'c': [
        { title: 'Hello World Program', description: 'Write a program to display "Hello World"', difficulty: 'easy' },
        { title: 'Sum of Two Numbers', description: 'Accept two numbers and display their sum', difficulty: 'easy' },
        { title: 'Check Prime Number', description: 'Write a program to check if a number is prime', difficulty: 'medium' },
        { title: 'Fibonacci Series', description: 'Generate Fibonacci series up to n terms', difficulty: 'medium' },
        { title: 'Factorial Calculation', description: 'Calculate factorial of a number using recursion', difficulty: 'medium' },
        { title: 'Palindrome Check', description: 'Check if a string is palindrome', difficulty: 'medium' },
        { title: 'Array Sorting', description: 'Implement Bubble Sort algorithm', difficulty: 'medium' },
        { title: 'Matrix Operations', description: 'Add and multiply two matrices', difficulty: 'hard' },
        { title: 'File Handling', description: 'Read and write data to a file', difficulty: 'hard' },
        { title: 'Linked List Implementation', description: 'Create and traverse a singly linked list', difficulty: 'hard' }
    ],
    'cpp': [
        { title: 'Hello World in C++', description: 'Write a program using cout to display "Hello World"', difficulty: 'easy' },
        { title: 'Class and Objects', description: 'Create a class with constructors and methods', difficulty: 'medium' },
        { title: 'Inheritance Demo', description: 'Demonstrate single and multilevel inheritance', difficulty: 'medium' },
        { title: 'Polymorphism', description: 'Implement function overloading and overriding', difficulty: 'medium' },
        { title: 'Operator Overloading', description: 'Overload arithmetic operators for a class', difficulty: 'hard' },
        { title: 'Templates', description: 'Create a generic function using templates', difficulty: 'hard' },
        { title: 'Exception Handling', description: 'Implement try-catch blocks for error handling', difficulty: 'medium' },
        { title: 'File I/O with Streams', description: 'Read and write to files using fstream', difficulty: 'medium' },
        { title: 'STL Containers', description: 'Use vector, map, and set from STL', difficulty: 'hard' },
        { title: 'Virtual Functions', description: 'Demonstrate virtual functions and abstract classes', difficulty: 'hard' }
    ],
    'java': [
        { title: 'Hello World in Java', description: 'Create a basic Java program with main method', difficulty: 'easy' },
        { title: 'Arrays and Loops', description: 'Work with arrays using for-each loop', difficulty: 'easy' },
        { title: 'Class and Objects', description: 'Create a class with getters and setters', difficulty: 'medium' },
        { title: 'Inheritance', description: 'Demonstrate extends keyword with super class', difficulty: 'medium' },
        { title: 'Interface Implementation', description: 'Create and implement multiple interfaces', difficulty: 'medium' },
        { title: 'Exception Handling', description: 'Handle checked and unchecked exceptions', difficulty: 'medium' },
        { title: 'Collections Framework', description: 'Use ArrayList, HashMap, and HashSet', difficulty: 'hard' },
        { title: 'Multi-threading', description: 'Create threads using Runnable interface', difficulty: 'hard' },
        { title: 'JDBC Connection', description: 'Connect to database and perform CRUD operations', difficulty: 'hard' },
        { title: 'File Handling', description: 'Read and write files using BufferedReader/Writer', difficulty: 'medium' }
    ],
    'python': [
        { title: 'Hello World', description: 'Print "Hello World" using Python', difficulty: 'easy' },
        { title: 'Calculator Program', description: 'Create a simple calculator with basic operations', difficulty: 'easy' },
        { title: 'List Operations', description: 'Demonstrate list methods and comprehensions', difficulty: 'medium' },
        { title: 'Dictionary Usage', description: 'Create and manipulate dictionaries', difficulty: 'medium' },
        { title: 'Functions and Lambda', description: 'Create functions with default arguments and lambda', difficulty: 'medium' },
        { title: 'File Handling', description: 'Read, write, and append to files', difficulty: 'medium' },
        { title: 'Class and OOP', description: 'Create classes with inheritance and polymorphism', difficulty: 'medium' },
        { title: 'Exception Handling', description: 'Use try-except blocks with finally', difficulty: 'medium' },
        { title: 'Regular Expressions', description: 'Pattern matching using re module', difficulty: 'hard' },
        { title: 'Web Scraping', description: 'Extract data from websites using requests and BeautifulSoup', difficulty: 'hard' }
    ],
    'javascript': [
        { title: 'Hello World', description: 'Display "Hello World" using console.log', difficulty: 'easy' },
        { title: 'DOM Manipulation', description: 'Change HTML content dynamically', difficulty: 'easy' },
        { title: 'Event Handling', description: 'Handle click, submit, and keyboard events', difficulty: 'medium' },
        { title: 'Array Methods', description: 'Use map, filter, reduce, and forEach', difficulty: 'medium' },
        { title: 'Async/Await', description: 'Handle asynchronous operations with promises', difficulty: 'hard' },
        { title: 'Fetch API', description: 'Make HTTP requests to REST APIs', difficulty: 'medium' },
        { title: 'Local Storage', description: 'Store and retrieve data from localStorage', difficulty: 'medium' },
        { title: 'Form Validation', description: 'Validate form inputs before submission', difficulty: 'medium' },
        { title: 'Object Oriented JS', description: 'Create classes using ES6 syntax', difficulty: 'medium' },
        { title: 'Node.js Basics', description: 'Create a simple HTTP server', difficulty: 'hard' }
    ],
    'html_css': [
        { title: 'Personal Portfolio', description: 'Create a personal portfolio webpage', difficulty: 'easy' },
        { title: 'Responsive Navigation', description: 'Build a responsive navbar with hamburger menu', difficulty: 'medium' },
        { title: 'CSS Grid Layout', description: 'Create a photo gallery using CSS Grid', difficulty: 'medium' },
        { title: 'Flexbox Layout', description: 'Build a card layout using Flexbox', difficulty: 'medium' },
        { title: 'CSS Animations', description: 'Create animated buttons and transitions', difficulty: 'medium' },
        { title: 'Form Design', description: 'Design a beautiful contact form', difficulty: 'easy' },
        { title: 'Landing Page', description: 'Build a complete landing page with sections', difficulty: 'hard' },
        { title: 'CSS Variables', description: 'Use custom properties for theming', difficulty: 'medium' },
        { title: 'Responsive Design', description: 'Create a mobile-first responsive layout', difficulty: 'medium' },
        { title: 'Parallax Effect', description: 'Implement parallax scrolling effect', difficulty: 'hard' }
    ],
    'sql': [
        { title: 'Create Database', description: 'Create a database and tables', difficulty: 'easy' },
        { title: 'Basic Queries', description: 'Write SELECT, INSERT, UPDATE, DELETE queries', difficulty: 'easy' },
        { title: 'WHERE Clause', description: 'Filter data using WHERE conditions', difficulty: 'easy' },
        { title: 'JOIN Operations', description: 'Use INNER, LEFT, RIGHT, and FULL JOINs', difficulty: 'medium' },
        { title: 'Aggregate Functions', description: 'Use COUNT, SUM, AVG, MIN, MAX with GROUP BY', difficulty: 'medium' },
        { title: 'Subqueries', description: 'Write nested queries and correlated subqueries', difficulty: 'hard' },
        { title: 'Stored Procedures', description: 'Create and execute stored procedures', difficulty: 'hard' },
        { title: 'Triggers', description: 'Create triggers for automatic actions', difficulty: 'hard' },
        { title: 'Views', description: 'Create and use database views', difficulty: 'medium' },
        { title: 'Indexes', description: 'Create indexes to optimize queries', difficulty: 'medium' }
    ],
    // Science subjects
    'physics': [
        { title: 'Simple Pendulum', description: 'Verify the formula for time period of simple pendulum', difficulty: 'easy' },
        { title: 'Ohms Law Verification', description: 'Verify Ohms law using voltmeter and ammeter', difficulty: 'easy' },
        { title: 'Focal Length of Lens', description: 'Find focal length of convex lens', difficulty: 'medium' },
        { title: 'Meter Bridge', description: 'Measure unknown resistance using meter bridge', difficulty: 'medium' },
        { title: 'Sonometer', description: 'Study variation of frequency of stretched string', difficulty: 'hard' },
        { title: 'Prism Spectrum', description: 'Determine angle of minimum deviation', difficulty: 'medium' },
        { title: 'Potentiometer', description: 'Compare EMF of two cells using potentiometer', difficulty: 'hard' },
        { title: 'Resonance Tube', description: 'Find velocity of sound in air', difficulty: 'medium' },
        { title: 'Galvanometer', description: 'Convert galvanometer to ammeter/voltmeter', difficulty: 'hard' },
        { title: 'PN Junction Diode', description: 'Study I-V characteristics of PN junction diode', difficulty: 'medium' }
    ],
    'chemistry': [
        { title: 'Salt Analysis', description: 'Identify cation and anion in given salt', difficulty: 'medium' },
        { title: 'Volumetric Analysis', description: 'Determine strength of acid using titration', difficulty: 'medium' },
        { title: 'Chromatography', description: 'Separate pigments using paper chromatography', difficulty: 'easy' },
        { title: 'pH Determination', description: 'Find pH of various solutions', difficulty: 'easy' },
        { title: 'Electrochemical Cell', description: 'Set up electrochemical cell and measure EMF', difficulty: 'medium' },
        { title: 'Rate of Reaction', description: 'Study factors affecting rate of reaction', difficulty: 'hard' },
        { title: 'Crystallization', description: 'Prepare crystals of given salt', difficulty: 'easy' },
        { title: 'Oil Analysis', description: 'Determine saponification value of oil', difficulty: 'hard' },
        { title: 'Carbohydrate Tests', description: 'Identify carbohydrates using chemical tests', difficulty: 'medium' },
        { title: 'Protein Tests', description: 'Test for presence of proteins in food samples', difficulty: 'medium' }
    ],
    'biology': [
        { title: 'Microscopy', description: 'Study plant and animal cells under microscope', difficulty: 'easy' },
        { title: 'Mitosis Observation', description: 'Observe stages of mitosis in onion root tip', difficulty: 'medium' },
        { title: 'Osmosis Study', description: 'Demonstrate osmosis using potato osmometer', difficulty: 'easy' },
        { title: 'Photosynthesis', description: 'Show that oxygen is evolved during photosynthesis', difficulty: 'medium' },
        { title: 'Blood Group Test', description: 'Determine blood group using antiserum', difficulty: 'medium' },
        { title: 'Enzyme Activity', description: 'Study effect of temperature on enzyme activity', difficulty: 'hard' },
        { title: 'Heart Dissection', description: 'Study internal structure of mammalian heart', difficulty: 'hard' },
        { title: 'Stomata Study', description: 'Prepare temporary mount to observe stomata', difficulty: 'easy' },
        { title: 'DNA Extraction', description: 'Extract DNA from plant material', difficulty: 'hard' },
        { title: 'Transpiration', description: 'Measure rate of transpiration using potometer', difficulty: 'medium' }
    ]
};

/**
 * @route   GET /api/ai/practical-suggestions
 * @desc    Get AI-generated practical program suggestions based on subject/language
 * @access  Private (Instructor, Admin)
 */
router.get('/practical-suggestions', authenticate, authorize('instructor', 'admin', 'principal'), asyncHandler(async (req, res) => {
    const { subjectId, programmingLanguage, difficulty, count = 5 } = req.query;

    let suggestions = [];
    let languageKey = programmingLanguage?.toLowerCase() || '';

    // If subjectId provided, fetch subject details
    if (subjectId) {
        const subject = await prisma.subject.findUnique({
            where: { id: subjectId },
            select: { name: true, code: true }
        });

        if (subject) {
            const subjectName = subject.name.toLowerCase();
            // Map subject to suggestion category
            if (subjectName.includes('physics')) languageKey = 'physics';
            else if (subjectName.includes('chemistry')) languageKey = 'chemistry';
            else if (subjectName.includes('biology')) languageKey = 'biology';
            else if (subjectName.includes('computer') || subjectName.includes('programming')) {
                languageKey = languageKey || 'python'; // Default to Python for CS
            }
        }
    }

    // Get suggestions for the language/subject
    const allSuggestions = PRACTICAL_SUGGESTIONS[languageKey] || PRACTICAL_SUGGESTIONS['python'];

    // Filter by difficulty if specified
    if (difficulty) {
        suggestions = allSuggestions.filter(s => s.difficulty === difficulty);
    } else {
        suggestions = [...allSuggestions];
    }

    // Limit count
    suggestions = suggestions.slice(0, parseInt(count));

    // Add programming language info
    suggestions = suggestions.map((s, index) => ({
        ...s,
        experimentNumber: `EXP-${String(index + 1).padStart(2, '0')}`,
        programmingLanguage: languageKey,
        estimatedTime: s.difficulty === 'easy' ? '30 mins' : s.difficulty === 'medium' ? '60 mins' : '90 mins'
    }));

    res.json({
        success: true,
        data: {
            suggestions,
            availableLanguages: Object.keys(PRACTICAL_SUGGESTIONS),
            totalAvailable: allSuggestions.length
        }
    });
}));

/**
 * @route   GET /api/ai/programming-languages
 * @desc    Get list of available programming languages for suggestions
 * @access  Private
 */
router.get('/programming-languages', authenticate, asyncHandler(async (req, res) => {
    const languages = [
        { value: 'c', label: 'C Programming', category: 'programming' },
        { value: 'cpp', label: 'C++', category: 'programming' },
        { value: 'java', label: 'Java', category: 'programming' },
        { value: 'python', label: 'Python', category: 'programming' },
        { value: 'javascript', label: 'JavaScript', category: 'programming' },
        { value: 'html_css', label: 'HTML/CSS', category: 'web' },
        { value: 'sql', label: 'SQL/Database', category: 'database' },
        { value: 'physics', label: 'Physics Lab', category: 'science' },
        { value: 'chemistry', label: 'Chemistry Lab', category: 'science' },
        { value: 'biology', label: 'Biology Lab', category: 'science' }
    ];

    res.json({
        success: true,
        data: { languages }
    });
}));

/**
 * @route   POST /api/ai/generate-aim
 * @desc    Generate aim and procedure for a practical title
 * @access  Private (Instructor, Admin)
 */
router.post('/generate-aim', authenticate, authorize('instructor', 'admin', 'principal'), asyncHandler(async (req, res) => {
    const { title, programmingLanguage, description } = req.body;

    // Generate structured content based on title and language
    const langKey = programmingLanguage?.toLowerCase() || 'python';

    // Template-based generation (can be replaced with actual AI API call)
    const generated = {
        aim: `To ${description || title.toLowerCase()}`,
        theory: generateTheory(title, langKey),
        procedure: generateProcedure(title, langKey),
        expectedOutput: generateExpectedOutput(title, langKey)
    };

    res.json({
        success: true,
        data: generated
    });
}));

// Helper functions for content generation
function generateTheory(title, language) {
    const theories = {
        'Hello World': 'A "Hello World" program is the traditional first program written when learning a new programming language. It introduces the basic syntax for output operations.',
        'Fibonacci': 'The Fibonacci sequence is a series where each number is the sum of the two preceding ones. It appears frequently in mathematics and nature.',
        'Prime': 'A prime number is a natural number greater than 1 that is only divisible by 1 and itself. Prime numbers are fundamental in number theory.',
        'Palindrome': 'A palindrome is a string that reads the same forward and backward. Palindrome checking teaches string manipulation techniques.',
        'default': 'This practical demonstrates fundamental programming concepts and problem-solving techniques that are essential for software development.'
    };

    for (const [key, theory] of Object.entries(theories)) {
        if (title.toLowerCase().includes(key.toLowerCase())) {
            return theory;
        }
    }
    return theories.default;
}

function generateProcedure(title, language) {
    return `1. Open your ${getLanguageIDE(language)} development environment
2. Create a new file with appropriate extension
3. Write the necessary code to ${title.toLowerCase()}
4. Compile/Run the program
5. Verify the output matches expected results
6. Test with different inputs
7. Document observations and conclusions`;
}

function generateExpectedOutput(title, language) {
    if (title.toLowerCase().includes('hello')) {
        return 'Hello World';
    } else if (title.toLowerCase().includes('fibonacci')) {
        return '0, 1, 1, 2, 3, 5, 8, 13, 21, 34...';
    } else if (title.toLowerCase().includes('prime')) {
        return 'Number is Prime / Number is Not Prime';
    }
    return 'Program executes successfully with expected results';
}

function getLanguageIDE(language) {
    const ides = {
        'c': 'GCC/Turbo C',
        'cpp': 'GCC/Visual Studio',
        'java': 'Eclipse/IntelliJ IDEA',
        'python': 'Python IDLE/VS Code',
        'javascript': 'VS Code/Browser Console',
        'html_css': 'VS Code/Notepad++',
        'sql': 'MySQL Workbench/pgAdmin'
    };
    return ides[language] || 'IDE';
}

module.exports = router;
