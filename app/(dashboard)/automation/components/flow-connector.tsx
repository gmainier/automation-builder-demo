"use client";

import { cn } from "@/lib/utils";

interface FlowConnectorProps {
  height?: number;
  animated?: boolean;
  className?: string;
}

export function FlowConnector({ height = 32, animated = true, className }: FlowConnectorProps) {
  const svgWidth = 48;
  const midX = svgWidth / 2;
  const stroke = animated ? "#8b5cf6" : "#d4d4d8";

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <svg width={svgWidth} height={height} viewBox={`0 0 ${svgWidth} ${height}`} className="overflow-visible">
        {/* Main connector line — violet when connecting to a next step, muted grey at the tail */}
        <line
          x1={midX}
          y1="0"
          x2={midX}
          y2={height}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={animated ? undefined : "3 3"}
          opacity={animated ? 1 : 0.8}
        />

        {/* Animated flow dot — only on active mid-flow segments */}
        {animated && (
          <circle r="3" fill="#8b5cf6">
            <animate attributeName="cy" values={`0;${height}`} dur="1.5s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.1;0.9;1"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate attributeName="cx" values={`${midX};${midX}`} dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </div>
  );
}

// Simpler CSS-based animated connector (alternative)
interface FlowConnectorSimpleProps {
  animated?: boolean;
  className?: string;
}

export function FlowConnectorSimple({ animated = true, className }: FlowConnectorSimpleProps) {
  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div className="relative h-8 w-0.5 overflow-hidden rounded-full bg-gradient-to-b from-primary/50 via-primary/30 to-primary/50">
        {animated && (
          <div className="absolute inset-0 animate-flow-down">
            <div className="h-3 w-full rounded-full bg-gradient-to-b from-transparent via-primary to-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}

// Full connector section with AddNodeButton slot
interface FlowConnectorSectionProps {
  animated?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function FlowConnectorSection({ animated = true, children, className }: FlowConnectorSectionProps) {
  return (
    <div className={cn("flex flex-col items-center py-1", className)}>
      {/* Top connector segment */}
      <FlowConnector height={20} animated={animated} />

      {/* Center slot for AddNodeButton */}
      {children && <div className="relative z-10 -my-1">{children}</div>}

      {/* Bottom connector segment */}
      <FlowConnector height={20} animated={animated} />
    </div>
  );
}

// Zapier-style simple purple connector
interface ZapierConnectorProps {
  children?: React.ReactNode;
  className?: string;
}

export function ZapierConnector({ children, className }: ZapierConnectorProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Top line */}
      <div className="w-0.5 h-6 bg-violet-500" />

      {/* Center slot for button */}
      {children && <div className="relative z-10">{children}</div>}

      {/* Bottom line */}
      <div className="w-0.5 h-6 bg-violet-500" />
    </div>
  );
}
