import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { ErrorPage } from "../components/ErrorPage";

export const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <ErrorPage />,
    lazy: async () => {
      const { LandingPage } = await import("../features/landing/LandingPage");
      return { element: <LandingPage /> };
    },
  },
  {
    path: "/login",
    errorElement: <ErrorPage />,
    lazy: async () => {
      const { AuthPage } = await import("../features/auth/AuthPage");
      return { element: <AuthPage /> };
    },
  },
  {
    path: "/signup",
    errorElement: <ErrorPage />,
    lazy: async () => {
      const { AuthPage } = await import("../features/auth/AuthPage");
      return { element: <AuthPage /> };
    },
  },
  {
    path: "/provider/register",
    errorElement: <ErrorPage />,
    lazy: async () => {
      const { ProviderRegisterPage } = await import("../features/auth/ProviderRegisterPage");
      return { element: <ProviderRegisterPage /> };
    },
  },

  // Unified Role Dashboard
  {
    path: "/:role/dashboard",
    errorElement: <ErrorPage />,
    lazy: async () => {
      const { DashboardLayout } = await import("../features/dashboard/DashboardLayout");
      return {
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
      };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { DashboardHome } = await import("../features/dashboard/pages/DashboardHome");
          return { element: <DashboardHome /> };
        },
      },
      {
        path: "newsfeed",
        lazy: async () => {
          const { NewsfeedPage } = await import("../features/dashboard/pages/NewsfeedPage");
          return { element: <NewsfeedPage /> };
        },
      },
      {
        path: "chat",
        lazy: async () => {
          const { ChatPage } = await import("../features/dashboard/pages/ChatPage");
          return { element: <ChatPage /> };
        },
      },
      {
        path: "call-history",
        lazy: async () => {
          const { default: CallHistoryRoute } = await import("../features/dashboard/pages/CallHistoryRoute");
          return { element: <CallHistoryRoute /> };
        },
      },

      {
        path: "membership",
        lazy: async () => {
          const { default: MembershipRoute } = await import("../features/dashboard/pages/MembershipRoute");
          return { element: <MembershipRoute /> };
        },
      },
      {
        path: "wallet",
        lazy: async () => {
          const { WalletPage } = await import("../features/dashboard/pages/WalletPage");
          return { element: <WalletPage /> };
        },
      },
      {
        path: "assets",
        lazy: async () => {
          const { AssetsPage } = await import("../features/dashboard/pages/AssetsPage");
          return { element: <AssetsPage /> };
        },
      },
      {
        path: "earnings",
        lazy: async () => {
          const { AssetsPage } = await import("../features/dashboard/pages/AssetsPage");
          return { element: <AssetsPage /> };
        },
      },
      {
        path: "network",
        lazy: async () => {
          const { NetworkPage } = await import("../features/dashboard/pages/NetworkPage");
          return { element: <NetworkPage /> };
        },
      },
      {
        path: "profile",
        lazy: async () => {
          const { ProfilePage } = await import("../features/dashboard/pages/ProfilePage");
          return { element: <ProfilePage /> };
        },
      },
      {
        path: "change-password",
        lazy: async () => {
          const { ChangePasswordPage } = await import("../features/dashboard/pages/ChangePasswordPage");
          return { element: <ChangePasswordPage /> };
        },
      },
      {
        path: "models",
        lazy: async () => {
          const { ModelsPage } = await import("../features/dashboard/pages/ModelsPage");
          return { element: <ModelsPage /> };
        },
      },
      {
        path: "providers",
        lazy: async () => {
          const { ProviderDirectoryPage } = await import("../features/dashboard/pages/ProviderDirectoryPage");
          return { element: <ProviderDirectoryPage /> };
        },
      },
      {
        path: "places",
        lazy: async () => {
          const { PlacesPage } = await import("../features/dashboard/pages/PlacesPage");
          return { element: <PlacesPage /> };
        },
      },
      {
        path: "bookings",
        lazy: async () => {
          const { BookingsPage } = await import("../features/dashboard/pages/BookingsPage");
          return { element: <BookingsPage /> };
        },
      },

      // Admin-only pages
      {
        path: "users",
        lazy: async () => {
          const { AdminUsersPage } = await import("../features/dashboard/pages/AdminUsersPage");
          return { element: <AdminUsersPage /> };
        },
      },
      {
        path: "settings",
        lazy: async () => {
          const { AdminSettingsPage } = await import("../features/dashboard/pages/AdminSettingsPage");
          return { element: <AdminSettingsPage /> };
        },
      },
      {
        path: "reports",
        lazy: async () => {
          const { default: AdminReportsPage } = await import("../features/dashboard/pages/AdminReportsPage");
          return { element: <AdminReportsPage /> };
        },
      },

      // Provider-only pages
      {
        path: "services",
        lazy: async () => {
          const { ProviderServicePage } = await import("../features/dashboard/pages/ProviderServicePage");
          return { element: <ProviderServicePage /> };
        },
      },
      {
        path: "providers",
        lazy: async () => {
          const { ProviderDirectoryPage } = await import("../features/dashboard/pages/ProviderDirectoryPage");
          return { element: <ProviderDirectoryPage /> };
        },
      },
      {
        path: "places",
        lazy: async () => {
          const { PlacesPage } = await import("../features/dashboard/pages/PlacesPage");
          return { element: <PlacesPage /> };
        },
      },
    ],
  },
]);

