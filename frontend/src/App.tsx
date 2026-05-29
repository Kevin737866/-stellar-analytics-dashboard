/**
 * App root (issue #49)
 *
 * Wraps the application in ApolloProvider so every component can use
 * Apollo hooks (useQuery, useMutation, useSubscription).
 * Also wraps in ThemeProvider for dark mode support.
 */
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "./graphql/client";
import { DashboardPage } from "./pages/DashboardPage";
import { ThemeProvider } from "./contexts/ThemeContext";

export function App() {
  return (
    <ThemeProvider>
      <ApolloProvider client={apolloClient}>
        <DashboardPage />
      </ApolloProvider>
    </ThemeProvider>
  );
}
