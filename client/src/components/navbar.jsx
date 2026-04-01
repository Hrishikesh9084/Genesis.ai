import { MenuIcon, XIcon, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
  const navigate = useNavigate();
  const { user } = useAuth();

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
    ...(isAdminUser ? [{ name: "Admin", href: "/admin/applications" }] : []),
  ];

  const loggedInTopLinks = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/plans" },
  ];

  const loggedInNavSections = [
    {
      name: "Careers",
      links: [
        { name: "Open Roles", href: "/careers" },
        { name: "Apply", href: "/careers/apply" },
        { name: "Track Status", href: "/careers/status" },
      ],
    },
    {
      name: "Workspace",
      links: authLinks,
    },
    {
      name: "Platform",
      links: [
        { name: "About", href: "/about" },
        { name: "Contact", href: "/contact" },
      ],
    },
  ];

  const mobileLinks = user ? [...publicLinks, ...authLinks] : publicLinks;

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
          {user ? (
            <div className="flex items-center gap-5">
              {loggedInTopLinks.map((link) => (
                <Link
                  key={`top-${link.name}`}
                  to={link.href}
                  className="text-sm text-gray-300 transition hover:text-orange-400"
                >
                  {link.name}
                </Link>
              ))}

              {loggedInNavSections.map((section) => (
                <div key={section.name} className="group relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm text-gray-300 transition hover:text-orange-400"
                  >
                    <span>{section.name}</span>
                    <ChevronDown className="h-4 w-4 text-gray-500 transition group-hover:text-orange-400" />
                  </button>

                  <div className="invisible absolute left-0 top-full z-50 mt-3 min-w-48 rounded-xl border border-gray-700 bg-gray-900/95 p-2 opacity-0 shadow-2xl backdrop-blur-lg transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    {section.links.map((link) => (
                      <Link
                        key={`${section.name}-${link.name}`}
                        to={link.href}
                        className="block rounded-lg px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 hover:text-orange-300"
                      >
                        {link.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            publicLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="text-sm text-gray-300 transition hover:text-orange-400"
              >
                {link.name}
              </Link>
            ))
          )}
          {user ? (
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-2 rounded-full border border-gray-700/70 px-3 py-1 hover:border-orange-500/50 transition-colors"
              title={user.name || "Profile"}
            >
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  navigate("/plans");
                }}
                className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-300 hover:bg-orange-500/20"
                title="Buy credits"
              >
                {Number(user?.credits || 0)} credits
              </span>
              <UserAvatar user={user} />
              <span className="text-sm text-gray-300 max-w-24 truncate">{user.name}</span>
            </button>
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
        {user && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate("/plans");
            }}
            className="rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-sm text-orange-300 hover:bg-orange-500/20 cursor-pointer"
          >
            Credits: {Number(user?.credits || 0)}
          </button>
        )}
          
        {mobileLinks.map((link) => (
          <Link key={link.name} to={link.href} onClick={() => setIsOpen(false)} className="hover:text-orange-400 transition">
            {link.name}
          </Link>
        ))}
          |
        {!user && (
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
    </>
  );
}
