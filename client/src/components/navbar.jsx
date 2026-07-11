import { MenuIcon, XIcon, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import NetworkStatus from "./NetworkStatus";

function getUserInitial(user) {
  if (!user?.name) return "U";
  return user.name.trim().charAt(0).toUpperCase();
}

function UserAvatar({ user, sizeClass = "md:w-11 md:h-11 cursor-pointer" }) {
  if (!user) return null;
  const avatarUrl = user.avatar_url || user.avatarUrl || user.profile_image_url || null;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user.name || "Profile"}
        className={`${sizeClass} shrink-0 rounded-full border border-gray-700/70 object-cover`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="#111827"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="#fdba74" font-family="Arial, sans-serif" font-size="18" font-weight="700">${getUserInitial(user)}</text></svg>`,
          )}`;
        }}
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
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownContainerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const publicLinks = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/plans" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  const isAdminUser =
    user?.is_admin === true ||
    String(user?.is_admin || "").toLowerCase() === "true" ||
    String(user?.role || "").toLowerCase() === "admin";

  const authLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "AI CTO", href: "/ai-cto" },
    { name: "Domains", href: "/domains" },
    { name: "New Project", href: "/new-project" },
  ];

  const adminLinks = isAdminUser
    ? [
        { name: "Job Applications", href: "/admin/applications" },
        { name: "Newsletter", href: "/admin/newsletter" },
      ]
    : [];

  const loggedInTopLinks = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/plans" },
  ];

  const loggedInNavSections = [
    {
      name: "Workspace",
      links: authLinks,
    },
    ...(isAdminUser
      ? [
          {
            name: "Admin",
            links: adminLinks,
          },
        ]
      : []),
    {
      name: "Platform",
      links: [
        { name: "About", href: "/about" },
        { name: "Contact", href: "/contact" },
      ],
    },
  ];

  const mobileLinks = user
    ? [...publicLinks, ...authLinks, ...adminLinks]
    : [...publicLinks];

  useEffect(() => {
    setActiveDropdown(null);
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target)
      ) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      <style>{`
                @keyframes shine {
                    0% {
                        background-position: 0% 50%;
                    }
            
                    50% {
                        background-position: 100% 50%;
                    }
            
                    100% {
                        background-position: 0% 50%;
                    }
                }
            
                .button-bg {
                    background: conic-gradient(from 0deg, #00F5FF, #000, #000, #00F5FF, #000, #000, #000, #00F5FF);
                    background-size: 300% 300%;
                    animation: shine 6s ease-out infinite;
                }
            `}</style>
      <motion.nav
        className="sticky top-0 z-50 flex w-full items-center justify-between px-4 py-3.5 transition-colors md:px-16 lg:px-24 backdrop-blur-lg "
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 250, damping: 70, mass: 1 }}
      >
        <Link to="/">
          <Logo
            className="text-2xl"
            text="GENESIS"
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

        <div className="hidden items-center space-x-8 transition-all duration-300 md:flex">
          {user ? (
            <div ref={dropdownContainerRef} className="flex items-center gap-5">
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
                    onClick={() =>
                      setActiveDropdown((current) =>
                        current === section.name ? null : section.name,
                      )
                    }
                    className="inline-flex items-center gap-1 text-sm text-gray-300 transition hover:text-orange-400"
                  >
                    <span>{section.name}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-500 transition ${
                        activeDropdown === section.name
                          ? "rotate-180 text-orange-400"
                          : "group-hover:text-orange-400"
                      }`}
                    />
                  </button>

                  <div
                    role="menu"
                    className={`absolute left-0 top-full z-50 mt-2 min-w-[16rem] rounded-xl border border-gray-700 bg-gradient-to-b from-gray-900/95 to-gray-900/80 p-3 shadow-2xl backdrop-blur-lg transform transition-all duration-200 origin-top-left ${
                      activeDropdown === section.name
                        ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                        : "opacity-0 translate-y-1 scale-95 pointer-events-none"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      {section.links.map((link) => (
                        <Link
                          key={`${section.name}-${link.name}`}
                          to={link.href}
                          onClick={() => setActiveDropdown(null)}
                          role="menuitem"
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800/60 hover:text-orange-300"
                        >
                          <span className="flex h-2 w-2 shrink-0 rounded-full bg-orange-400/60" />
                          <span>{link.name}</span>
                        </Link>
                      ))}
                    </div>
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/plans")}
                className="rounded-full border border-orange-500 bg-transparent px-7 py-2 text-sm font-medium text-white cursor-pointer"
                title="Buy credits"
              >
                {Number(user?.credits || 0)} credits
              </button>
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="rounded-full transition hover:scale-105 "
                title={user.name || "Profile"}
              >
                <UserAvatar user={user}/>
              </button>
            </div>
          ) : (
            <Link
              to="/register"
              className="btn bg-linear-to-r from-orange-500 to-orange-600 text-sm border-0 shadow-lg shadow-orange-500/20"
            >
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
          <div className="button-bg rounded-full p-0.5 hover:scale-105 transition duration-300 active:scale-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/plans");
              }}
              className="px-8 text-sm py-2.5 text-white rounded-full font-medium bg-gray-800"
            >
              Credits: {Number(user?.credits || 0)}
            </button>
          </div>
        )}

        {user && (
          <button
            type="button"
            onClick={() => {
              logout();
              setIsOpen(false);
              navigate("/");
            }}
            className="rounded-full border border-red-500/30 bg-red-500/10 px-6 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20 hover:text-red-100"
          >
            Logout
          </button>
        )}

        {mobileLinks.map((link) => (
          <Link
            key={link.name}
            to={link.href}
            onClick={() => setIsOpen(false)}
            className="hover:text-orange-400 transition"
          >
            {link.name}
          </Link>
        ))}

        {!user && (
          <Link
            to="/register"
            className="btn bg-linear-to-r from-orange-500 to-orange-600 border-0"
            onClick={() => setIsOpen(false)}
          >
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
