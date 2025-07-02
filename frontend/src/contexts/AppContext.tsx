import { createContext, useContext, useReducer, useEffect } from "react";
import type { ReactNode } from "react";
import type { User, Event } from "../services/api";
import UserService from "../services/userService";
import websocketService from "../services/websocketService";

// Types
interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  events: Event[];
  connectionStatus: {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  };
  notifications: Notification[];
}

interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

type AppAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_AUTHENTICATED"; payload: boolean }
  | { type: "ADD_EVENT"; payload: Event }
  | { type: "SET_EVENTS"; payload: Event[] }
  | { type: "UPDATE_CONNECTION_STATUS"; payload: AppState["connectionStatus"] }
  | { type: "ADD_NOTIFICATION"; payload: Notification }
  | { type: "MARK_NOTIFICATION_READ"; payload: string }
  | { type: "REMOVE_NOTIFICATION"; payload: string }
  | { type: "CLEAR_NOTIFICATIONS" };

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => void;
  markNotificationRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// Initial state
const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading true to check authentication on app startup
  error: null,
  events: [],
  connectionStatus: {
    connected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
  },
  notifications: [],
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_USER":
      return { ...state, user: action.payload };

    case "SET_AUTHENTICATED":
      return { ...state, isAuthenticated: action.payload };

    case "ADD_EVENT":
      return {
        ...state,
        events: [action.payload, ...state.events].slice(0, 100), // Keep last 100 events
      };

    case "SET_EVENTS":
      return { ...state, events: action.payload };

    case "UPDATE_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.payload };

    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
      };

    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((notification) =>
          notification.id === action.payload
            ? { ...notification, read: true }
            : notification
        ),
      };

    case "REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter(
          (notification) => notification.id !== action.payload
        ),
      };

    case "CLEAR_NOTIFICATIONS":
      return { ...state, notifications: [] };

    default:
      return state;
  }
}

// Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Helper function to generate notification ID
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Actions
  const login = async (email: string, password: string): Promise<void> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      // Temporary mock for testing - remove this when backend is working
      if (email === "test@example.com" && password === "password") {
        const mockUser = {
          id: "test-user-123",
          username: "testuser",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          role: "user" as const,
          isActive: true,
          isEmailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Store mock data in localStorage
        localStorage.setItem("userId", mockUser.id);
        localStorage.setItem("authToken", "mock-token-123");

        dispatch({ type: "SET_USER", payload: mockUser });
        dispatch({ type: "SET_AUTHENTICATED", payload: true });

        addNotification({
          type: "success",
          title: "Login Successful",
          message: `Welcome back, ${mockUser.firstName}!`,
        });
        return;
      }

      const response = await UserService.login({ email, password });

      dispatch({ type: "SET_USER", payload: response.data.user });
      dispatch({ type: "SET_AUTHENTICATED", payload: true });

      addNotification({
        type: "success",
        title: "Login Successful",
        message: `Welcome back, ${
          response.data.user.firstName || response.data.user.username
        }!`,
      });
    } catch (error: unknown) {
      let errorMessage = "Login failed";
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data
      ) {
        errorMessage =
          (error.response as { data?: { message?: string } }).data?.message ||
          errorMessage;
      }
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      addNotification({
        type: "error",
        title: "Login Failed",
        message: errorMessage,
      });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await UserService.logout();
    } catch (error: unknown) {
      console.warn("Logout error:", error);
    } finally {
      dispatch({ type: "SET_USER", payload: null });
      dispatch({ type: "SET_AUTHENTICATED", payload: false });
      dispatch({ type: "CLEAR_NOTIFICATIONS" });

      addNotification({
        type: "info",
        title: "Logged Out",
        message: "You have been successfully logged out.",
      });
    }
  };

  const loadUser = async (): Promise<void> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      if (!UserService.isAuthenticated()) {
        // No stored authentication, user needs to log in
        return;
      }

      // Temporary mock for testing - remove this when backend is working
      const authToken = localStorage.getItem("authToken");
      const userId = localStorage.getItem("userId");
      if (authToken === "mock-token-123" && userId === "test-user-123") {
        const mockUser = {
          id: "test-user-123",
          username: "testuser",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          role: "user" as const,
          isActive: true,
          isEmailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        dispatch({ type: "SET_USER", payload: mockUser });
        dispatch({ type: "SET_AUTHENTICATED", payload: true });
        return;
      }

      const response = await UserService.getProfile();
      dispatch({ type: "SET_USER", payload: response.data.user });
      dispatch({ type: "SET_AUTHENTICATED", payload: true });
    } catch (error: unknown) {
      console.error("Failed to load user:", error);
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "status" in error.response &&
        (error.response as { status?: number }).status === 401
      ) {
        // Token is invalid or expired, clear authentication
        await logout();
      }
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const addNotification = (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ): void => {
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      timestamp: new Date(),
      read: false,
    };
    dispatch({ type: "ADD_NOTIFICATION", payload: newNotification });

    // Auto-remove notification after a few seconds
    const autoRemoveDelay = notification.type === "error" ? 8000 : 5000; // Error notifications stay longer
    if (
      notification.type === "success" ||
      notification.type === "info" ||
      notification.type === "error"
    ) {
      setTimeout(() => {
        dispatch({ type: "REMOVE_NOTIFICATION", payload: newNotification.id });
      }, autoRemoveDelay);
    }
  };

  const markNotificationRead = (id: string): void => {
    dispatch({ type: "MARK_NOTIFICATION_READ", payload: id });
  };

  const removeNotification = (id: string): void => {
    dispatch({ type: "REMOVE_NOTIFICATION", payload: id });
  };

  const clearNotifications = (): void => {
    dispatch({ type: "CLEAR_NOTIFICATIONS" });
  };

  // Effects
  useEffect(() => {
    // Load user on app start
    loadUser();
  }, []);

  useEffect(() => {
    // Set up WebSocket event listeners
    const unsubscribeFromEvents = websocketService.subscribeToAll(
      (event: Event) => {
        dispatch({ type: "ADD_EVENT", payload: event });

        // Create notifications for important events
        if (
          event.type.includes("order.created") &&
          event.data.userId === state.user?.id
        ) {
          addNotification({
            type: "success",
            title: "Order Created",
            message: `Your order ${event.data.orderNumber} has been created successfully.`,
          });
        } else if (
          event.type.includes("order.shipped") &&
          event.data.userId === state.user?.id
        ) {
          addNotification({
            type: "info",
            title: "Order Shipped",
            message: `Your order ${event.data.orderNumber} has been shipped.`,
          });
        } else if (
          event.type.includes("order.delivered") &&
          event.data.userId === state.user?.id
        ) {
          addNotification({
            type: "success",
            title: "Order Delivered",
            message: `Your order ${event.data.orderNumber} has been delivered.`,
          });
        }
      }
    );

    const unsubscribeFromConnection = websocketService.onConnect(() => {
      dispatch({
        type: "UPDATE_CONNECTION_STATUS",
        payload: websocketService.getConnectionStatus(),
      });
    });

    const unsubscribeFromDisconnection = websocketService.onDisconnect(() => {
      dispatch({
        type: "UPDATE_CONNECTION_STATUS",
        payload: websocketService.getConnectionStatus(),
      });
    });

    const unsubscribeFromErrors = websocketService.onError((error: any) => {
      console.error("WebSocket error:", error);
      addNotification({
        type: "warning",
        title: "Connection Issue",
        message: "Real-time updates may be delayed due to connection issues.",
      });
    });

    return () => {
      unsubscribeFromEvents();
      unsubscribeFromConnection();
      unsubscribeFromDisconnection();
      unsubscribeFromErrors();
    };
  }, [state.user?.id]);

  const contextValue: AppContextType = {
    state,
    dispatch,
    login,
    logout,
    loadUser,
    addNotification,
    markNotificationRead,
    removeNotification,
    clearNotifications,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}

// Hook to use the context
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

export default AppContext;
