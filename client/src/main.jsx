import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { Provider } from "react-redux";
import { store } from "./store";
import { Toaster } from "react-hot-toast";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          containerStyle={{
            top: 88,
            right: 16,
            zIndex: 9999,
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
    </BrowserRouter>
  </Provider>,
);
