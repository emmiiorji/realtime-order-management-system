import { useState } from "react";
import UserService from "../../services/userService";
import { useApp } from "../../contexts/AppContext";

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: RegisterFormProps) {
  const { addNotification } = useApp();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9]+$/.test(formData.username)) {
      newErrors.username = "Username can only contain letters and numbers";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(formData.password)) {
      newErrors.password =
        "Password must contain at least one lowercase letter, one uppercase letter, and one number";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await UserService.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      addNotification({
        type: "success",
        title: "Registration Successful",
        message: "Your account has been created successfully. Please sign in.",
      });

      onSuccess?.();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Registration failed";

      addNotification({
        type: "error",
        title: "Registration Failed",
        message: errorMessage,
      });

      // Handle specific validation errors
      if (error.response?.data?.errors) {
        const apiErrors: Record<string, string> = {};
        error.response.data.errors.forEach((err: string) => {
          if (err.includes("email")) apiErrors.email = err;
          if (err.includes("username")) apiErrors.username = err;
          if (err.includes("password")) apiErrors.password = err;
        });
        setErrors(apiErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Create Account</h2>
        <p
          style={{
            color: "var(--color-gray-600)",
            fontSize: "var(--font-size-sm)",
            marginTop: "var(--spacing-2)",
          }}
        >
          Fill in your details to create a new account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--spacing-4)",
          }}
        >
          <div className="form-group">
            <label htmlFor="firstName" className="form-label">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First name"
              disabled={isLoading}
              style={{
                borderColor: errors.firstName
                  ? "var(--color-error)"
                  : undefined,
              }}
            />
            {errors.firstName && (
              <p className="form-error">{errors.firstName}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="lastName" className="form-label">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last name"
              disabled={isLoading}
              style={{
                borderColor: errors.lastName ? "var(--color-error)" : undefined,
              }}
            />
            {errors.lastName && <p className="form-error">{errors.lastName}</p>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="username" className="form-label">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Choose a username"
            disabled={isLoading}
            style={{
              borderColor: errors.username ? "var(--color-error)" : undefined,
            }}
          />
          {errors.username && <p className="form-error">{errors.username}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            disabled={isLoading}
            style={{
              borderColor: errors.email ? "var(--color-error)" : undefined,
            }}
          />
          {errors.email && <p className="form-error">{errors.email}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Create a password"
            disabled={isLoading}
            style={{
              borderColor: errors.password ? "var(--color-error)" : undefined,
            }}
          />
          {errors.password && <p className="form-error">{errors.password}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword" className="form-label">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm your password"
            disabled={isLoading}
            style={{
              borderColor: errors.confirmPassword
                ? "var(--color-error)"
                : undefined,
            }}
          />
          {errors.confirmPassword && (
            <p className="form-error">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary"
          style={{
            width: "100%",
            padding: "var(--spacing-4) var(--spacing-6)",
            fontSize: "var(--font-size-base)",
            fontWeight: "var(--font-weight-medium)",
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div
                className="spinner"
                style={{ marginRight: "var(--spacing-2)" }}
              ></div>
              Creating Account...
            </div>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <div style={{ marginTop: "var(--spacing-6)", textAlign: "center" }}>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-gray-600)",
          }}
        >
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-primary)",
              fontWeight: "var(--font-weight-medium)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export default RegisterForm;
