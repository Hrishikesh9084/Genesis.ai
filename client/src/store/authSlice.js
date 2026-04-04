import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../services/api";

const initialState = {
  user: null,
  loading: true,
  error: null,
};

export const initializeAuth = createAsyncThunk("auth/initialize", async (_, { rejectWithValue }) => {
  const token = localStorage.getItem("genesis_token");

  if (!token) {
    return null;
  }

  try {
    const res = await api.get("/auth/me");
    return res.data.user;
  } catch (error) {
    localStorage.removeItem("genesis_token");
    return rejectWithValue(error.response?.data?.error || "Failed to initialize auth");
  }
});

export const loginUser = createAsyncThunk("auth/login", async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("genesis_token", res.data.token);
    return res.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error || "Login failed");
  }
});

export const registerUser = createAsyncThunk("auth/register", async ({ name, email, password }, { rejectWithValue }) => {
  try {
    const res = await api.post("/auth/register", { name, email, password });
    return res.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error || "Registration failed");
  }
});

export const loginWithTokenUser = createAsyncThunk("auth/loginWithToken", async (token, { rejectWithValue }) => {
  localStorage.setItem("genesis_token", token);

  try {
    const res = await api.get("/auth/me");
    return res.data.user;
  } catch (error) {
    localStorage.removeItem("genesis_token");
    return rejectWithValue(error.response?.data?.error || "Token login failed");
  }
});

export const refreshUserData = createAsyncThunk("auth/refreshUser", async (_, { rejectWithValue }) => {
  try {
    const res = await api.get("/auth/me");
    return res.data.user;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error || "Failed to refresh user");
  }
});

export const updateProfileData = createAsyncThunk("auth/updateProfile", async (payload, { rejectWithValue }) => {
  try {
    const res = await api.put("/auth/profile", payload);
    return res.data.user;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error || "Failed to update profile");
  }
});

export const uploadProfileImageData = createAsyncThunk("auth/uploadProfileImage", async (file, { rejectWithValue }) => {
  try {
    const formData = new FormData();
    formData.append("avatar", file);

    const res = await api.post("/auth/profile-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data.user;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error || "Failed to upload profile image");
  }
});

export const deleteAccountData = createAsyncThunk("auth/deleteAccount", async (_, { rejectWithValue }) => {
  try {
    await api.delete("/auth/account");
    localStorage.removeItem("genesis_token");
    return true;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error || "Failed to delete account");
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logoutUser: (state) => {
      localStorage.removeItem("genesis_token");
      state.user = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.user = null;
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(loginWithTokenUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.error = null;
      })
      .addCase(loginWithTokenUser.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(refreshUserData.fulfilled, (state, action) => {
        state.user = action.payload;
        state.error = null;
      })
      .addCase(refreshUserData.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(updateProfileData.fulfilled, (state, action) => {
        state.user = action.payload;
        state.error = null;
      })
      .addCase(uploadProfileImageData.fulfilled, (state, action) => {
        state.user = action.payload;
        state.error = null;
      })
      .addCase(deleteAccountData.fulfilled, (state) => {
        state.user = null;
        state.error = null;
      });
  },
});

export const { logoutUser } = authSlice.actions;

export default authSlice.reducer;
