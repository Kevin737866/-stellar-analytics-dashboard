/**
 * App root (issue #49)
 *
 * Wraps the application in ApolloProvider so every component can use
 * Apollo hooks (useQuery, useMutation, useSubscription).
<<<<<<< HEAD
 * Also wraps in ThemeProvider for dark mode support.
=======
 * Wraps the application in ThemeProvider for dark mode support.
>>>>>>> 2e4ca07 (feat: implement dark mode with theme toggle and persistence)
 */
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "./graphql/client";
import { DashboardPage } from "./pages/DashboardPage";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

export function App() {
  return (
    <ThemeProvider>
      <ApolloProvider client={apolloClient}>
        <LanguageSwitcher />
        <DashboardPage />
      </ApolloProvider>
    </ThemeProvider>
  );
}
