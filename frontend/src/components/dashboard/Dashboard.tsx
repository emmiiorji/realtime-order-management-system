import { useState, useEffect } from "react";
import { useApp } from "../../contexts/AppContext";
import OrderService from "../../services/orderService";
import EventService from "../../services/eventService";
import OrderForm from "../OrderForm";
import Modal from "../ui/Modal";
import type { Order, Event } from "../../services/api";

export function Dashboard() {
  const { state, addNotification } = useApp();
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalSpent: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load recent orders
      const ordersResponse = await OrderService.getMyOrders({ limit: 5 });
      setRecentOrders(ordersResponse.data.orders);

      // Calculate user stats
      const allOrdersResponse = await OrderService.getMyOrders({ limit: 100 });
      const allOrders = allOrdersResponse.data.orders;

      const userStats = {
        totalOrders: allOrders.length,
        pendingOrders: allOrders.filter((order) =>
          ["pending", "confirmed", "processing"].includes(order.status)
        ).length,
        completedOrders: allOrders.filter(
          (order) => order.status === "delivered"
        ).length,
        totalSpent: allOrders
          .filter((order) => order.status !== "cancelled")
          .reduce((total, order) => total + order.totalAmount, 0),
      };
      setStats(userStats);

      // Load recent events
      const eventsResponse = await EventService.getAllEvents({ limit: 10 });
      setRecentEvents(eventsResponse.data.events);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderSuccess = (order: Order) => {
    addNotification({
      type: "success",
      title: "Order Created Successfully",
      message: `Order #${order.orderNumber} has been created and is being processed.`,
    });
    setShowOrderForm(false);
    loadDashboardData(); // Refresh the dashboard data
  };

  const handleOrderError = (error: string) => {
    addNotification({
      type: "error",
      title: "Order Creation Failed",
      message: error,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      processing: "bg-purple-100 text-purple-800",
      shipped: "bg-indigo-100 text-indigo-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <div className="dashboard-content space-y-6">
        {/* Welcome Section */}
        <div className="card">
          <div className="flex justify-between items-start">
            <div>
              <h1
                style={{
                  fontSize: "var(--font-size-3xl)",
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--color-gray-900)",
                  marginBottom: "var(--spacing-3)",
                }}
              >
                Welcome back, {state.user?.firstName || state.user?.username}!
              </h1>
              <p style={{ color: "var(--color-gray-600)" }}>
                Here's what's happening with your account today.
              </p>
            </div>
            <button
              onClick={() => setShowOrderForm(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <span>Create New Order</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "var(--spacing-6)",
          }}
        >
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    backgroundColor: "var(--color-primary)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
              </div>
              <div style={{ marginLeft: "var(--spacing-4)" }}>
                <p
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: "var(--font-weight-medium)",
                    color: "var(--color-gray-500)",
                  }}
                >
                  Total Orders
                </p>
                <p
                  style={{
                    fontSize: "var(--font-size-3xl)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: "var(--color-gray-900)",
                  }}
                >
                  {stats.totalOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    backgroundColor: "var(--color-warning)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div style={{ marginLeft: "var(--spacing-4)" }}>
                <p
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: "var(--font-weight-medium)",
                    color: "var(--color-gray-500)",
                  }}
                >
                  Pending Orders
                </p>
                <p
                  style={{
                    fontSize: "var(--font-size-3xl)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: "var(--color-gray-900)",
                  }}
                >
                  {stats.pendingOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    backgroundColor: "var(--color-success)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <div style={{ marginLeft: "var(--spacing-4)" }}>
                <p
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: "var(--font-weight-medium)",
                    color: "var(--color-gray-500)",
                  }}
                >
                  Completed Orders
                </p>
                <p
                  style={{
                    fontSize: "var(--font-size-3xl)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: "var(--color-gray-900)",
                  }}
                >
                  {stats.completedOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    backgroundColor: "var(--color-secondary)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                </div>
              </div>
              <div style={{ marginLeft: "var(--spacing-4)" }}>
                <p
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: "var(--font-weight-medium)",
                    color: "var(--color-gray-500)",
                  }}
                >
                  Total Spent
                </p>
                <p
                  style={{
                    fontSize: "var(--font-size-3xl)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: "var(--color-gray-900)",
                  }}
                >
                  {formatCurrency(stats.totalSpent)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders and Events */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "var(--spacing-6)",
          }}
        >
          {/* Recent Orders */}
          <div className="card">
            <div
              style={{
                paddingBottom: "var(--spacing-4)",
                borderBottom: "1px solid var(--color-gray-200)",
                marginBottom: "var(--spacing-6)",
              }}
            >
              <h3
                style={{
                  fontSize: "var(--font-size-xl)",
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--color-gray-900)",
                }}
              >
                Recent Orders
              </h3>
            </div>
            <div>
              {recentOrders.length === 0 ? (
                <p
                  style={{
                    color: "var(--color-gray-500)",
                    textAlign: "center",
                    padding: "var(--spacing-4)",
                  }}
                >
                  No orders yet
                </p>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "var(--spacing-4)",
                        border: "1px solid var(--color-gray-200)",
                        borderRadius: "var(--radius-lg)",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontWeight: "var(--font-weight-medium)",
                            color: "var(--color-gray-900)",
                          }}
                        >
                          #{order.orderNumber}
                        </p>
                        <p
                          style={{
                            fontSize: "var(--font-size-sm)",
                            color: "var(--color-gray-500)",
                          }}
                        >
                          {formatDate(order.createdAt)}
                        </p>
                        <p
                          style={{
                            fontSize: "var(--font-size-sm)",
                            fontWeight: "var(--font-weight-medium)",
                            color: "var(--color-gray-900)",
                          }}
                        >
                          {formatCurrency(order.totalAmount)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Events */}
          <div className="card">
            <div
              style={{
                paddingBottom: "var(--spacing-4)",
                borderBottom: "1px solid var(--color-gray-200)",
                marginBottom: "var(--spacing-6)",
              }}
            >
              <h3
                style={{
                  fontSize: "var(--font-size-xl)",
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--color-gray-900)",
                }}
              >
                Recent Activity
              </h3>
            </div>
            <div>
              {recentEvents.length === 0 ? (
                <p
                  style={{
                    color: "var(--color-gray-500)",
                    textAlign: "center",
                    padding: "var(--spacing-4)",
                  }}
                >
                  No recent activity
                </p>
              ) : (
                <div className="space-y-4">
                  {recentEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "var(--spacing-3)",
                      }}
                    >
                      <div style={{ flexShrink: 0 }}>
                        <div
                          style={{
                            width: "0.5rem",
                            height: "0.5rem",
                            backgroundColor: "var(--color-primary)",
                            borderRadius: "50%",
                            marginTop: "var(--spacing-2)",
                          }}
                        ></div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "var(--font-size-sm)",
                            fontWeight: "var(--font-weight-medium)",
                            color: "var(--color-gray-900)",
                          }}
                        >
                          {event.type
                            .replace(/\./g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                        <p
                          style={{
                            fontSize: "var(--font-size-sm)",
                            color: "var(--color-gray-500)",
                          }}
                        >
                          {formatDate(event.metadata.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3
                style={{
                  fontSize: "var(--font-size-xl)",
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--color-gray-900)",
                }}
              >
                Real-time Connection
              </h3>
              <p
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-gray-500)",
                }}
              >
                {state.connectionStatus.connected
                  ? "Connected - You'll receive real-time updates"
                  : "Disconnected - Updates may be delayed"}
              </p>
            </div>
            <div
              style={{
                width: "0.75rem",
                height: "0.75rem",
                borderRadius: "50%",
                backgroundColor: state.connectionStatus.connected
                  ? "var(--color-success)"
                  : "var(--color-error)",
              }}
            ></div>
          </div>
        </div>

        {/* Order Form Modal */}
        <Modal
          isOpen={showOrderForm}
          onClose={() => setShowOrderForm(false)}
          title="Create New Order"
          closeOnOverlayClick={true}
          closeOnEscape={true}
        >
          <OrderForm
            onSuccess={handleOrderSuccess}
            onError={handleOrderError}
          />
        </Modal>
      </div>
    </div>
  );
}

export default Dashboard;
