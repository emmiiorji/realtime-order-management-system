import { useState } from "react";
import { useApp } from "../../contexts/AppContext";

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const { login, state } = useApp();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await login(formData.email, formData.password);
      onSuccess?.();
    } catch (error) {
      // Error is handled in the context
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Sign In / Sign Up</h2>
        <p
          style={{
            color: "var(--color-gray-600)",
            fontSize: "var(--font-size-sm)",
            marginTop: "var(--spacing-2)",
          }}
        >
          If you don't have an account, one will be created automatically.
        </p>
      </div>

      {state.error && <div className="alert alert-error">{state.error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Username
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={errors.email ? "error" : ""}
            placeholder="Username"
            disabled={state.isLoading}
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
            className={errors.password ? "error" : ""}
            placeholder="Password"
            disabled={state.isLoading}
            style={{
              borderColor: errors.password ? "var(--color-error)" : undefined,
            }}
          />
          {errors.password && <p className="form-error">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={state.isLoading}
          className="btn-primary"
          style={{
            width: "100%",
            padding: "var(--spacing-4) var(--spacing-6)",
            fontSize: "var(--font-size-base)",
            fontWeight: "var(--font-weight-medium)",
          }}
        >
          {state.isLoading ? (
            <div className="flex items-center justify-center">
              <div
                className="spinner"
                style={{ marginRight: "var(--spacing-2)" }}
              ></div>
              Signing In...
            </div>
          ) : (
            "Sign In / Sign Up"
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
          Username: 3-20 characters, Password: 6+ characters
        </p>
      </div>

      <div style={{ marginTop: "var(--spacing-6)", textAlign: "center" }}>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-gray-600)",
          }}
        >
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-primary)",
              fontWeight: "var(--font-weight-medium)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}

export default LoginForm;
