import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, logout } = useAuth();

  const publicLinks = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/plans" },
  ];

  const authLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "New Project", href: "/new-project" },
    { name: "Settings", href: "/settings" },
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
            <button onClick={logout} className="btn glass text-sm">
              Logout
            </button>
          ) : (
            <Link to="/register" className="btn bg-gradient-to-r from-orange-500 to-orange-600 text-sm border-0 shadow-lg shadow-orange-500/20">
              Sign Up
            </Link>
          )}
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="transition active:scale-90 md:hidden"
        >
          <MenuIcon className="size-6.5" />
        </button>
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
          <button onClick={() => { logout(); setIsOpen(false); }} className="btn glass">
            Logout
          </button>
        ) : (
          <Link to="/register" className="btn bg-gradient-to-r from-orange-500 to-orange-600 border-0" onClick={() => setIsOpen(false)}>
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
