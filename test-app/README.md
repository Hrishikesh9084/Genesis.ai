# Full-Stack Test Application

A minimal test app to verify app generation and backend/frontend connection works.

## Setup

1. **Install dependencies:**
   ```bash
   cd test-app
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   
   The server will start on `http://localhost:5000`

## Usage

1. Open your browser and navigate to: `http://localhost:5000`
2. You should see a page with a "Check Backend" button
3. Click the button to test the connection to the backend
4. The response "Backend is working" should appear below

## File Structure

- `server.js` - Express backend with API endpoint
- `index.html` - Frontend with button and response display
- `package.json` - Project configuration and dependencies

## API Endpoints

- `GET /api/test` - Returns JSON: `{ "message": "Backend is working" }`
- `GET /api/simple` - Returns plain text: `Backend is working`

## Features

- **Dynamic Port**: Uses `process.env.PORT` or defaults to 5000
- **Static File Serving**: Frontend files served by Express
- **Simple UI**: Plain HTML/CSS/JavaScript with no frameworks
- **Error Handling**: Shows helpful error messages if backend is unavailable
- **Real-time Status**: Loading state and visual feedback during API call

## Testing

Once both frontend and backend are running:
1. Click "Check Backend" button
2. You should see "Backend is working" with a green success indicator
3. If you see an error, ensure:
   - Server is running (`npm start`)
   - Port 5000 is not already in use (or set `PORT` environment variable)
   - Frontend is accessing `http://localhost:5000`

## Troubleshooting

**Port already in use:**
```bash
PORT=3000 npm start
```

**CORS issues:**
The frontend and backend are served from the same origin, so CORS is not needed.

**Frontend not loading:**
Check that you're accessing `http://localhost:5000` (not localhost:5000 without http://)
