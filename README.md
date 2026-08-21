# Meso Market Tracker

A web app for tracking and visualising MapleStory meso market prices over time.

## Features

- **Chart view** — line chart of average meso market prices
- **Manual entry** — form for recording buy/sell buyout prices at multiple meso denominations (100M, 1B, 10B)
- **CSV upload** — bulk import historical data from a CSV file

## Architecture

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Next.js 16 | Vercel |
| Backend | Python / Flask | AWS Lambda (container image) |
| Database | PostgreSQL | Supabase |

The frontend is a Next.js app with Server Actions that call the backend API. The backend is a Flask app packaged as a Docker container and deployed to AWS Lambda via the [Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter). The database is a Supabase PostgreSQL instance connected via the Supavisor connection pooler.

## Local Development

### Prerequisites

- Node.js 22+
- Python 3.12+
- Docker (optional, for running the backend as a container)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

Create `frontend/.env` with:

```
BACKEND_URL=http://localhost:5000
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask run
```

Create `backend/.env` with your Supabase connection details:

```
DB_HOST=...
DB_PORT=6543
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
```

## Deployment

### Frontend

Connect the repository to [Vercel](https://vercel.com) with the root directory set to `frontend`. Set the `BACKEND_URL` environment variable to your Lambda function URL.

### Backend

Build and push the container image to AWS ECR using `backend/lambda_push.sh`, then deploy or update the Lambda function from the ECR image.