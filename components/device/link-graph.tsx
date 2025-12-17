"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GraphData {
  nodes: { id: string; name: string; type: string; val: number }[];
  links: { source: string; target: string; label?: string }[];
}

interface LinkGraphProps {
  deviceId: string;
}

// We need to dynamically import ForceGraph to avoid SSR issues
import dynamic from 'next/dynamic';
const ForceGraph2DNoSSR = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Loading graph engine...</div>
});

export function LinkGraph({ deviceId }: LinkGraphProps) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fgRef = useRef<ForceGraphMethods>();
  const { theme } = useTheme();

  const isDark = theme === 'dark' || theme === 'system'; // Approximation

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/graph/data?deviceId=${deviceId}`);
      if (res.ok) {
        const graphData = await res.json();
        setData(graphData);
      }
    } catch (error) {
      console.error("Failed to load graph data", error);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleZoomIn = () => {
    fgRef.current?.zoom((fgRef.current?.zoom() || 1) * 1.2, 400);
  };

  const handleZoomOut = () => {
    fgRef.current?.zoom((fgRef.current?.zoom() || 1) / 1.2, 400);
  };

  const handleCenter = () => {
    fgRef.current?.zoomToFit(400, 50);
  };

  return (
    <Card className={`relative overflow-hidden border border-white/10 glass-card transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-background' : 'h-[600px] w-full'}`}>

      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
         <Button variant="secondary" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} title="Toggle Fullscreen">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
         </Button>
         <Button variant="secondary" size="icon" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
         </Button>
         <Button variant="secondary" size="icon" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
         </Button>
         <Button variant="secondary" size="icon" onClick={handleCenter} title="Center Graph">
            <RefreshCw className="h-4 w-4" />
         </Button>
      </div>

      <div className="absolute top-4 left-4 z-10 pointer-events-none">
         <h3 className="text-lg font-semibold bg-background/50 backdrop-blur-md px-2 rounded">Link Analysis</h3>
         <div className="flex flex-col gap-1 mt-2 text-xs bg-background/50 backdrop-blur-md p-2 rounded">
             <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Device</div>
             <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> IP Address</div>
             <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Domain</div>
         </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-full">Loading graph data...</div>
      ) : data.nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">No connections found.</div>
      ) : (
        <ForceGraph2DNoSSR
            ref={fgRef}
            graphData={data}
            nodeLabel="name"
            nodeRelSize={6}
            backgroundColor={isDark ? "#00000000" : "#ffffff"} // Transparent for glass effect or white
            linkColor={() => isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
            nodeColor={(node: any) => {
                if (node.type === 'device') return '#3b82f6'; // blue
                if (node.type === 'ip') return '#10b981'; // emerald
                if (node.type === 'domain') return '#f59e0b'; // amber
                return '#9ca3af';
            }}
            width={isFullscreen ? window.innerWidth : undefined}
            height={isFullscreen ? window.innerHeight : 600}
            onNodeClick={node => {
                // Focus on node
                fgRef.current?.centerAt(node.x, node.y, 1000);
                fgRef.current?.zoom(4, 2000);
            }}
        />
      )}
    </Card>
  );
}
