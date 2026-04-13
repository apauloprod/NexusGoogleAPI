import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let message = "An unexpected error occurred.";
      try {
        const parsed = JSON.parse(error?.message || "");
        if (parsed.error && parsed.operationType) {
          message = `Database error during ${parsed.operationType}: ${parsed.error}`;
        }
      } catch {
        message = error?.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-black">
          <div className="max-w-md w-full glass p-8 rounded-3xl border-white/10 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-white text-black hover:bg-white/90 rounded-full px-8"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
