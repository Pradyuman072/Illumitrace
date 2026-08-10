"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

interface Props {
  children?: ReactNode
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full min-h-[300px] p-6 bg-destructive/10 border border-destructive/20 rounded-md text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold text-destructive mb-2">
            {this.props.fallbackMessage || "This circuit couldn't be loaded"}
          </h2>
          <p className="text-sm text-destructive/80 max-w-md">
            The saved data for this circuit appears to be corrupted or malformed. Validation was likely bypassed in a previous version.
          </p>
          <button 
            className="mt-6 px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm hover:opacity-90 transition-opacity"
            onClick={() => window.location.reload()}
          >
            Reload Workspace
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
