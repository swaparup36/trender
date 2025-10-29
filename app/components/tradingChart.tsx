"use client";

import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { cahrtDataType } from "@/types/types";

interface CandleChartProps {
  data: cahrtDataType[];
  isLoading?: boolean;
}

const CandleChart: React.FC<CandleChartProps> = ({ data, isLoading = false }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Show loading state
    if (isLoading) {
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = `
          <div style="
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100%; 
            color: #888; 
            font-size: 14px;
            background: #000000;
            border-radius: 8px;
          ">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="
                width: 16px;
                height: 16px;
                border: 2px solid #333;
                border-top: 2px solid #888;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              "></div>
              Loading chart data...
            </div>
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </div>
        `;
      }
      return;
    }
    
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
            background: #000000;
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
          background: { color: '#000000' },
          textColor: "#ffffff",
        },
        grid: {
          vertLines: { color: "#2a2e39" },
          horzLines: { color: "#2a2e39" },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            visible: true,
            labelVisible: true,
            color: '#758696',
            width: 1,
            style: 0,
          },
          horzLine: {
            visible: true,
            labelVisible: true,
            color: '#758696',
            width: 1,
            style: 0,
          },
        },
        timeScale: {
          borderColor: "#485c7b",
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: "#485c7b",
          visible: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
          mode: 0,
          autoScale: true,
          entireTextOnly: false,
          minimumWidth: 80,
        },
        leftPriceScale: {
          visible: false,
        },
      });

      console.log("Chart created successfully");

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderUpColor: "#26a69a",
        borderDownColor: "#ef5350",
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
        priceFormat: {
          type: 'price',
          precision: 9,
          minMove: 0.000000001,
        },
      });

      console.log("Candlestick series added successfully");

      // Convert the data to the correct format for lightweight-charts
      const formattedData = data.map(item => {
        const timestamp = Math.floor(new Date(item.time).getTime() / 1000);
        // Ensure all price values are valid numbers and not zero
        const open = Number(item.open) || 0;
        const high = Number(item.high) || 0;
        const low = Number(item.low) || 0;
        const close = Number(item.close) || 0;
        
        return {
          time: timestamp as any, // Type assertion for Time
          open: open,
          high: high,
          low: low,
          close: close,
        };
      }).filter(item => {
        // Filter out invalid data points - ensure we have valid prices
        return item.time > 0 && 
               !isNaN(item.open) && !isNaN(item.high) && !isNaN(item.low) && !isNaN(item.close) &&
               item.open > 0 && item.high > 0 && item.low > 0 && item.close > 0; // Ensure no zero prices
      });

      console.log("Formatted chart data:", formattedData);
      
      if (formattedData.length > 0) {
        // Calculate price range for better scaling
        const allPrices = formattedData.flatMap(item => [item.open, item.high, item.low, item.close]);
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const priceRange = maxPrice - minPrice;
        
        console.log("Price range:", { minPrice, maxPrice, priceRange });
        
        // Set data and configure price scale
        candleSeries.setData(formattedData);
        
        // Apply price scale options with proper range
        chart.priceScale('right').applyOptions({
          autoScale: true,
          mode: 0, // Normal mode
          invertScale: false,
          alignLabels: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        });
        
        chart.timeScale().fitContent();
        console.log("Chart data set successfully");

        // Add crosshair move listener to track price on hover
        chart.subscribeCrosshairMove((param) => {
          if (param.time && param.point) {
            const data = param.seriesData.get(candleSeries);
            if (data) {
              console.log("Crosshair data:", data);
              // The crosshair labels will display the values automatically
            }
          }
        });
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
            background: #000000;
            border-radius: 8px;
          ">
            Error loading chart: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
        `;
      }
    }
  }, [data, isLoading]);

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full h-full"
      style={{ backgroundColor: '#000000', borderRadius: '8px' }}
    />
  );
};

export default CandleChart;