// server.js
const express = require("express");
const mysql = require("mysql2/promise");
const multer = require("multer");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
require("dotenv").config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ========= DB connection pool setup (same as before) =========

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
const connectToDatabase = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(
        `🔄 Attempting to connect to database (attempt ${i + 1}/${retries})...`
      );

      const tempConfig = {
        host: dbConfig.host,
        user: "root",
        password: process.env.MYSQL_ROOT_PASSWORD,
        port: dbConfig.port || 3306,
      };
      const tempConnection = await mysql.createConnection(tempConfig);

      await tempConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``
      );

      // Create user if needed here i should not do use te root credentials but for temperary use i have used like this
      await tempConnection.query(
        `CREATE USER IF NOT EXISTS '${dbConfig.user}'@'%' IDENTIFIED WITH mysql_native_password BY '${dbConfig.password}'`
      );
      await tempConnection.query(
        `GRANT ALL PRIVILEGES ON \`${dbConfig.database}\`.* TO '${dbConfig.user}'@'%'`
      );
      await tempConnection.query(`FLUSH PRIVILEGES`);

      await tempConnection.end();
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

const createTables = async () => {
  const connection = await pool.getConnection();

  // Applications table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      uuid VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
      agent_type VARCHAR(20) NOT NULL,
      current_step INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'IN_PROGRESS',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Firm details table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS firm_details (
      id INT PRIMARY KEY AUTO_INCREMENT,
      app_id VARCHAR(36) NOT NULL,
      firm_name VARCHAR(255) NOT NULL,
      registration_number VARCHAR(100),
      pan_number VARCHAR(10) NOT NULL,
      gst_number VARCHAR(15),

      -- Mandatory correspondence address fields
      correspondence_address_line1 VARCHAR(255) NOT NULL,
      correspondence_address_line2 VARCHAR(255),
      correspondence_city VARCHAR(100) NOT NULL,
      correspondence_state VARCHAR(100) NOT NULL,
      correspondence_pincode VARCHAR(10) NOT NULL,
      correspondence_extra JSON,

      -- Mandatory permanent address fields
      permanent_address_line1 VARCHAR(255) NOT NULL,
      permanent_address_line2 VARCHAR(255),
      permanent_city VARCHAR(100) NOT NULL,
      permanent_state VARCHAR(100) NOT NULL,
      permanent_pincode VARCHAR(10) NOT NULL,
      permanent_extra JSON,

      email_address VARCHAR(255) NOT NULL,
      mobile_number VARCHAR(15) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY unique_app_id (app_id),
      INDEX idx_pan_number (pan_number),
      INDEX idx_email (email_address),
      FOREIGN KEY (app_id) REFERENCES applications(uuid) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Personnel table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS personnel (
        id INT PRIMARY KEY AUTO_INCREMENT,
        personnel_id VARCHAR(36) UNIQUE NOT NULL,
        app_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        title VARCHAR(10),
        name VARCHAR(255) NOT NULL,
        father_name VARCHAR(255),
        mother_name VARCHAR(255),
        date_of_birth DATE,
        wealth_tax_registration VARCHAR(20),
        wealth_tax_registration_details VARCHAR(255),
        ibbi_registration_number VARCHAR(100),
        pan_number VARCHAR(10) NOT NULL,
        aadhaar_number VARCHAR(12),
        passport_number VARCHAR(20),
        gst_number VARCHAR(15),

        -- Mandatory correspondence address fields
        correspondence_address_line1 VARCHAR(255) NOT NULL,
        correspondence_address_line2 VARCHAR(255),
        correspondence_city VARCHAR(100) NOT NULL,
        correspondence_state VARCHAR(100) NOT NULL,
        correspondence_pincode VARCHAR(10) NOT NULL,
        correspondence_extra JSON,

        -- Mandatory permanent address fields
        permanent_address_line1 VARCHAR(255) NOT NULL,
        permanent_address_line2 VARCHAR(255),
        permanent_city VARCHAR(100) NOT NULL,
        permanent_state VARCHAR(100) NOT NULL,
        permanent_pincode VARCHAR(10) NOT NULL,
        permanent_extra JSON,

        email_address VARCHAR(255),
        mobile_number VARCHAR(15),
        photo_upload VARCHAR(255),
        is_same_as_correspondence BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_app_id (app_id),
        INDEX idx_pan_number (pan_number),
        INDEX idx_aadhaar (aadhaar_number),
        FOREIGN KEY (app_id) REFERENCES applications(uuid) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  `);

  // Educational qualifications table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS educational_qualifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        app_id VARCHAR(36) NOT NULL,
        personnel_id VARCHAR(36) NOT NULL,
        qualification VARCHAR(255) NOT NULL,
        year_of_passing INT,
        marks_percent DECIMAL(5,2),
        grade_class VARCHAR(50),
        university_college VARCHAR(255),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_personnel_id (personnel_id),
        FOREIGN KEY (app_id) REFERENCES applications(uuid) ON DELETE CASCADE,
        FOREIGN KEY (personnel_id) REFERENCES personnel(personnel_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  `);

  // Professional qualifications table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS professional_qualifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        app_id VARCHAR(36) NOT NULL,
        personnel_id VARCHAR(36) NOT NULL,
        qualification VARCHAR(255) NOT NULL,
        institute VARCHAR(255),
        membership_no VARCHAR(100),
        date_of_enrolment DATE,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_personnel_id (personnel_id),
        INDEX idx_membership_no (membership_no),
        FOREIGN KEY (app_id) REFERENCES applications(uuid) ON DELETE CASCADE,
        FOREIGN KEY (personnel_id) REFERENCES personnel(personnel_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  `);

  // Experience details table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS experience_details (
        id INT PRIMARY KEY AUTO_INCREMENT,
        app_id VARCHAR(36) NOT NULL,
        personnel_id VARCHAR(36) NOT NULL,
        currently_in_practice_or_employment VARCHAR(20),
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
        
        INDEX idx_app_id (app_id),
        INDEX idx_personnel_id (personnel_id),
        FOREIGN KEY (app_id) REFERENCES applications(uuid) ON DELETE CASCADE,
        FOREIGN KEY (personnel_id) REFERENCES personnel(personnel_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  `);

  // Background information table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS background_information (
        id INT PRIMARY KEY AUTO_INCREMENT,
        app_id VARCHAR(36) NOT NULL,
        convicted_offence VARCHAR(20),
        convicted_offence_details TEXT,
        criminal_proceedings VARCHAR(20),
        criminal_proceedings_details TEXT,
        undischarged_bankrupt VARCHAR(20),
        undischarged_bankrupt_details TEXT,
        additional_information TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_app_id (app_id),
        FOREIGN KEY (app_id) REFERENCES applications(uuid) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  `);

  // Attachments table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS attachments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        app_id VARCHAR(36) NOT NULL,
        personnel_id VARCHAR(36) NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_app_id (app_id),
        INDEX idx_document_type (document_type),
        FOREIGN KEY (app_id) REFERENCES applications(uuid) ON DELETE CASCADE,
        FOREIGN KEY (personnel_id) REFERENCES personnel(personnel_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await connection.execute(`
      INSERT IGNORE INTO applications (uuid, agent_type, status) VALUES 
      ('e10906df-3ea3-4aec-820f-1845736ad049', 'INDIVIDUAL', 'IN_PROGRESS'),
      ('c7039573-d573-4f83-9a35-e69d5b7b87fb', 'CORPORATE', 'IN_PROGRESS');
  `);

  connection.release();
  console.log("📋 All tables created/verified.");
};

// ========= Health check (same as before) =========
app.get("/health", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute("SELECT 1");
    connection.release();
    res.json({ success: true, database: "Connected" });
  } catch (e) {
    res.status(500).json({ success: false, database: "Disconnected" });
  }
});

// ========= Onboarding Routes =========
const stepValidations = {
  0: Joi.object({
    step_number: Joi.alternatives()
      .try(Joi.number().valid(0), Joi.string().valid("0"))
      .required(),
    action: Joi.string().valid("SAVE").required(),
    form_data: Joi.alternatives()
      .try(
        Joi.string(), // JSON string from multipart
        Joi.object({
          firmName: Joi.string().required(),
          registrationNumber: Joi.string().required(),
          panNumber: Joi.string()
            .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
            .required(),
          gstNumber: Joi.string().optional().allow(""),
          correspondenceAddress: Joi.object({
            addressLine1: Joi.string().required(),
            addressLine2: Joi.string().optional().allow(""),
            city: Joi.string().required(),
            state: Joi.string().required(),
            pincode: Joi.string()
              .pattern(/^[0-9]{6}$/)
              .required(),
          }).required(),
          permanentAddress: Joi.object({
            addressLine1: Joi.string().required(),
            addressLine2: Joi.string().optional().allow(""),
            city: Joi.string().required(),
            state: Joi.string().required(),
            pincode: Joi.string()
              .pattern(/^[0-9]{6}$/)
              .required(),
          }).required(),
          emailAddress: Joi.string().email().required(),
          mobileNumber: Joi.string()
            .pattern(/^[0-9]{10}$/)
            .required(),
        })
      )
      .required(),
  }),

  1: Joi.object({
    step_number: Joi.alternatives()
      .try(Joi.number().valid(1), Joi.string().valid("1"))
      .required(),
    action: Joi.string().valid("SAVE").required(),
    form_data: Joi.alternatives()
      .try(
        Joi.string(),
        Joi.object({
          personnel: Joi.array()
            .items(
              Joi.object({
                title: Joi.string().required(),
                name: Joi.string().required(),
                fatherName: Joi.string().optional().allow(""),
                motherName: Joi.string().optional().allow(""),
                dateOfBirth: Joi.date().required(),
                wealthTaxRegistration: Joi.string()
                  .valid("Yes", "No")
                  .optional(),
                wealthTaxRegistrationDetails: Joi.string().optional().allow(""),
                ibbiRegistrationNumber: Joi.string().optional().allow(""),
                panNumber: Joi.string()
                  .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
                  .required(),
                aadhaarNumber: Joi.string()
                  .pattern(/^[0-9]{12}$/)
                  .optional()
                  .allow(""),
                passportNumber: Joi.string().optional().allow(""),
                gstNumber: Joi.string().optional().allow(""),
                correspondenceAddress: Joi.object({
                  addressLine1: Joi.string().required(),
                  addressLine2: Joi.string().optional().allow(""),
                  city: Joi.string().required(),
                  state: Joi.string().required(),
                  pincode: Joi.string()
                    .pattern(/^[0-9]{6}$/)
                    .required(),
                }).required(),
                permanentAddress: Joi.object({
                  addressLine1: Joi.string().required(),
                  addressLine2: Joi.string().optional().allow(""),
                  city: Joi.string().required(),
                  state: Joi.string().required(),
                  pincode: Joi.string()
                    .pattern(/^[0-9]{6}$/)
                    .required(),
                }).required(),
                emailAddress: Joi.string().email().optional().allow(""),
                mobileNumber: Joi.string()
                  .pattern(/^[0-9]{10}$/)
                  .optional()
                  .allow(""),
                photoUpload: Joi.string().optional().allow(""),
                isSameAsCorrespondence: Joi.boolean().optional(),
              })
            )
            .required(),
        })
      )
      .required(),
  }),

  2: Joi.object({
    step_number: Joi.alternatives()
      .try(Joi.number().valid(2), Joi.string().valid("2"))
      .required(),
    action: Joi.string().valid("SAVE").required(),
    form_data: Joi.alternatives()
      .try(
        Joi.string(),
        Joi.object({
          personnel: Joi.array()
            .items(
              Joi.object({
                personnel_id: Joi.string().required(),
                educationalQualifications: Joi.array()
                  .items(
                    Joi.object({
                      qualification: Joi.string().required(),
                      yearOfPassing: Joi.alternatives()
                        .try(
                          Joi.number()
                            .integer()
                            .min(1900)
                            .max(new Date().getFullYear()),
                          Joi.string().pattern(/^[0-9]{4}$/)
                        )
                        .required(),
                      marksPercent: Joi.alternatives()
                        .try(
                          Joi.number().min(0).max(100),
                          Joi.string().pattern(/^[0-9]{1,3}(\.[0-9]{1,2})?$/)
                        )
                        .required(),
                      gradeClass: Joi.string().required(),
                      universityCollege: Joi.string().required(),
                      remarks: Joi.string().optional().allow(""),
                    })
                  )
                  .optional(),
                professionalQualifications: Joi.array()
                  .items(
                    Joi.object({
                      qualification: Joi.string().required(),
                      institute: Joi.string().required(),
                      membershipNo: Joi.string().required(),
                      dateOfEnrolment: Joi.date().required(),
                      remarks: Joi.string().optional().allow(""),
                    })
                  )
                  .optional(),
              })
            )
            .required(),
        })
      )
      .required(),
  }),

  3: Joi.object({
    step_number: Joi.alternatives()
      .try(Joi.number().valid(3), Joi.string().valid("3"))
      .required(),
    action: Joi.string().valid("SAVE").required(),
    form_data: Joi.alternatives()
      .try(
        Joi.string(),
        Joi.object({
          personnel: Joi.array()
            .items(
              Joi.object({
                personnel_id: Joi.string().required(),
                experienceDetails: Joi.array()
                  .items(
                    Joi.object({
                      currentlyInPracticeOrEmployment: Joi.string()
                        .optional()
                        .allow(""),
                      yearsInPractice: Joi.alternatives()
                        .try(
                          Joi.number().integer().min(0),
                          Joi.string().pattern(/^[0-9]+$/)
                        )
                        .optional(),
                      practiceAddress: Joi.string().optional().allow(""),
                      yearsInEmployment: Joi.alternatives()
                        .try(
                          Joi.number().integer().min(0),
                          Joi.string().pattern(/^[0-9]+$/)
                        )
                        .optional(),
                      monthsInEmployment: Joi.alternatives()
                        .try(
                          Joi.number().integer().min(0).max(11),
                          Joi.string().pattern(/^[0-9]+$/)
                        )
                        .optional(),
                      evidenceFiles: Joi.array().optional(),
                      fromDate: Joi.date().optional(),
                      toDate: Joi.date().optional(),
                      employmentOrPractice: Joi.string().optional().allow(""),
                      employerNameAndDesignation: Joi.string()
                        .optional()
                        .allow(""),
                      practiceExperience: Joi.string().optional().allow(""),
                      areaOfWork: Joi.string().optional().allow(""),
                    })
                  )
                  .optional(),
              })
            )
            .required(),
        })
      )
      .required(),
  }),

  4: Joi.object({
    step_number: Joi.alternatives()
      .try(Joi.number().valid(4), Joi.string().valid("4"))
      .required(),
    action: Joi.string().valid("SAVE").required(),
    form_data: Joi.alternatives()
      .try(
        Joi.string(),
        Joi.object({
          convictedOffence: Joi.string().valid("Yes", "No").required(),
          convictedOffenceDetails: Joi.string().optional().allow(""),
          criminalProceedings: Joi.string().valid("Yes", "No").required(),
          criminalProceedingsDetails: Joi.string().optional().allow(""),
          undischargedBankrupt: Joi.string().valid("Yes", "No").required(),
          undischargedBankruptDetails: Joi.string().optional().allow(""),
          additionalInformation: Joi.string().optional().allow(""),
        })
      )
      .required(),
  }),

  5: Joi.object({
    step_number: Joi.alternatives()
      .try(Joi.number().valid(5), Joi.string().valid("5"))
      .required(),
    action: Joi.string().valid("SUBMIT").required(),
    form_data: Joi.alternatives()
      .try(
        Joi.string(),
        Joi.object({
          ibbi_certificate: Joi.array().items(Joi.string()).required(),
          wealth_tax_certificate: Joi.array().items(Joi.string()).required(),
          valuers_org_membership: Joi.array().items(Joi.string()).required(),
          professional_bodies: Joi.array().items(Joi.string()).required(),
          kyc_documents: Joi.array().items(Joi.string()).required(),
          pan_card: Joi.array().items(Joi.string()).required(),
          address_proof: Joi.array().items(Joi.string()).required(),
          education_certificates: Joi.array().items(Joi.string()).required(),
          professional_certificates: Joi.array().items(Joi.string()).required(),
          experience_documents: Joi.array().items(Joi.string()).required(),
          employment_certificates: Joi.array().items(Joi.string()).required(),
          it_returns: Joi.array().items(Joi.string()).required(),
          gst_registration: Joi.array().items(Joi.string()).required(),
          cancelled_cheque: Joi.array().items(Joi.string()).required(),
          photographs: Joi.array().items(Joi.string()).required(),
          moa_aoa: Joi.array().items(Joi.string()).required(),
          partnership_deed: Joi.array().items(Joi.string()).required(),
          company_profile: Joi.array().items(Joi.string()).required(),
          board_resolution: Joi.array().items(Joi.string()).required(),
          authorized_signatory: Joi.array().items(Joi.string()).required(),
        })
      )
      .optional(),
  }),
};

// Utility functions
const getAgentType = async (connection, requestUuid) => {
  const [rows] = await connection.execute(
    "SELECT agent_type FROM applications WHERE uuid = ?",
    [requestUuid]
  );

  if (rows.length === 0) {
    return null; // Request UUID not found
  }

  return rows[0].agent_type; // Returns 'INDIVIDUAL' or 'CORPORATE'
};

const getMaxSteps = (agentType) => {
  return agentType === "INDIVIDUAL" ? 5 : 6;
};

// Configure multer for steps that need file uploads (0, 1, 3, 5)
const createMulterMiddleware = (step) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = `uploads/${req.params.request_uuid}`;
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      cb(null, `${timestamp}_${sanitizedName}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    // Define allowed file types based on step
    const allowedTypes = {
      0: [".pdf", ".jpg", ".jpeg", ".png"], // Firm registration docs
      1: [".jpg", ".jpeg", ".png"], // Personnel photos
      3: [".pdf", ".jpg", ".jpeg", ".png"], // Experience certificates
      5: [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"], // Final attachments
    };

    const fileExt = path.extname(file.originalname).toLowerCase();
    const stepNum = parseInt(req.body.step_number || step);

    if (allowedTypes[stepNum]?.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(
        new Error(`File type ${fileExt} not allowed for step ${stepNum}`),
        false
      );
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 20, // Max 20 files per request
    },
  });
};

// Conditional middleware: only apply multer for steps that need file uploads
const conditionalUpload = (req, res, next) => {
  const stepNumber =
    parseInt(req.body.step_number || req.query.step_number) || 0;
  const stepsWithUploads = [0, 1, 3, 5];

  if (stepsWithUploads.includes(stepNumber)) {
    // Use multer for file upload steps
    const upload = createMulterMiddleware(stepNumber);
    upload.any()(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "File upload error",
          error: err.message,
        });
      }
      next();
    });
  } else {
    // Skip multer for non-file steps (2, 4)
    next();
  }
};

// Main API endpoint with conditional file upload support
app.post(
  "/api/agency-onboarding/:request_uuid",
  conditionalUpload,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { request_uuid } = req.params;
      let { step_number, action, form_data } = req.body;

      // Parse form data and convert types
      if (typeof form_data === "string") {
        try {
          form_data = JSON.parse(form_data);
        } catch (e) {
          form_data = {};
        }
      }

      // Convert step_number to integer
      step_number = parseInt(step_number);

      // Process uploaded files
      const uploadedFiles = {};
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          if (!uploadedFiles[file.fieldname]) {
            uploadedFiles[file.fieldname] = [];
          }
          uploadedFiles[file.fieldname].push({
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
          });
        });
      }

      // Convert numeric strings to numbers in form_data for validation
      if (form_data && typeof form_data === "object") {
        convertNumericFields(form_data);
      }

      // Validate agent type
      const agentType = await getAgentType(connection, request_uuid);
      if (!agentType) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid request_uuid. Must be valid INDIVIDUAL or CORPORATE type.",
        });
      }
      const maxSteps = getMaxSteps(agentType);

      console.log(agentType, "agentType");
      if (agentType === "INDIVIDUAL" && step_number === 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid step_number. Must be between 1 and ${
            maxSteps - 1
          } for ${agentType} type.`,
        });
      }

      // Validate step number
      if (step_number < 0 || step_number >= maxSteps) {
        return res.status(400).json({
          success: false,
          message: `Invalid step_number. Must be between 0 and ${
            maxSteps - 1
          } for ${agentType} type.`,
        });
      }

      // Validate request body based on step
      if (stepValidations[step_number]) {
        const { error } = stepValidations[step_number].validate(req.body);
        if (error) {
          return res.status(400).json({
            success: false,
            message: "Validation error",
            details: error.details,
          });
        }
      }

      // Check if application exists, create if not
      let [existingApp] = await connection.execute(
        "SELECT * FROM applications WHERE uuid = ?",
        [request_uuid]
      );

      if (existingApp.length === 0) {
        await connection.execute(
          "INSERT INTO applications (uuid, agent_type, current_step) VALUES (?, ?, ?)",
          [request_uuid, agentType, step_number]
        );
      } else {
        // Update current step if progressing forward
        if (step_number >= existingApp[0].current_step) {
          await connection.execute(
            "UPDATE applications SET current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?",
            [step_number, request_uuid]
          );
        }
      }

      let responseData = { step_number, action: "SUCCESS" };

      // Process based on step number
      switch (step_number) {
        case 0: // Firm Details (with uploads)
          await saveFirmDetails(
            connection,
            request_uuid,
            form_data,
            uploadedFiles
          );
          break;

        case 1: // Personnel Details (with uploads)
          responseData.personnel_ids = await savePersonnelDetails(
            connection,
            request_uuid,
            form_data.personnel,
            uploadedFiles
          );
          break;

        case 2: // Qualifications (no uploads - pure JSON)
          await saveQualifications(
            connection,
            form_data.personnel,
            request_uuid
          );
          break;

        case 3: // Experience (with uploads)
          await saveExperience(
            connection,
            request_uuid,
            form_data.personnel,
            uploadedFiles
          );
          break;

        case 4: // Background Information (no uploads - pure JSON)
          await saveBackgroundInfo(connection, request_uuid, form_data);
          break;

        case 5: // Attachments (with uploads)
          await saveAttachments(connection, request_uuid, uploadedFiles);
          if (action === "SUBMIT") {
            await connection.execute(
              'UPDATE applications SET status = "COMPLETED", updated_at = CURRENT_TIMESTAMP WHERE uuid = ?',
              [request_uuid]
            );
            responseData.message = "Application submitted successfully";
          }
          break;

        default:
          throw new Error("Invalid step number");
      }

      await connection.commit();

      res.status(200).json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Error processing request:", error);

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  }
);

// Helper functions for saving data
const saveFirmDetails = async (
  connection,
  appId,
  formData,
  uploadedFiles = {}
) => {
  const query = `
    INSERT INTO firm_details (
      app_id, firm_name, registration_number, pan_number, gst_number,
      correspondence_address_line1, correspondence_address_line2, correspondence_city, 
      correspondence_state, correspondence_pincode,
      permanent_address_line1, permanent_address_line2, permanent_city, 
      permanent_state, permanent_pincode,
      email_address, mobile_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      firm_name = VALUES(firm_name),
      registration_number = VALUES(registration_number),
      pan_number = VALUES(pan_number),
      gst_number = VALUES(gst_number),
      correspondence_address_line1 = VALUES(correspondence_address_line1),
      correspondence_address_line2 = VALUES(correspondence_address_line2),
      correspondence_city = VALUES(correspondence_city),
      correspondence_state = VALUES(correspondence_state),
      correspondence_pincode = VALUES(correspondence_pincode),
      permanent_address_line1 = VALUES(permanent_address_line1),
      permanent_address_line2 = VALUES(permanent_address_line2),
      permanent_city = VALUES(permanent_city),
      permanent_state = VALUES(permanent_state),
      permanent_pincode = VALUES(permanent_pincode),
      email_address = VALUES(email_address),
      mobile_number = VALUES(mobile_number),
      updated_at = CURRENT_TIMESTAMP
  `;

  await connection.execute(query, [
    appId,
    formData.firmName,
    formData.registrationNumber,
    formData.panNumber,
    formData.gstNumber || null,
    formData.correspondenceAddress.addressLine1,
    formData.correspondenceAddress.addressLine2 || null,
    formData.correspondenceAddress.city,
    formData.correspondenceAddress.state,
    formData.correspondenceAddress.pincode,
    formData.permanentAddress.addressLine1,
    formData.permanentAddress.addressLine2 || null,
    formData.permanentAddress.city,
    formData.permanentAddress.state,
    formData.permanentAddress.pincode,
    formData.emailAddress,
    formData.mobileNumber,
  ]);

  // Save any uploaded documents for firm details
  if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
    await saveStepAttachments(connection, appId, uploadedFiles, "FIRM_DETAILS");
  }
};

const savePersonnelDetails = async (
  connection,
  appId,
  personnel,
  uploadedFiles = {}
) => {
  const personnelIds = [];

  for (let index = 0; index < personnel.length; index++) {
    const person = personnel[index];
    const personnelId = uuidv4();
    personnelIds.push(personnelId);

    // Handle photo upload for this person
    let photoPath = person.photoUpload;
    const photoFieldName = `personnel[${index}][photo]` || `photo_${index}`;
    if (
      uploadedFiles[photoFieldName] &&
      uploadedFiles[photoFieldName].length > 0
    ) {
      photoPath = uploadedFiles[photoFieldName][0].filename;
    }

    const query = `
      INSERT INTO personnel (
        personnel_id, app_id, title, name, father_name, mother_name,
        date_of_birth, wealth_tax_registration, wealth_tax_registration_details,
        ibbi_registration_number, pan_number, aadhaar_number, passport_number,
        gst_number, 
        correspondence_address_line1, correspondence_address_line2, correspondence_city, 
        correspondence_state, correspondence_pincode,
        permanent_address_line1, permanent_address_line2, permanent_city, 
        permanent_state, permanent_pincode,
        email_address, mobile_number, photo_upload, is_same_as_correspondence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await connection.execute(query, [
      personnelId,
      appId,
      person.title,
      person.name,
      person.fatherName,
      person.motherName,
      person.dateOfBirth,
      person.wealthTaxRegistration,
      person.wealthTaxRegistrationDetails,
      person.ibbiRegistrationNumber,
      person.panNumber,
      person.aadhaarNumber,
      person.passportNumber,
      person.gstNumber,
      person.correspondenceAddress.addressLine1,
      person.correspondenceAddress.addressLine2 || null,
      person.correspondenceAddress.city,
      person.correspondenceAddress.state,
      person.correspondenceAddress.pincode,
      person.permanentAddress.addressLine1,
      person.permanentAddress.addressLine2 || null,
      person.permanentAddress.city,
      person.permanentAddress.state,
      person.permanentAddress.pincode,
      person.emailAddress,
      person.mobileNumber,
      photoPath,
      person.isSameAsCorrespondence || false,
    ]);
  }

  // Save any other uploaded documents for personnel
  const personnelFiles = Object.keys(uploadedFiles).filter(
    (key) => !key.includes("[photo]") && key.startsWith("personnel")
  );

  if (personnelFiles.length > 0) {
    const personnelDocs = {};
    personnelFiles.forEach((key) => {
      personnelDocs[key] = uploadedFiles[key];
    });
    await saveStepAttachments(
      connection,
      appId,
      personnelDocs,
      "PERSONNEL_DETAILS"
    );
  }

  return personnelIds;
};

// const saveQualifications = async (connection, personnel) => {
//   // Step 2 - No file uploads, pure JSON processing
//   for (const person of personnel) {
//     const personnelId = person.personnel_id;

//     // Delete existing qualifications for this person
//     await connection.execute(
//       "DELETE FROM educational_qualifications WHERE personnel_id = ?",
//       [personnelId]
//     );
//     await connection.execute(
//       "DELETE FROM professional_qualifications WHERE personnel_id = ?",
//       [personnelId]
//     );

//     // Save educational qualifications
//     if (
//       person.educationalQualifications &&
//       person.educationalQualifications.length > 0
//     ) {
//       for (const edu of person.educationalQualifications) {
//         await connection.execute(
//           `INSERT INTO educational_qualifications
//            (personnel_id, qualification, year_of_passing, marks_percent, grade_class, university_college, remarks)
//            VALUES (?, ?, ?, ?, ?, ?, ?)`,
//           [
//             personnelId,
//             edu.qualification,
//             edu.yearOfPassing,
//             edu.marksPercent,
//             edu.gradeClass,
//             edu.universityCollege,
//             edu.remarks || null,
//           ]
//         );
//       }
//     }

//     // Save professional qualifications
//     if (
//       person.professionalQualifications &&
//       person.professionalQualifications.length > 0
//     ) {
//       for (const prof of person.professionalQualifications) {
//         await connection.execute(
//           `INSERT INTO professional_qualifications
//            (personnel_id, qualification, institute, membership_no, date_of_enrolment, remarks)
//            VALUES (?, ?, ?, ?, ?, ?)`,
//           [
//             personnelId,
//             prof.qualification,
//             prof.institute,
//             prof.membershipNo,
//             prof.dateOfEnrolment,
//             prof.remarks || null,
//           ]
//         );
//       }
//     }
//   }
// };

const saveQualifications = async (connection, personnel, request_uuid) => {
  for (const person of personnel) {
    const personnelId = person.personnel_id;

    // Delete existing qualifications for this person and app_id
    await connection.execute(
      "DELETE FROM educational_qualifications WHERE personnel_id = ? AND app_id = ?",
      [personnelId, request_uuid]
    );
    await connection.execute(
      "DELETE FROM professional_qualifications WHERE personnel_id = ? AND app_id = ?",
      [personnelId, request_uuid]
    );

    // Save educational qualifications
    if (
      person.educationalQualifications &&
      person.educationalQualifications.length > 0
    ) {
      for (const edu of person.educationalQualifications) {
        await connection.execute(
          `INSERT INTO educational_qualifications 
           (personnel_id, app_id, qualification, year_of_passing, marks_percent, grade_class, university_college, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            personnelId,
            request_uuid,
            edu.qualification,
            edu.yearOfPassing,
            edu.marksPercent,
            edu.gradeClass,
            edu.universityCollege,
            edu.remarks || null,
          ]
        );
      }
    }

    // Save professional qualifications
    if (
      person.professionalQualifications &&
      person.professionalQualifications.length > 0
    ) {
      for (const prof of person.professionalQualifications) {
        await connection.execute(
          `INSERT INTO professional_qualifications 
           (personnel_id, app_id, qualification, institute, membership_no, date_of_enrolment, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            personnelId,
            request_uuid,
            prof.qualification,
            prof.institute,
            prof.membershipNo,
            prof.dateOfEnrolment,
            prof.remarks || null,
          ]
        );
      }
    }
  }
};

const saveExperience = async (
  connection,
  appId,
  personnel,
  uploadedFiles = {}
) => {
  for (const person of personnel) {
    const personnelId = person.personnel_id;

    // Delete existing experience for this person
    await connection.execute(
      "DELETE FROM experience_details WHERE personnel_id = ?",
      [personnelId]
    );

    // Save experience details
    if (person.experienceDetails && person.experienceDetails.length > 0) {
      for (const exp of person.experienceDetails) {
        await connection.execute(
          `INSERT INTO experience_details 
           (app_id, personnel_id, currently_in_practice_or_employment, years_in_practice,
            practice_address, years_in_employment, months_in_employment, evidence_files,
            from_date, to_date, employment_or_practice, employer_name_and_designation,
            practice_experience, area_of_work)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            appId,
            personnelId,
            exp.currentlyInPracticeOrEmployment,
            exp.yearsInPractice,
            exp.practiceAddress,
            exp.yearsInEmployment,
            exp.monthsInEmployment,
            JSON.stringify(exp.evidenceFiles || []),
            exp.fromDate,
            exp.toDate,
            exp.employmentOrPractice,
            exp.employerNameAndDesignation,
            exp.practiceExperience,
            exp.areaOfWork,
          ]
        );
      }
    }
  }

  // Save experience certificates/documents
  if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
    await saveStepAttachments(connection, appId, uploadedFiles, "EXPERIENCE");
  }
};

const saveBackgroundInfo = async (connection, appId, data) => {
  // Step 4 - No file uploads, pure JSON processing
  const query = `
    INSERT INTO background_information (
      app_id, convicted_offence, convicted_offence_details,
      criminal_proceedings, criminal_proceedings_details,
      undischarged_bankrupt, undischarged_bankrupt_details, additional_information
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      convicted_offence = VALUES(convicted_offence),
      convicted_offence_details = VALUES(convicted_offence_details),
      criminal_proceedings = VALUES(criminal_proceedings),
      criminal_proceedings_details = VALUES(criminal_proceedings_details),
      undischarged_bankrupt = VALUES(undischarged_bankrupt),
      undischarged_bankrupt_details = VALUES(undischarged_bankrupt_details),
      additional_information = VALUES(additional_information),
      updated_at = CURRENT_TIMESTAMP
  `;

  await connection.execute(query, [
    appId,
    data.convictedOffence,
    data.convictedOffenceDetails,
    data.criminalProceedings,
    data.criminalProceedingsDetails,
    data.undischargedBankrupt,
    data.undischargedBankruptDetails,
    data.additionalInformation,
  ]);
};

const saveAttachments = async (connection, appId, uploadedFiles = {}) => {
  // Save final attachments is work in progress
  if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
    await saveStepAttachments(
      connection,
      appId,
      uploadedFiles,
      "FINAL_ATTACHMENTS"
    );
  }
};

// Helper function to save attachments for any step
const saveStepAttachments = async (
  connection,
  appId,
  uploadedFiles,
  documentCategory
) => {
  if (!uploadedFiles || Object.keys(uploadedFiles).length === 0) return;

  for (const [fieldName, files] of Object.entries(uploadedFiles)) {
    if (Array.isArray(files)) {
      for (const file of files) {
        if (file && file.filename) {
          await connection.execute(
            "INSERT INTO attachments (app_id, document_type, file_name, file_path, file_size) VALUES (?, ?, ?, ?, ?)",
            [
              appId,
              `${documentCategory}_${fieldName}`,
              file.filename,
              file.path,
              file.size || 0,
            ]
          );
        }
      }
    }
  }
};

// Helper function to convert numeric string fields to numbers
const convertNumericFields = (obj) => {
  if (Array.isArray(obj)) {
    obj.forEach((item) => convertNumericFields(item));
  } else if (obj && typeof obj === "object") {
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === "string") {
        // Convert numeric strings
        if (
          key === "yearOfPassing" ||
          key === "marksPercent" ||
          key === "yearsInPractice" ||
          key === "yearsInEmployment" ||
          key === "monthsInEmployment"
        ) {
          const num = parseFloat(obj[key]);
          if (!isNaN(num)) {
            obj[key] = num;
          }
        }
        // Convert date strings
        if (
          key === "dateOfBirth" ||
          key === "dateOfEnrolment" ||
          key === "fromDate" ||
          key === "toDate"
        ) {
          if (obj[key]) {
            obj[key] = new Date(obj[key]);
          }
        }
      } else if (typeof obj[key] === "object") {
        convertNumericFields(obj[key]);
      }
    });
  }
};

app.get("/api/agency-onboarding/:request_uuid", async (req, res) => {
  try {
    const { request_uuid } = req.params;
    const stepNumber = req.query.step ? parseInt(req.query.step) : null;

    const connection = await pool.getConnection();

    // Get application info
    const [app] = await connection.execute(
      "SELECT * FROM applications WHERE uuid = ?",
      [request_uuid]
    );

    if (app.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const applicationData = {
      request_uuid,
      agent_type: app[0].agent_type,
      current_step: app[0].current_step,
      status: app[0].status,
      steps: {},
    };

    // Helper function to add steps
    const addStep0 = async () => {
      const [firmDetails] = await connection.execute(
        "SELECT * FROM firm_details WHERE app_id = ?",
        [request_uuid]
      );
      applicationData.steps[0] =
        firmDetails.length > 0
          ? {
              firmDetails: {
                firmName: firmDetails[0].firm_name,
                registrationNumber: firmDetails[0].registration_number,
                panNumber: firmDetails[0].pan_number,
                gstNumber: firmDetails[0].gst_number,
                correspondenceAddress: {
                  addressLine1: firmDetails[0].correspondence_address_line1,
                  addressLine2: firmDetails[0].correspondence_address_line2,
                  city: firmDetails[0].correspondence_city,
                  state: firmDetails[0].correspondence_state,
                  pincode: firmDetails[0].correspondence_pincode,
                },
                permanentAddress: {
                  addressLine1: firmDetails[0].permanent_address_line1,
                  addressLine2: firmDetails[0].permanent_address_line2,
                  city: firmDetails[0].permanent_city,
                  state: firmDetails[0].permanent_state,
                  pincode: firmDetails[0].permanent_pincode,
                },
                emailAddress: firmDetails[0].email_address,
                mobileNumber: firmDetails[0].mobile_number,
              },
            }
          : { firmDetails: {} };
    };

    const addStep1to3 = async () => {
      // Step 1: Personnel
      const [personnel] = await connection.execute(
        "SELECT * FROM personnel WHERE app_id = ?",
        [request_uuid]
      );

      applicationData.steps[1] = {
        personnel: personnel.map((person) => ({
          personnel_id: person.personnel_id,
          title: person.title,
          name: person.name,
          fatherName: person.father_name,
          motherName: person.mother_name,
          dateOfBirth: person.date_of_birth,
          wealthTaxRegistration: person.wealth_tax_registration,
          wealthTaxRegistrationDetails: person.wealth_tax_registration_details,
          ibbiRegistrationNumber: person.ibbi_registration_number,
          panNumber: person.pan_number,
          aadhaarNumber: person.aadhaar_number,
          passportNumber: person.passport_number,
          gstNumber: person.gst_number,
          correspondenceAddress: {
            addressLine1: person.correspondence_address_line1,
            addressLine2: person.correspondence_address_line2,
            city: person.correspondence_city,
            state: person.correspondence_state,
            pincode: person.correspondence_pincode,
          },
          permanentAddress: {
            addressLine1: person.permanent_address_line1,
            addressLine2: person.permanent_address_line2,
            city: person.permanent_city,
            state: person.permanent_state,
            pincode: person.permanent_pincode,
          },
          emailAddress: person.email_address,
          mobileNumber: person.mobile_number,
          photoUpload: person.photo_upload,
          isSameAsCorrespondence: person.is_same_as_correspondence,
          educationalQualifications: [],
          professionalQualifications: [],
          experienceDetails: [],
        })),
      };

      // Step 2 & 3: Qualifications & Experience
      for (let i = 0; i < applicationData.steps[1].personnel.length; i++) {
        const personnelId = applicationData.steps[1].personnel[i].personnel_id;

        // Educational
        const [eduQual] = await connection.execute(
          "SELECT * FROM educational_qualifications WHERE personnel_id = ?",
          [personnelId]
        );
        applicationData.steps[1].personnel[i].educationalQualifications =
          eduQual || [];

        // Professional
        const [profQual] = await connection.execute(
          "SELECT * FROM professional_qualifications WHERE personnel_id = ?",
          [personnelId]
        );
        applicationData.steps[1].personnel[i].professionalQualifications =
          profQual || [];

        // Experience
        const [expDetails] = await connection.execute(
          "SELECT * FROM experience_details WHERE personnel_id = ?",
          [personnelId]
        );
        applicationData.steps[1].personnel[i].experienceDetails =
          expDetails || [];
      }
    };

    const addStep4 = async () => {
      const [bgInfo] = await connection.execute(
        "SELECT * FROM background_information WHERE app_id = ?",
        [request_uuid]
      );
      applicationData.steps[4] =
        bgInfo.length > 0
          ? { backgroundInfo: bgInfo[0] }
          : { backgroundInfo: {} };
    };

    const addStep5 = async () => {
      // work in progress
      applicationData.steps[5] = { attachments: {} };
    };

    // Add steps based on stepNumber
    if (stepNumber === null) {
      await addStep0();
      await addStep1to3();
      await addStep4();
      await addStep5();
    } else {
      switch (stepNumber) {
        case 0:
          await addStep0();
          break;
        case 1:
        case 2:
        case 3:
          await addStep1to3();
          break;
        case 4:
          await addStep4();
          break;
        case 5:
          await addStep5();
          break;
        default:
          return res.status(400).json({
            success: false,
            message: "Invalid step number",
          });
      }
    }

    connection.release();

    res.status(200).json({
      success: true,
      data: applicationData,
    });
  } catch (error) {
    console.error("Error fetching application:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ========= Graceful shutdown (same as before) =========
process.on("SIGINT", async () => {
  if (pool) await pool.end();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  if (pool) await pool.end();
  process.exit(0);
});

// ========= Start server =========
const startServer = async () => {
  await connectToDatabase();
  await createTables();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () =>
    console.log(`🚀 Agency Onboarding API running at http://localhost:${PORT}`)
  );
};
startServer();
