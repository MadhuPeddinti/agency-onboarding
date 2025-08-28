const express = require("express");
const mysql = require("mysql2/promise");
const Joi = require("joi");
const multer = require("multer");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(
      __dirname,
      "uploads",
      req.params.request_uuid || "temp"
    );
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "agency_onboarding",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
};

let pool;

// Database connection with retry logic
const connectToDatabase = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(
        `🔄 Attempting to connect to database (attempt ${i + 1}/${retries})...`
      );

      // First, connect without database
      const tempConfig = {
        ...dbConfig,
        user: "root",
        password: process.env.MYSQL_ROOT_PASSWORD,
      };
      // delete tempConfig.database;
      const tempConnection = await mysql.createConnection(tempConfig);

      // ✅ Create database if it doesn't exist
      await tempConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``
      );
      console.log(`📊 Ensured database exists: ${dbConfig.database}`);

      await tempConnection.end();

      // ✅ Now connect to the actual database with a pool
      pool = mysql.createPool(dbConfig);

      // Test the connection
      const connection = await pool.getConnection();
      await connection.query("SELECT 1");
      connection.release();

      console.log(
        `✅ Successfully connected to MySQL database: ${dbConfig.database}`
      );
      return true;
    } catch (error) {
      console.error(
        `❌ Database connection attempt ${i + 1} failed:`,
        error.message
      );

      if (i === retries - 1) {
        throw new Error(
          `Failed to connect to database after ${retries} attempts: ${error.message}`
        );
      }

      console.log(`⏳ Waiting ${delay}ms before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Check if tables exist
const checkTablesExist = async () => {
  try {
    const connection = await pool.getConnection();
    const [tables] = await connection.execute(
      `
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'applications'
    `,
      [dbConfig.database]
    );

    connection.release();
    return tables[0].count > 0;
  } catch (error) {
    console.error("Error checking tables:", error);
    return false;
  }
};

// Create tables function
const createTables = async () => {
  try {
    console.log("🏗️  Creating database tables...");

    const connection = await pool.getConnection();

    // Applications table
    // await connection.execute(`
    //   CREATE TABLE IF NOT EXISTS applications (
    //     id INT PRIMARY KEY AUTO_INCREMENT,
    //     request_uuid VARCHAR(36) UNIQUE NOT NULL,
    //     agent_type ENUM('INDIVIDUAL', 'CORPORATE') NOT NULL,
    //     current_step INT DEFAULT 0,
    //     status ENUM('IN_PROGRESS', 'COMPLETED', 'REJECTED') DEFAULT 'IN_PROGRESS',
    //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    //     INDEX idx_request_uuid (request_uuid),
    //     INDEX idx_status (status),
    //     INDEX idx_created_at (created_at)
    //   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    // `);

    // Firm details table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS firm_details (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_uuid VARCHAR(36) NOT NULL,
        firm_name VARCHAR(255) NOT NULL,
        registration_number VARCHAR(100),
        pan_number VARCHAR(10) NOT NULL,
        gst_number VARCHAR(15),
        correspondence_address JSON NOT NULL,
        permanent_address JSON NOT NULL,
        email_address VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(15) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_request_uuid (request_uuid),
        INDEX idx_pan_number (pan_number),
        INDEX idx_email (email_address),
        FOREIGN KEY (request_uuid) REFERENCES applications(request_uuid) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Personnel table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS personnel (
        id INT PRIMARY KEY AUTO_INCREMENT,
        personnel_id VARCHAR(36) UNIQUE NOT NULL,
        request_uuid VARCHAR(36) NOT NULL,
        title VARCHAR(10),
        name VARCHAR(255) NOT NULL,
        father_name VARCHAR(255),
        mother_name VARCHAR(255),
        date_of_birth DATE,
        wealth_tax_registration ENUM('Yes', 'No'),
        wealth_tax_registration_details VARCHAR(255),
        ibbi_registration_number VARCHAR(100),
        pan_number VARCHAR(10) NOT NULL,
        aadhaar_number VARCHAR(12),
        passport_number VARCHAR(20),
        gst_number VARCHAR(15),
        correspondence_address JSON,
        permanent_address JSON,
        email_address VARCHAR(255),
        mobile_number VARCHAR(15),
        photo_upload VARCHAR(255),
        is_same_as_correspondence BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_request_uuid (request_uuid),
        INDEX idx_pan_number (pan_number),
        INDEX idx_aadhaar (aadhaar_number),
        FOREIGN KEY (request_uuid) REFERENCES applications(request_uuid) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Educational qualifications
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS educational_qualifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        personnel_id VARCHAR(36) NOT NULL,
        qualification VARCHAR(255) NOT NULL,
        year_of_passing INT,
        marks_percent DECIMAL(5,2),
        grade_class VARCHAR(50),
        university_college VARCHAR(255),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_personnel_id (personnel_id),
        FOREIGN KEY (personnel_id) REFERENCES personnel(personnel_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Professional qualifications
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS professional_qualifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        personnel_id VARCHAR(36) NOT NULL,
        qualification VARCHAR(255) NOT NULL,
        institute VARCHAR(255),
        membership_no VARCHAR(100),
        date_of_enrolment DATE,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_personnel_id (personnel_id),
        INDEX idx_membership_no (membership_no),
        FOREIGN KEY (personnel_id) REFERENCES personnel(personnel_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Experience details
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS experience_details (
        id INT PRIMARY KEY AUTO_INCREMENT,
        personnel_id VARCHAR(36) NOT NULL,
        currently_in_practice_or_employment ENUM('Yes', 'No'),
        years_in_practice INT,
        practice_address TEXT,
        years_in_employment INT,
        months_in_employment INT,
        evidence_files JSON,
        from_date DATE,
        to_date DATE,
        employment_or_practice VARCHAR(100),
        employer_name_and_designation VARCHAR(255),
        practice_experience VARCHAR(255),
        area_of_work TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_personnel_id (personnel_id),
        FOREIGN KEY (personnel_id) REFERENCES personnel(personnel_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Background information
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS background_information (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_uuid VARCHAR(36) NOT NULL,
        convicted_offence ENUM('Yes', 'No') DEFAULT 'No',
        convicted_offence_details TEXT,
        criminal_proceedings ENUM('Yes', 'No') DEFAULT 'No',
        criminal_proceedings_details TEXT,
        undischarged_bankrupt ENUM('Yes', 'No') DEFAULT 'No',
        undischarged_bankrupt_details TEXT,
        additional_information TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_request_uuid (request_uuid),
        FOREIGN KEY (request_uuid) REFERENCES applications(request_uuid) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Attachments
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_uuid VARCHAR(36) NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_request_uuid (request_uuid),
        INDEX idx_document_type (document_type),
        FOREIGN KEY (request_uuid) REFERENCES applications(request_uuid) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    connection.release();
    console.log(
      "✅ All database tables created successfully with proper indexes"
    );
  } catch (error) {
    console.error("❌ Error creating tables:", error);
    throw error;
  }
};

// Initialize database
const initializeDatabase = async () => {
  try {
    await connectToDatabase();

    const tablesExist = await checkTablesExist();

    if (!tablesExist) {
      console.log("📋 Tables not found, creating new tables...");
      await createTables();
    } else {
      console.log("📋 Tables already exist, skipping creation...");
    }
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
};

// Your existing API routes go here (same as before)
// ... [Include all the API routes from the previous code]

// Health check endpoint with database status
app.get("/health", async (req, res) => {
  try {
    // Test database connection
    const connection = await pool.getConnection();
    await connection.execute("SELECT 1");
    connection.release();

    res.status(200).json({
      success: true,
      message: "API is running",
      database: "Connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "API is running but database is unavailable",
      database: "Disconnected",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");

  if (pool) {
    await pool.end();
    console.log("📊 Database connections closed");
  }

  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");

  if (pool) {
    await pool.end();
    console.log("📊 Database connections closed");
  }

  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    await initializeDatabase();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log("🚀 =================================");
      console.log(`🚀 Agency Onboarding API is running`);
      console.log(`🚀 Port: ${PORT}`);
      console.log(`🚀 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🚀 Database: ${dbConfig.database}`);
      console.log(`🚀 Health Check: http://localhost:${PORT}/health`);
      console.log("🚀 =================================");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();
