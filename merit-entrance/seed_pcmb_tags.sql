-- Insert Common Topics and Tags for PCMB (X, XI, XII)
INSERT INTO "tags" ("name") VALUES
-- Subjects & Levels
('Physics'), ('Chemistry'), ('Mathematics'), ('Biology'),
('Science'), ('Class X'), ('Class XI'), ('Class XII'),

-- Physics (Class XI-XII)
('Units and Measurements'), ('Motion in a Straight Line'), ('Motion in a Plane'),
('Laws of Motion'), ('Work, Energy and Power'), ('Rotational Motion'),
('Gravitation'), ('Mechanical Properties of Solids'), ('Mechanical Properties of Fluids'),
('Thermal Properties of Matter'), ('Thermodynamics'), ('Kinetic Theory'),
('Oscillations'), ('Waves'), ('Electric Charges and Fields'),
('Electrostatic Potential and Capacitance'), ('Current Electricity'),
('Moving Charges and Magnetism'), ('Magnetism and Matter'), ('Electromagnetic Induction'),
('Alternating Current'), ('Electromagnetic Waves'), ('Ray Optics and Optical Instruments'),
('Wave Optics'), ('Dual Nature of Radiation and Matter'), ('Atoms'), ('Nuclei'),
('Semiconductor Electronics'), ('Communication Systems'),

-- Chemistry (Class XI-XII)
('Some Basic Concepts of Chemistry'), ('Structure of Atom'),
('Classification of Elements and Periodicity in Properties'),
('Chemical Bonding and Molecular Structure'), ('States of Matter'),
('Thermodynamics (Chemistry)'), ('Equilibrium'), ('Redox Reactions'), ('Hydrogen'),
('The s-Block Elements'), ('The p-Block Elements'),
('Organic Chemistry - Some Basic Principles and Techniques'), ('Hydrocarbons'),
('Environmental Chemistry'), ('The Solid State'), ('Solutions'), ('Electrochemistry'),
('Chemical Kinetics'), ('Surface Chemistry'),
('General Principles and Processes of Isolation of Elements'),
('The d- and f- Block Elements'), ('Coordination Compounds'), ('Haloalkanes and Haloarenes'),
('Alcohols, Phenols and Ethers'), ('Aldehydes, Ketones and Carboxylic Acids'), ('Amines'),
('Biomolecules'), ('Polymers'), ('Chemistry in Everyday Life'),

-- Mathematics (Class XI-XII)
('Sets'), ('Relations and Functions'), ('Trigonometric Functions'),
('Principle of Mathematical Induction'), ('Complex Numbers and Quadratic Equations'),
('Linear Inequalities'), ('Permutations and Combinations'), ('Binomial Theorem'),
('Sequences and Series'), ('Straight Lines'), ('Conic Sections'),
('Introduction to Three Dimensional Geometry'), ('Limits and Derivatives'),
('Mathematical Reasoning'), ('Statistics'), ('Probability'),
('Inverse Trigonometric Functions'), ('Matrices'), ('Determinants'),
('Continuity and Differentiability'), ('Application of Derivatives'),
('Integrals'), ('Application of Integrals'), ('Differential Equations'),
('Vector Algebra'), ('Three Dimensional Geometry'), ('Linear Programming'),

-- Biology (Class XI-XII)
('The Living World'), ('Biological Classification'), ('Plant Kingdom'), ('Animal Kingdom'),
('Morphology of Flowering Plants'), ('Anatomy of Flowering Plants'),
('Structural Organisation in Animals'), ('Cell: The Unit of Life'),
('Cell Cycle and Cell Division'), ('Transport in Plants'), ('Mineral Nutrition'),
('Photosynthesis in Higher Plants'), ('Respiration in Plants'),
('Plant Growth and Development'), ('Digestion and Absorption'),
('Breathing and Exchange of Gases'), ('Body Fluids and Circulation'),
('Excretory Products and their Elimination'), ('Locomotion and Movement'),
('Neural Control and Coordination'), ('Chemical Coordination and Integration'),
('Reproduction in Organisms'), ('Sexual Reproduction in Flowering Plants'),
('Human Reproduction'), ('Reproductive Health'), ('Principles of Inheritance and Variation'),
('Molecular Basis of Inheritance'), ('Evolution'), ('Human Health and Disease'),
('Strategies for Enhancement in Food Production'), ('Microbes in Human Welfare'),
('Biotechnology: Principles and Processes'), ('Biotechnology and its Applications'),
('Organisms and Populations'), ('Ecosystem'), ('Biodiversity and Conservation'),
('Environmental Issues'),

-- Class X Topics (Foundational)
('Chemical Reactions and Equations'), ('Acids, Bases and Salts'), ('Metals and Non-metals'),
('Carbon and its Compounds'), ('Periodic Classification of Elements'),
('Life Processes'), ('Control and Coordination'), ('How do Organisms Reproduce?'),
('Heredity and Evolution'), ('Light - Reflection and Refraction'), ('The Human Eye and the Colourful World'),
('Electricity'), ('Magnetic Effects of Electric Current'), ('Sources of Energy'),
('Our Environment'), ('Sustainable Management of Natural Resources'),
('Real Numbers'), ('Polynomials'), ('Pair of Linear Equations in Two Variables'),
('Quadratic Equations'), ('Arithmetic Progressions'), ('Triangles'), ('Coordinate Geometry'),
('Introduction to Trigonometry'), ('Some Applications of Trigonometry'), ('Circles'),
('Constructions'), ('Areas Related to Circles'), ('Surface Areas and Volumes'), ('Statistics and Probability')

ON CONFLICT ("name") DO NOTHING;
