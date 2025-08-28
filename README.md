# 🚀 Agency Onboarding API

A robust multi-step form API for agency onboarding with MySQL database, built with Express.js and Docker support.

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Development Setup](#-development-setup)
- [Production Deployment](#-production-deployment)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Commands Reference](#-commands-reference)
- [Environment Variables](#-environment-variables)
- [File Structure](#-file-structure)
- [Debugging](#-debugging)
- [Troubleshooting](#-troubleshooting)

## ✨ Features

- **Multi-step form processing** (5 steps for INDIVIDUAL, 6 steps for CORPORATE)
- **Auto-resume functionality** - Users can continue where they left off
- **Edit/update capability** - Go back and modify previous steps
- **File upload support** with validation
- **MySQL database** with proper normalization
- **Docker containerization** with hot reload for development
- **Transaction-based operations** for data consistency
- **Comprehensive validation** using Joi schemas
- **Health check endpoints**
- **Production-ready** with security middleware

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd agency-onboarding-api

# Create necessary directories
mkdir -p uploads init-scripts
```

### 2. Start Development (One Command!)

```bash
# This starts everything with hot reload and live logs
npm run docker:dev
```

### 3. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Test step 0 (firm details)
curl -X POST http://localhost:3000/api/agency-onboarding/e10906df-3ea3-4aec-820f-1845736ad049 \
  -H "Content-Type: application/json" \
  -d '{"step_number":0,"action":"SAVE","form_data":{"firmName":"Test Corp","registrationNumber":"12345","panNumber":"ABCDE1234F","correspondenceAddress":{"addressLine1":"123 Main St","city":"Mumbai","state":"Maharashtra","pincode":"400001"},"permanentAddress":{"addressLine1":"123 Main St","city":"Mumbai","state":"Maharashtra","pincode":"400001"},"emailAddress":"test@example.com","mobileNumber":"9876543210"}}'
```

## 🔥 Development Setup

### Hot Reload Development (Recommended)

```bash
# Start development with hot reload + live logs
npm run docker:dev

# Alternative: Start in background
npm run docker:dev:detached
npm run docker:dev:logs

# Quick restart with logs
npm run docker:dev:restart

# Stop development
npm run docker:dev:down
# or press Ctrl+C if running in foreground
```

### Local Development (Without Docker)

```bash
# Install dependencies
npm install

# Set up local MySQL database
# Update .env with your local database credentials

# Start with hot reload
npm run local:dev

# Start with debugger
npm run local:debug
```

### Development Features

- ✅ **Hot reload** with nodemon
- ✅ **Debug port 9229** for VS Code/Chrome DevTools
- ✅ **Live logs** with file change notifications
- ✅ **Separate dev database** (port 3307)
- ✅ **Volume mounting** for instant code changes

## 🏭 Production Deployment

```bash
# Build and start production containers
npm run docker:up

# View production logs
npm run docker:logs

# Stop production
npm run docker:down

# Rebuild production
npm run docker:build
npm run docker:up
```

## 📚 API Documentation

### Base URL

```
Development: http://localhost:3000
Production: http://your-domain:3000
```

### Agent Types & UUIDs

- **INDIVIDUAL**: `e10906df-3ea3-4aec-820f-1845736ad049` (5 steps: 0-4)
- **CORPORATE**: `c7039573-d573-4f83-9a35-e69d5b7b87fb` (6 steps: 0-5)

### Endpoints

#### Save Step Data

```http
POST /api/agency-onboarding/{request_uuid}
Content-Type: application/json

{
  "step_number": 0,
  "action": "SAVE",
  "form_data": {
    // Step-specific data
  }
}
```

#### Retrieve Application Data

```http
GET /api/agency-onboarding/{request_uuid}
```

#### Upload Files

```http
POST /api/agency-onboarding/{request_uuid}/upload
Content-Type: multipart/form-data

files: [file1, file2, ...]
```

#### Health Check

```http
GET /health
```

### Step-by-Step Data Structure

#### Step 0: Firm Details

```json
{
  "step_number": 0,
  "action": "SAVE",
  "form_data": {
    "firmName": "ABC Corporation",
    "registrationNumber": "REG123456",
    "panNumber": "ABCDE1234F",
    "gstNumber": "27AAEPM1234C1Z5",
    "correspondenceAddress": {
      "addressLine1": "123 Business St",
      "addressLine2": "Suite 100",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    },
    "permanentAddress": {
      "addressLine1": "123 Business St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    },
    "emailAddress": "contact@abc.com",
    "mobileNumber": "9876543210"
  }
}
```

#### Step 1: Personnel Details

```json
{
  "step_number": 1,
  "action": "SAVE",
  "form_data": {
    "personnel": [
      {
        "title": "Mr",
        "name": "John Doe",
        "fatherName": "Robert Doe",
        "motherName": "Mary Doe",
        "dateOfBirth": "1990-01-15",
        "wealthTaxRegistration": "Yes",
        "wealthTaxRegistrationDetails": "WT123456",
        "ibbiRegistrationNumber": "IBBI789",
        "panNumber": "ABCDE1234F",
        "aadhaarNumber": "123456789012",
        "emailAddress": "john@abc.com",
        "mobileNumber": "9876543210"
      }
    ]
  }
}
```

#### Step 2: Qualifications

```json
{
  "step_number": 2,
  "action": "SAVE",
  "personnel": [
    {
      "educationalQualifications": [
        {
          "qualification": "B.Com",
          "yearOfPassing": 2012,
          "marksPercent": 85.5,
          "gradeClass": "First Class",
          "universityCollege": "University of Mumbai",
          "remarks": "Specialization in Accounting"
        }
      ],
      "professionalQualifications": [
        {
          "qualification": "CA",
          "institute": "ICAI",
          "membershipNo": "CA123456",
          "dateOfEnrolment": "2015-06-01",
          "remarks": "Chartered Accountant"
        }
      ],
      "personnelIdentification": {
        "personnel_id": "uuid-from-step-1-response",
        "name": "John Doe",
        "panNumber": "ABCDE1234F",
        "aadhaarNumber": "123456789012"
      }
    }
  ]
}
```

#### Step 3: Experience Details

```json
{
  "step_number": 3,
  "action": "SAVE",
  "form_data": {
    "personnel": [
      {
        "currentlyInPracticeOrEmployment": "Yes",
        "yearsInPractice": 5,
        "practiceAddress": "Mumbai, Maharashtra",
        "yearsInEmployment": 3,
        "monthsInEmployment": 6,
        "experienceDetails": [
          {
            "fromDate": "2018-01-01",
            "toDate": "2023-12-31",
            "employmentOrPractice": "Employment",
            "employerNameAndDesignation": "XYZ Corp - Senior Manager",
            "practiceExperience": "Audit and Taxation",
            "areaOfWork": "Financial Auditing"
          }
        ],
        "personnelIdentification": {
          "personnel_id": "uuid-from-step-1-response",
          "name": "John Doe",
          "panNumber": "ABCDE1234F"
        }
      }
    ]
  }
}
```

#### Step 4: Background Information

```json
{
  "step_number": 4,
  "action": "SAVE",
  "convictedOffence": "No",
  "convictedOffenceDetails": "",
  "criminalProceedings": "No",
  "criminalProceedingsDetails": "",
  "undischargedBankrupt": "No",
  "undischargedBankruptDetails": "",
  "additionalInformation": "Additional remarks if any"
}
```

#### Step 5: Attachments (Final Submit)

```json
{
  "step_number": 5,
  "action": "SUBMIT",
  "form_data": {
    "ibbi_certificate": ["cert1.pdf"],
    "wealth_tax_certificate": ["tax_cert.pdf"],
    "valuers_org_membership": [],
    "professional_bodies": ["professional_cert.pdf"],
    "kyc_documents": ["kyc.pdf"],
    "pan_card": ["pan_card.jpg"],
    "address_proof": ["address_proof.pdf"],
    "education_certificates": ["degree.pdf"],
    "professional_certificates": ["ca_cert.pdf"],
    "experience_documents": ["experience.pdf"],
    "employment_certificates": ["employment.pdf"],
    "it_returns": ["it_return.pdf"],
    "gst_registration": ["gst_cert.pdf"],
    "cancelled_cheque": ["cheque.jpg"],
    "photographs": ["photo.jpg"],
    "moa_aoa": ["moa.pdf"],
    "partnership_deed": [],
    "company_profile": ["profile.pdf"],
    "board_resolution": ["resolution.pdf"],
    "authorized_signatory": ["signatory.pdf"]
  }
}
```

## 🗄️ Database Schema

The application uses a normalized MySQL database with the following tables:

### Core Tables

- **`applications`** - Main application tracking
- **`firm_details`** - Step 0: Company/firm information
- **`personnel`** - Step 1: Personnel basic details
- **`educational_qualifications`** - Step 2: Education records
- **`professional_qualifications`** - Step 2: Professional certifications
- **`experience_details`** - Step 3: Work experience
- **`background_information`** - Step 4: Background checks
- **`attachments`** - Step 5: File uploads

### Key Relationships

- One application can have multiple personnel
- Each personnel can have multiple qualifications and experiences
- All tables are linked via foreign keys for data integrity
- Cascading deletes ensure data consistency

## 📖 Commands Reference

### Development Commands

```bash
# 🔥 HOT RELOAD DEVELOPMENT
npm run docker:dev          # Start dev with live logs (ONE COMMAND!)
npm run docker:dev:detached # Start in background
npm run docker:dev:logs     # View logs (if detached)
npm run docker:dev:restart  # Restart + follow logs
npm run docker:dev:down     # Stop dev environment
npm run docker:dev:clean    # Remove everything including volumes

# 🖥️ LOCAL DEVELOPMENT
npm run local:dev           # Local with nodemon + hot reload
npm run local:debug         # Local with debugger (port 9229)

# 🏭 PRODUCTION
npm run docker:up           # Start production containers
npm run docker:down         # Stop production
npm run docker:build        # Rebuild production images
npm run docker:logs         # View production logs
npm run docker:restart      # Restart production services

# 📦 UTILITIES
npm install                 # Install dependencies
npm start                   # Start without nodemon
npm run dev                 # Local nodemon (alias)
```

### Docker Commands (Direct)

```bash
# Development
docker-compose -f docker-compose.dev.yml up --build    # Start dev with build
docker-compose -f docker-compose.dev.yml down -v       # Clean dev environment

# Production
docker-compose up -d --build                           # Start prod detached
docker-compose logs -f app                             # Follow app logs
docker-compose exec app sh                             # Shell into app container
docker-compose exec mysql mysql -u agency_user -p     # MySQL shell

# Database Operations
docker-compose exec mysql mysqldump -u agency_user -p agency_onboarding > backup.sql
docker-compose exec -T mysql mysql -u agency_user -p agency_onboarding < backup.sql
```

## 🔧 Environment Variables

### Development (.env)

```env
NODE_ENV=development
DB_HOST=localhost
DB_USER=agency_user
DB_PASSWORD=<<password>>
DB_NAME=agency_onboarding
DB_PORT=DB_PORT>>
PORT=3000
DEBUG=true
```

### Production (docker-compose.yml)

```env
NODE_ENV=production
DB_HOST=mysql
DB_USER=agency_user
DB_PASSWORD=<<password>>
DB_NAME=agency_onboarding
DB_PORT=<<DB_PORT>>
PORT=3000
```

### MySQL Environment

```env
MYSQL_ROOT_PASSWORD=<<password>>
DB_NAME=agency_onboarding
DB_USER=agency_user
DB_PASSWORD=<<password>>
```

## 📁 File Structure

```
agency-onboarding-api/
├── 📄 Dockerfile              # Production container
├── 📄 Dockerfile.dev          # Development container
├── 📄 docker-compose.yml      # Production orchestration
├── 📄 docker-compose.dev.yml  # Development orchestration
├── 📄 server.js               # Main application
├── 📄 package.json            # Dependencies & scripts
├── 📄 .env                    # Environment variables
├── 📄 .dockerignore          # Docker ignore patterns
├── 📄 README.md              # This documentation
├── 📁 uploads/               # File uploads directory
│   └── .gitkeep
├── 📁 .vscode/               # VS Code configuration
│   └── launch.json           # Debug configuration
└── 📁 node_modules/          # Dependencies (gitignored)
```

## 🐛 Debugging

### VS Code Debug Setup

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Docker",
      "address": "localhost",
      "port": 9229,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/usr/src/app",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Debug Steps

1. Start development: `npm run docker:dev:detached`
2. Set breakpoints in VS Code
3. Press F5 or go to Run & Debug > "Attach to Docker"
4. Make API calls - breakpoints will trigger

### Chrome DevTools

1. Open Chrome: `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Add network target: `localhost:9229`

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
lsof -i :3306

# Kill the process
kill -9 <PID>

# Or use different ports in docker-compose files
```

#### Database Connection Issues

```bash
# Check MySQL container status
docker-compose -f docker-compose.dev.yml ps

# View MySQL logs
docker-compose -f docker-compose.dev.yml logs mysql

# Reset database
npm run docker:dev:clean
npm run docker:dev
```

#### File Upload Issues

```bash
# Check uploads directory permissions
ls -la uploads/

# Create uploads directory if missing
mkdir -p uploads
chmod 755 uploads
```

#### Hot Reload Not Working

```bash
# Check if files are being watched
docker-compose -f docker-compose.dev.yml logs app | grep nodemon

# Ensure volume mounting is correct
docker-compose -f docker-compose.dev.yml exec app ls -la

# Restart containers
npm run docker:dev:restart
```

### Performance Issues

```bash
# Check container resources
docker stats

# Check MySQL performance
docker-compose -f docker-compose.dev.yml exec mysql mysql -u agency_user -p -e "SHOW PROCESSLIST;"

# Clean up unused Docker resources
docker system prune -f
```

### Database Reset

```bash
# Complete reset (WARNING: Deletes all data)
npm run docker:dev:clean

# Backup before reset
docker-compose -f docker-compose.dev.yml exec mysql mysqldump -u agency_user -p agency_onboarding > backup.sql

# Restore from backup
docker-compose -f docker-compose.dev.yml exec -T mysql mysql -u agency_user -p agency_onboarding < backup.sql
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Start development: `npm run docker:dev`
4. Make your changes with hot reload feedback
5. Test thoroughly
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions:

- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

---

**Happy Coding! 🚀**
