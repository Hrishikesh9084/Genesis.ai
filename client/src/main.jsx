import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { Toaster } from "react-hot-toast";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
    <Toaster position="top-center" toastOptions={{
        style:{
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(251, 146, 60, 0.2)',
        }
    }} />
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
