import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  deleteAccountData,
  initializeAuth,
  loginUser,
  loginWithTokenUser,
  logoutUser,
  refreshUserData,
  registerUser,
  updateProfileData,
  uploadProfileImageData,
} from "../store/authSlice";

export function AuthProvider({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  return children;
}

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);

  const login = (email, password) =>
    dispatch(loginUser({ email, password })).unwrap();

  const register = (name, email, password) =>
    dispatch(registerUser({ name, email, password })).unwrap();

  const loginWithToken = (token) =>
    dispatch(loginWithTokenUser(token)).unwrap();

  const refreshUser = () => dispatch(refreshUserData()).unwrap();

  const updateProfile = (payload) =>
    dispatch(updateProfileData(payload)).unwrap();

  const uploadProfileImage = (file) =>
    dispatch(uploadProfileImageData(file)).unwrap();

  const logout = () => {
    dispatch(logoutUser());
  };

  const deleteAccount = () => dispatch(deleteAccountData()).unwrap();

  return {
    user,
    loading,
    login,
    register,
    loginWithToken,
    refreshUser,
    updateProfile,
    uploadProfileImage,
    logout,
    deleteAccount,
  };
};
