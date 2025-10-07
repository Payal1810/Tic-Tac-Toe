"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { socket } from "@/lib/socketClient";
import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "@/lib/validation";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { isAuthenticated, login } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/room");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    // Frontend validation using Yup schemas
    const usernameValidation = validateUsername(formData.username);
    if (!usernameValidation.success) {
      setError(usernameValidation.error || "Invalid username");
      setLoading(false);
      return;
    }

    if (!isLogin) {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.success) {
        setError(emailValidation.error || "Invalid email");
        setLoading(false);
        return;
      }
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.success) {
      setError(passwordValidation.error || "Invalid password");
      setLoading(false);
      return;
    }

    if (isLogin) {
      // Login flow
      socket.emit("login", {
        username: formData.username,
        password: formData.password,
      });

      socket.once("login_result", (result) => {
        if (result.success && result.user) {
          login(result.user);
          router.push("/room");
        } else {
          setError(result.error || "Login failed");
        }
        setLoading(false);
      });
    } else {
      // Register flow
      socket.emit("register", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      socket.once("register_result", (result) => {
        if (result.success) {
          setError("Registration successful! Please login.");
          setIsLogin(true);
          setFormData({ username: "", email: "", password: "" });
        } else {
          setError(result.error || "Registration failed");
        }
        setLoading(false);
      });
    }

    // Timeout handling
    setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError("Request timeout. Please try again.");
      }
    }, 10000);
  };

  const handleInputChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setFormData({ username: "", email: "", password: "" });
  };

  // Don't render if authenticated (will redirect)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Redirecting...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            TicTacToe
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="text"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Username"
                value={formData.username}
                onChange={handleInputChange("username")}
                disabled={loading}            
              />
            </div>

            {!isLogin && (
              <div>
                <input
                  type="email"               
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleInputChange("email")}
                  disabled={loading}              
                />
              </div>
            )}

            <div>
              <input
                type="password"             
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange("password")}
                disabled={loading}            
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center" role="alert">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : isLogin ? "Sign in" : "Register"}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-indigo-600 hover:text-indigo-500"
              onClick={toggleMode}
              disabled={loading}
            >
              {isLogin
                ? "Don't have an account? Register"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}