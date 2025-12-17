"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Tooltip as ReactTooltip } from "react-tooltip";
import * as countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

// Register locale for country name translation if needed
countries.registerLocale(enLocale);

// Use a reliable public URL for the world map topojson
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GeoData {
  country: string; // Country code (e.g., US, ID, RU)
  count: number;
}

export function GeoMap() {
  const [data, setData] = useState<GeoData[]>([]);
  const [tooltipContent, setTooltipContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/geo-distribution")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load geo data", err);
        setLoading(false);
      });
  }, []);

  // Create a map of ISO Numeric Code (string) -> count for TopoJSON matching
  const dataMap = useMemo(() => {
    const map: Record<string, number> = {};

    data.forEach((d) => {
      // Convert ISO Alpha-2 (from DB) to ISO Numeric (for TopoJSON)
      // alpha2ToNumeric returns string like "840"
      if (d.country && d.country.length === 2) {
         // Some specific fixes if needed, but library is generally good
         // Note: TopoJSON IDs often strip leading zeros, e.g. "4" instead of "004".
         // We will handle matching carefully.
         const numeric = countries.alpha2ToNumeric(d.country);
         if (numeric) {
            // Store both padded and unpadded to be safe?
            // Usually topojson from world-atlas uses strings but without leading zeros sometimes.
            // Let's store raw numeric string.
            map[numeric] = d.count;
            // Also store as number just in case
            map[Number(numeric).toString()] = d.count;
         }
      }
    });
    return map;
  }, [data]);

  // Determine max value for color scaling
  const maxCount = Math.max(1, ...data.map((d) => d.count));

   const colorScale = scaleLinear()
    .domain([0, maxCount])
    .range(["#EAEAEC", "#EF4444"]); // Light gray to Red-500

  return (
    <div className="w-full h-[500px] border rounded-xl overflow-hidden bg-card relative flex flex-col">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
         <h3 className="text-lg font-semibold">Global Infection Distribution</h3>
         <p className="text-sm text-muted-foreground">Devices by Country</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">Loading map visualization...</div>
      ) : (
        <>
            <ComposableMap projectionConfig={{ scale: 147 }} className="w-full h-full">
                <ZoomableGroup>
                <Geographies geography={GEO_URL}>
                    {({ geographies }: { geographies: any[] }) =>
                    geographies.map((geo) => {
                        // geo.id is the ISO Numeric code (e.g., "840", "004")
                        // We try to match with our map
                        const geoId = geo.id as string;
                        const count = dataMap[geoId] || dataMap[Number(geoId).toString()] || 0;

                        const countryName = geo.properties.name;

                        return (
                        <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={count > 0 ? colorScale(count) : "#F5F5F5"}
                            stroke="#D6D6DA"
                            strokeWidth={0.5}
                            style={{
                                default: { outline: "none" },
                                hover: { fill: "#3b82f6", outline: "none", cursor: "pointer" },
                                pressed: { outline: "none" },
                            }}
                            onMouseEnter={() => {
                                setTooltipContent(`${countryName}: ${count} devices`);
                            }}
                            onMouseLeave={() => {
                                setTooltipContent("");
                            }}
                            data-tooltip-id="geo-tooltip"
                            data-tooltip-content={`${countryName}: ${count} devices`}
                        />
                        );
                    })
                    }
                </Geographies>
                </ZoomableGroup>
            </ComposableMap>
            <ReactTooltip id="geo-tooltip" />
        </>
      )}
    </div>
  );
}
