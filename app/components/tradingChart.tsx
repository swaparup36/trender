"use client";

import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { cahrtDataType } from "@/types/types";

interface CandleChartProps {
  data: cahrtDataType[];
}

const CandleChart: React.FC<CandleChartProps> = ({ data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Check if we have valid data
    if (!data || data.length === 0) {
      // Display a message when no data is available
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = `
          <div style="
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100%; 
            color: #888; 
            font-size: 14px;
            background: #0a0e27;
            border-radius: 8px;
          ">
            No chart data available
          </div>
        `;
      }
      return;
    }

    // Clear any previous content
    chartContainerRef.current.innerHTML = '';

    try {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: {
          textColor: "#ffffff",
        },
        grid: {
          vertLines: { color: "#2a2e39" },
          horzLines: { color: "#2a2e39" },
        },
        crosshair: {
          mode: 1,
        },
        timeScale: {
          borderColor: "#485c7b",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // Set background color after creation
      chart.applyOptions({
        layout: {
          textColor: "#ffffff",
        }
      });

      console.log("Chart created successfully");

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderUpColor: "#26a69a",
        borderDownColor: "#ef5350",
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });

      console.log("Candlestick series added successfully");

      // Convert the data to the correct format for lightweight-charts
      const formattedData = data.map(item => {
        const timestamp = Math.floor(new Date(item.time).getTime() / 1000);
        return {
          time: timestamp as any, // Type assertion for Time
          open: Number(item.open) || 0,
          high: Number(item.high) || 0,
          low: Number(item.low) || 0,
          close: Number(item.close) || 0,
        };
      }).filter(item => {
        // Filter out invalid data points
        return item.time > 0 && !isNaN(item.open) && !isNaN(item.high) && !isNaN(item.low) && !isNaN(item.close);
      });

      console.log("Formatted chart data:", formattedData);
      
      if (formattedData.length > 0) {
        candleSeries.setData(formattedData);
        chart.timeScale().fitContent();
        console.log("Chart data set successfully");
      } else {
        console.error("No valid data points to display");
      }

      const resize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      window.addEventListener("resize", resize);
      return () => {
        window.removeEventListener("resize", resize);
        chart.remove();
      };
    } catch (error) {
      console.error("Error creating chart:", error);
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = `
          <div style="
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100%; 
            color: #ef5350; 
            font-size: 14px;
            background: #0a0e27;
            border-radius: 8px;
          ">
            Error loading chart: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
        `;
      }
    }
  }, [data]);

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full h-full"
      style={{ backgroundColor: '#0a0e27', borderRadius: '8px' }}
    />
  );
};

export default CandleChart;