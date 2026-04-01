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
      <Toaster
        position="top-right"
        containerStyle={{
          right: 72,
        }}
        toastOptions={{
          style: {
            background: '#fff',
            color: '#000',
          },
        }}
      />
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
