# L02-YOLO Docker Setup

This project includes Docker configurations for both backend and frontend services.

## Docker Setup

### Prerequisites
- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (included with Docker Desktop)

### Quick Start

**1. Build and run all services:**
```bash
docker-compose up --build
```

**2. Run in detached mode (background):**
```bash
docker-compose up -d
```

**3. Stop all services:**
```bash
docker-compose down
```

**4. View logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Service URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Backend API Endpoint**: http://localhost:8080/api/boards

## Individual Service Management

### Backend Only
```bash
# Build
docker build -t yolo-backend ./backend

# Run
docker run -p 8080:8080 yolo-backend
```

### Frontend Only
```bash
# Build
docker build -t yolo-frontend ./frontend

# Run
docker run -p 3000:80 yolo-frontend
```

## Environment Variables

### Backend Configuration
Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

Then fill in your Firebase credentials:
- `FIREBASE_ADMIN_KEY` - Firebase Admin SDK service account JSON
- `FIREBASE_API_KEY` - Firebase client API key
- `FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_STORAGE_BUCKET` - Firebase storage bucket

**Note**: The backend will start without Firebase credentials but API endpoints requiring Firestore will fail.

### Using Environment Variables with Docker Compose
Uncomment the environment variables in `docker-compose.yml`:

```yaml
environment:
  - FIREBASE_ADMIN_KEY=${FIREBASE_ADMIN_KEY}
  - FIREBASE_API_KEY=${FIREBASE_API_KEY}
  # ... etc
```

## Development

### Local Development (without Docker)

**Backend:**
```bash
cd backend
npm install
npm run dev  # Development mode with hot reload
```

**Frontend:**
```bash
cd frontend
npm install
npm start    # Development mode on port 3000
```

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker-compose up --build

# Rebuild specific service
docker-compose up --build backend
docker-compose up --build frontend
```

## Architecture

### Backend
- **Base Image**: Node 22 Alpine
- **Build**: Multi-stage build with TypeScript compilation
- **Runtime**: Production-optimized with non-root user
- **Port**: 8080

### Frontend
- **Base Image**: Node 22 Alpine (build), Nginx Alpine (serve)
- **Build**: React production build with Tailwind CSS
- **Runtime**: Nginx serving static files
- **Port**: 80 (mapped to 3000 on host)

## Troubleshooting

### Port Conflicts
If ports 3000 or 8080 are already in use, modify `docker-compose.yml`:
```yaml
ports:
  - "3001:80"    # Frontend on port 3001
  - "8081:8080"  # Backend on port 8081
```

### View Container Status
```bash
docker-compose ps
```

### Access Container Shell
```bash
docker-compose exec backend sh
docker-compose exec frontend sh
```

### Clean Up Everything
```bash
# Stop and remove containers, networks
docker-compose down

# Also remove volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Docker Files Overview

- `backend/Dockerfile` - Multi-stage TypeScript build
- `frontend/Dockerfile` - Multi-stage React build with Nginx
- `docker-compose.yml` - Orchestrates both services
- `.dockerignore` - Excludes unnecessary files from builds

