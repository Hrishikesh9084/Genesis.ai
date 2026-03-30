import { MenuIcon, XIcon, ChevronDown, LogOut, UserRoundCog, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import Logo from "./Logo";
import NetworkStatus from "./NetworkStatus";

function getUserInitial(user) {
  if (!user?.name) return "U";
  return user.name.trim().charAt(0).toUpperCase();
}

function UserAvatar({ user, sizeClass = "w-8 h-8" }) {
  if (!user) return null;

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name || "Profile"}
        className={`${sizeClass} rounded-full object-cover border border-gray-700/70`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/30 flex items-center justify-center text-sm font-semibold`}
      aria-label="Profile"
      title={user.name || "User"}
    >
      {getUserInitial(user)}
    </div>
  );
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const profileMenuRef = useRef(null);
  const profileImageInputRef = useRef(null);
  const { user, updateProfile, uploadProfileImage, logout } = useAuth();

  const publicLinks = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/plans" },
    { name: "About", href: "/about" },
    { name: "Careers", href: "/careers" },
    { name: "Contact", href: "/contact" },
  ];

  const isAdminUser =
    user?.is_admin === true ||
    String(user?.is_admin || "").toLowerCase() === "true" ||
    String(user?.role || "").toLowerCase() === "admin";

  const authLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "New Project", href: "/new-project" },
    { name: "Settings", href: "/settings" },
    ...(isAdminUser ? [{ name: "Admin", href: "/admin/applications" }] : []),
  ];

  const links = user ? [...publicLinks, ...authLinks] : publicLinks;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setProfileName(user.name || "");
    setProfileImage(user.avatar_url || "");
  }, [user]);

  useEffect(() => {
    if (!isProfileMenuOpen) return undefined;

    const onOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [isProfileMenuOpen]);

  const handleSaveProfile = async () => {
    const trimmedName = profileName.trim();
    const trimmedImage = profileImage.trim();

    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    if (trimmedImage && !/^https?:\/\//i.test(trimmedImage)) {
      toast.error("Profile image URL must start with http:// or https://");
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        name: trimmedName,
        avatar_url: trimmedImage,
      });
      toast.success("Profile updated");
      setIsEditProfileOpen(false);
      setIsProfileMenuOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfileImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      event.target.value = "";
      return;
    }

    setUploadingProfileImage(true);
    try {
      const updatedUser = await uploadProfileImage(file);
      setProfileImage(updatedUser.avatar_url || "");
      toast.success("Profile image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload image");
    } finally {
      setUploadingProfileImage(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <motion.nav
        className={`sticky top-0 z-50 flex w-full items-center justify-between px-4 py-3.5 md:px-16 lg:px-24 transition-colors ${isScrolled ? "bg-black/50 backdrop-blur-lg" : ""}`}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 250, damping: 70, mass: 1 }}
      >
        <Link to="/">
          <Logo
            className="text-2xl"
            text="Genesis"
            shuffleDirection="right"
            duration={0.35}
            animationMode="evenodd"
            shuffleTimes={1}
            ease="power3.out"
            stagger={0.03}
            threshold={0.1}
            triggerOnce={true}
            triggerOnHover
            respectReducedMotion={true}
            loop={false}
            loopDelay={0}
          />
        </Link>

        <div className="hidden items-center space-x-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="text-sm text-gray-300 transition hover:text-orange-400"
            >
              {link.name}
            </Link>
          ))}
          {user ? (
            <div ref={profileMenuRef} className="relative">
              <button
                onClick={() => setIsProfileMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-gray-700/70 px-2 py-1 hover:border-orange-500/50 transition-colors"
                title={user.name || "Profile"}
              >
                <UserAvatar user={user} />
                <span className="text-sm text-gray-300 max-w-24 truncate">{user.name}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isProfileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-lg p-2 shadow-2xl z-50">
                  <button
                    onClick={() => setIsEditProfileOpen(true)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800 flex items-center gap-2"
                  >
                    <UserRoundCog className="w-4 h-4" />
                    <span>Change name/image</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-500/10 flex items-center gap-2"
                  >
                    <UserAvatar user={user} sizeClass="w-4 h-4" />
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/register" className="btn bg-linear-to-r from-orange-500 to-orange-600 text-sm border-0 shadow-lg shadow-orange-500/20">
              Sign Up
            </Link>
          )}
          <NetworkStatus />

        </div>

        <div className="flex items-center gap-3 md:hidden">
          <NetworkStatus />
          <button
            onClick={() => setIsOpen(true)}
            className="transition active:scale-90"
          >
            <MenuIcon className="size-6.5" />
          </button>
        </div>
      </motion.nav>

      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/20 text-lg font-medium backdrop-blur-2xl transition duration-300 md:hidden ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {links.map((link) => (
          <Link key={link.name} to={link.href} onClick={() => setIsOpen(false)} className="hover:text-orange-400 transition">
            {link.name}
          </Link>
        ))}

        {user ? (
          <>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsEditProfileOpen(true);
              }}
              className="flex items-center gap-3 hover:text-orange-400 transition"
            >
              <UserAvatar user={user} sizeClass="w-9 h-9" />
              <span>Change name/image</span>
            </button>
            <button onClick={() => { logout(); setIsOpen(false); }} className="btn glass flex items-center gap-2">
              <UserAvatar user={user} sizeClass="w-4 h-4" />
              Logout
            </button>
          </>
        ) : (
          <Link to="/register" className="btn bg-linear-to-r from-orange-500 to-orange-600 border-0" onClick={() => setIsOpen(false)}>
            Sign Up
          </Link>
        )}

        <button
          onClick={() => setIsOpen(false)}
          className="rounded-md p-2 glass"
        >
          <XIcon />
        </button>
      </div>

      {isEditProfileOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Name</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="input-field"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Profile image URL</label>
                <div className="flex items-center gap-2">
                  <input
                    value={profileImage}
                    onChange={(e) => setProfileImage(e.target.value)}
                    className="input-field"
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <button
                    type="button"
                    onClick={() => profileImageInputRef.current?.click()}
                    className="h-10 w-10 shrink-0 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 flex items-center justify-center"
                    title="Upload image from device"
                    disabled={uploadingProfileImage}
                  >
                    {uploadingProfileImage ? (
                      <span className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleProfileImageUpload}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Leave empty to remove profile image.</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
                disabled={savingProfile}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="btn-primary"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
