"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useCircuitComponents } from "./circuit-component-context"
import { Button } from "@/components/ui/button"
import {
  RotateCw,
  Trash2,
  Send,
  Download,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Check,
  Move,
  TriangleAlert,
  Wifi,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import MqttManager from "./mqtt-manager"
import { getIconForType } from "./CustomIcons"
import { ErrorBoundary } from "./error-boundary"

// Constants for PCB grid
const GRID_SIZE = 64
const CELL_SIZE = 10
const PCB_PITCH = 2.54 // mm

interface PcbViewProps {
  isPrototyping: boolean
}

interface SentData {
  componentName: string
  orientation: 1 | 2
  matrix: number[][]
  timestamp: number
}

export default function PcbView({ isPrototyping }: PcbViewProps) {
  const { pcbComponents, connections, updatePcbComponent, removeConnection, addConnection } = useCircuitComponents()

  const [grid, setGrid] = useState<number[][]>([])
  const [currentComponent, setCurrentComponent] = useState<number>(-1)
  const [orientation, setOrientation] = useState<1 | 2>(1)
  const [viewMode, setViewMode] = useState<"schematic" | "realistic">("realistic")
  const [sentData, setSentData] = useState<SentData | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fullMatrix, setFullMatrix] = useState<number[][]>([])
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [processingStatus, setProcessingStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [componentPositions, setComponentPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [isMovingComponent, setIsMovingComponent] = useState(false)
  const [stars, setStars] = useState<Array<{ x: number; y: number; size: number; opacity: number }>>([])
  const [shouldUpdateConnections, setShouldUpdateConnections] = useState(false)
  const [invalidConnections, setInvalidConnections] = useState<string[]>([])
  const [isMqttConnected, setIsMqttConnected] = useState(false)

  const [mqttTrigger, setMqttTrigger] = useState<number>(0)

  const sendCurrentComponent = () => {
    if (currentComponent >= 0 && currentComponent < pcbComponents.length) {
      const component = pcbComponents[currentComponent]
      const position = componentPositions[component.id]
      if (!position) return

      // Create empty 64x64 matrix
      const componentMatrix = Array(GRID_SIZE)
        .fill(0)
        .map(() => Array(GRID_SIZE).fill(0))

      // Calculate component dimensions in grid cells
      const componentWidthCells = Math.ceil(component.footprint.width / PCB_PITCH)
      const componentHeightCells = Math.ceil(component.footprint.height / PCB_PITCH)

      // Mark component body cells (value 4)
      for (let j = 0; j < componentHeightCells; j++) {
        for (let i = 0; i < componentWidthCells; i++) {
          const x = position.x + i
          const y = position.y + j
          if (x < GRID_SIZE && y < GRID_SIZE) {
            componentMatrix[y][x] = 4 // Component body
          }
        }
      }

      // Mark component pins with their specific types
      component.footprint.pins.forEach((pin: any) => {
        const pinX = position.x + Math.round(pin.x / PCB_PITCH)
        const pinY = position.y + Math.round(pin.y / PCB_PITCH)
        if (pinX < GRID_SIZE && pinY < GRID_SIZE) {
          switch (pin.type) {
            case "positive":
              componentMatrix[pinY][pinX] = 1 // Positive pin
              break
            case "negative":
              componentMatrix[pinY][pinX] = 2 // Negative pin
              break
            default:
              componentMatrix[pinY][pinX] = 3 // Other pins
          }
        }
      })

      setSentData({
        componentName: component.name,
        orientation,
        matrix: componentMatrix,
        timestamp: Date.now(),
      })

      setMqttTrigger(Date.now())
    }
  }

  const toggleOrientation = () => {
    setOrientation((prev) => (prev === 1 ? 2 : 1))
  }

  const clearSentData = () => {
    setSentData(null)
  }

  const downloadMatrixData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullMatrix))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", "matrix_data.json")
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const handleComponentClick = (componentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedComponent(selectedComponent === componentId ? null : componentId)
  }

  const handleStartMoving = (componentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedComponent(componentId)
    setIsMovingComponent(true)
  }

  const handleCanvasClick = () => {
    setSelectedComponent(null)
    setIsMovingComponent(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    const newZoom = Math.max(0.5, Math.min(3, zoom * zoomFactor))

    const newPanOffset = {
      x: mouseX - (mouseX - panOffset.x) * (newZoom / zoom),
      y: mouseY - (mouseY - panOffset.y) * (newZoom / zoom),
    }

    setZoom(newZoom)
    setPanOffset(newPanOffset)
  }

  // Generate stars for background
  useEffect(() => {
    const newStars = Array.from({ length: 200 }, () => ({
      x: Math.random() * GRID_SIZE * CELL_SIZE,
      y: Math.random() * GRID_SIZE * CELL_SIZE,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
    }))
    setStars(newStars)
  }, [])

  const initializeGrid = useCallback(() => {
    setProcessingStatus("processing")

    const newGrid = Array(GRID_SIZE)
      .fill(0)
      .map(() => Array(GRID_SIZE).fill(0))

    const newFullMatrix = Array(GRID_SIZE)
      .fill(0)
      .map(() => Array(GRID_SIZE).fill(0))

    try {
      const newComponentPositions = { ...componentPositions }
      let positionsChanged = false

      pcbComponents.forEach((component) => {
        const position = componentPositions[component.id] || {
          x: Math.floor((component.x / 2000) * GRID_SIZE),
          y: Math.floor((component.y / 2000) * GRID_SIZE),
        }

        // Convert footprint dimensions from mm to grid cells
        const componentWidthCells = Math.ceil(component.footprint.width / PCB_PITCH)
        const componentHeightCells = Math.ceil(component.footprint.height / PCB_PITCH)

        // Snap to grid based on PCB pitch
        const gridX = Math.round(position.x / 2) * 2
        const gridY = Math.round(position.y / 2) * 2

        const adjustedX = Math.max(0, Math.min(GRID_SIZE - componentWidthCells, gridX))
        const adjustedY = Math.max(0, Math.min(GRID_SIZE - componentHeightCells, gridY))

        // Place component on grid
        const componentId = pcbComponents.findIndex((c) => c.id === component.id) + 1

        for (let j = 0; j < componentHeightCells; j++) {
          for (let i = 0; i < componentWidthCells; i++) {
            const posX = adjustedX + i
            const posY = adjustedY + j

            if (posX >= 0 && posX < GRID_SIZE && posY >= 0 && posY < GRID_SIZE) {
              newGrid[posY][posX] = componentId
            }
          }
        }

        // Place pins with their specific types
        component.footprint.pins.forEach((pin: any, index: number) => {
          // Convert pin positions from mm to grid cells
          const pinX = adjustedX + Math.round(pin.x / PCB_PITCH)
          const pinY = adjustedY + Math.round(pin.y / PCB_PITCH)

          if (pinX >= 0 && pinX < GRID_SIZE && pinY >= 0 && pinY < GRID_SIZE) {
            if (pin.type === "positive") {
              newGrid[pinY][pinX] = -1 // Positive pin
            } else if (pin.type === "negative") {
              newGrid[pinY][pinX] = -2 // Negative pin
            } else {
              newGrid[pinY][pinX] = -(index + 3) // Other pins with sequential numbers
            }
          }
        })

        if (
          newComponentPositions[component.id]?.x !== adjustedX ||
          newComponentPositions[component.id]?.y !== adjustedY
        ) {
          newComponentPositions[component.id] = { x: adjustedX, y: adjustedY }
          positionsChanged = true
        }
      })

      // Create full matrix representation
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = newGrid[y][x]
          if (cell === -1) {
            newFullMatrix[y][x] = 1 // Positive pin
          } else if (cell === -2) {
            newFullMatrix[y][x] = 2 // Negative pin
          } else if (cell < 0) {
            newFullMatrix[y][x] = 3 // Other pins
          } else if (cell !== 0) {
            newFullMatrix[y][x] = 4 // Component body
          }
        }
      }

      if (positionsChanged) {
        setComponentPositions(newComponentPositions)
        setShouldUpdateConnections(true)
      }

      setProcessingStatus("success")
      setGrid(newGrid)
      setFullMatrix(newFullMatrix)
    } catch (error) {
      console.error("Error initializing grid:", error)
      setProcessingStatus("error")
    }
  }, [pcbComponents, componentPositions])

  // Update connections when component positions change
  const updateConnections = useCallback(() => {
    if (!shouldUpdateConnections) return
  
   
  
    // Remove all existing connections first
    connections.forEach((connection) => {
      removeConnection(connection.id)
    })
  
    // Create connections based on stored schematic connection data
    connections.forEach((connection) => {
      const startComponent = pcbComponents.find((c) => c.id === connection.start)
      const endComponent = pcbComponents.find((c) => c.id === connection.end)
  
      if (startComponent && endComponent) {
        const startPos = componentPositions[startComponent.id]
        const endPos = componentPositions[endComponent.id]
  
        if (startPos && endPos) {
          // Use stored pin indices from the connection
          const startPin = startComponent.footprint.pins[connection.startPinIndex ?? 0]
          const endPin = endComponent.footprint.pins[connection.endPinIndex ?? 0]
  
          if (startPin && endPin) {
            const startPinPos = {
              x: startPos.x + Math.round(startPin.x / PCB_PITCH),
              y: startPos.y + Math.round(startPin.y / PCB_PITCH),
            }
  
            const endPinPos = {
              x: endPos.x + Math.round(endPin.x / PCB_PITCH),
              y: endPos.y + Math.round(endPin.y / PCB_PITCH),
            }
  
            // Check validity based on original pin types
            const isValidConnection =
              (connection.startPinType === "positive" && connection.endPinType === "negative") ||
              (connection.startPinType === "negative" && connection.endPinType === "positive")
  
            const connectionId = addConnection({
              ...connection,
              startPos: startPinPos,
              endPos: endPinPos,
            })
  
           
          }
        }
      }
    })
  
    setShouldUpdateConnections(false)
  }, [pcbComponents, componentPositions, connections, removeConnection, addConnection, shouldUpdateConnections])
  useEffect(() => {
    initializeGrid()
  }, [pcbComponents, initializeGrid])

  useEffect(() => {
    if (shouldUpdateConnections) {
      const timeoutId = setTimeout(() => {
        updateConnections()
      }, 200)
      return () => clearTimeout(timeoutId)
    }
  }, [shouldUpdateConnections, updateConnections])

  // Handle MQTT connection status
  const handleMqttConnectionStatus = (isConnected: boolean) => {
    setIsMqttConnected(isConnected)
  }

  // Canvas rendering with KiCad-style components
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const drawCanvas = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw starry background
      ctx.fillStyle = "#061530"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw stars
      stars.forEach((star) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
      })

      ctx.save()
      ctx.translate(panOffset.x, panOffset.y)
      ctx.scale(zoom, zoom)

      if (viewMode === "schematic") {
        // Draw schematic view with KiCad symbols
        ctx.strokeStyle = "#334155"
        ctx.lineWidth = 0.5

        // Draw grid lines
        for (let i = 0; i <= GRID_SIZE; i += 2) {
          ctx.beginPath()
          ctx.moveTo(i * CELL_SIZE, 0)
          ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE)
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(0, i * CELL_SIZE)
          ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE)
          ctx.stroke()
        }

        if (grid.length > 0) {
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              const cell = grid[y][x]

              if (cell !== 0) {
                if (cell === -1) {
                  // Positive pin (KiCad style)
                  ctx.fillStyle = "#00ff00"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 3, 0, Math.PI * 2)
                  ctx.fill()
                } else if (cell === -2) {
                  // Negative pin (KiCad style)
                  ctx.fillStyle = "#ff0000"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 3, 0, Math.PI * 2)
                  ctx.fill()
                } else if (cell < 0) {
                  // Other pins (KiCad style)
                  ctx.fillStyle = "#ffff00"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 4, 0, Math.PI * 2)
                  ctx.fill()
                } else {
                  const componentIndex = cell - 1
                  const isHighlighted = componentIndex === currentComponent && isPrototyping
                  const isSelected = pcbComponents[componentIndex]?.id === selectedComponent

                  // Component body
                  ctx.fillStyle = isHighlighted ? "#4ade80" : isSelected ? "#3b82f6" : "#888888"
                  ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                }
              }
            }
          }
        }
      } else {
        // Draw realistic PCB view with KiCad footprints
        ctx.fillStyle = "#0D5C2E" // PCB green
        ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE)

        // Draw perfboard holes
        ctx.fillStyle = "#0A4A25"
        for (let i = 0; i <= GRID_SIZE; i += 2) {
          for (let j = 0; j <= GRID_SIZE; j += 2) {
            ctx.beginPath()
            ctx.arc(i * CELL_SIZE, j * CELL_SIZE, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        if (grid.length > 0) {
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              const cell = grid[y][x]

              if (cell !== 0) {
                if (cell === -1) {
                  // Positive pin (KiCad style)
                  ctx.fillStyle = "#C0FFC0"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2, 0, Math.PI * 2)
                  ctx.fill()

                  ctx.fillStyle = "#00AA00"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2.5, 0, Math.PI * 2)
                  ctx.fill()

                  ctx.fillStyle = "#000000"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 6, 0, Math.PI * 2)
                  ctx.fill()
                } else if (cell === -2) {
                  // Negative pin (KiCad style)
                  ctx.fillStyle = "#FFC0C0"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2, 0, Math.PI * 2)
                  ctx.fill()

                  ctx.fillStyle = "#AA0000"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2.5, 0, Math.PI * 2)
                  ctx.fill()

                  ctx.fillStyle = "#000000"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 6, 0, Math.PI * 2)
                  ctx.fill()
                } else if (cell < 0) {
                  // Other pins (KiCad style)
                  ctx.fillStyle = "#FFFFC0"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 3, 0, Math.PI * 2)
                  ctx.fill()

                  ctx.fillStyle = "#AAAA00"
                  ctx.beginPath()
                  ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 4, 0, Math.PI * 2)
                  ctx.fill()
                } else {
                  const componentIndex = cell - 1
                  const isHighlighted = componentIndex === currentComponent && isPrototyping
                  const isSelected = pcbComponents[componentIndex]?.id === selectedComponent

                  // Component body (KiCad style)
                  ctx.fillStyle = isHighlighted ? "#A0FFC0" : isSelected ? "#A0C0FF" : "#FFFFFF"
                  ctx.fillRect(x * CELL_SIZE - 1, y * CELL_SIZE - 1, CELL_SIZE + 2, CELL_SIZE + 2)

                  ctx.fillStyle = isHighlighted ? "#80DFA0" : isSelected ? "#80A0DF" : "#303030"
                  ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)

                  if (isHighlighted) {
                    ctx.fillStyle = "#60BF80"
                    ctx.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4)
                  } else if (isSelected) {
                    ctx.fillStyle = "#6080BF"
                    ctx.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4)
                  } else {
                    ctx.fillStyle = "#404040"
                    ctx.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4)
                  }
                }
              }
            }
          }
        }

        // Draw connections (KiCad style copper traces)
        connections.forEach((connection) => {
          const startComponent = pcbComponents.find((c) => c.id === connection.start)
          const endComponent = pcbComponents.find((c) => c.id === connection.end)

          if (startComponent && endComponent) {
            const startPos = componentPositions[startComponent.id]
            const endPos = componentPositions[endComponent.id]

            if (startPos && endPos) {
              // Find pins to connect
              let startPin = null
              let endPin = null

              // Use connection's pin types if available
              if (connection.startPinType && connection.endPinType) {
                startPin =
                  startComponent.footprint.pins.find((pin: any) => pin.type === connection.startPinType) ||
                  startComponent.footprint.pins[0]

                endPin =
                  endComponent.footprint.pins.find((pin: any) => pin.type === connection.endPinType) ||
                  endComponent.footprint.pins[0]
              } else {
                // Fallback to first pins
                startPin = startComponent.footprint.pins[0]
                endPin = endComponent.footprint.pins[0]
              }

              if (startPin && endPin) {
                const startX = (startPos.x + Math.round(startPin.x / PCB_PITCH)) * CELL_SIZE + CELL_SIZE / 2
                const startY = (startPos.y + Math.round(startPin.y / PCB_PITCH)) * CELL_SIZE + CELL_SIZE / 2
                const endX = (endPos.x + Math.round(endPin.x / PCB_PITCH)) * CELL_SIZE + CELL_SIZE / 2
                const endY = (endPos.y + Math.round(endPin.y / PCB_PITCH)) * CELL_SIZE + CELL_SIZE / 2

                // Determine connection color based on validity
                
                  ctx.strokeStyle = "#10b981" // Green for valid positive-negative connections
                  ctx.lineWidth = 2
                  ctx.setLineDash([])
               

                ctx.beginPath()
                ctx.moveTo(startX, startY)

                const midX = (startX + endX) / 2
                const midY = (startY + endY) / 2

                if (Math.abs(startX - endX) > Math.abs(startY - endY)) {
                  ctx.lineTo(midX, startY)
                  ctx.lineTo(midX, endY)
                } else {
                  ctx.lineTo(startX, midY)
                  ctx.lineTo(endX, midY)
                }

                ctx.lineTo(endX, endY)
                ctx.stroke()
                ctx.setLineDash([])
              }
            }
          }
        })
      }

      ctx.restore()

      // Draw zoom indicator
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
      ctx.fillRect(10, 10, 60, 24)
      ctx.fillStyle = "#ffffff"
      ctx.font = "12px sans-serif"
      ctx.fillText(`${Math.round(zoom * 100)}%`, 20, 26)
    }

    requestAnimationFrame(drawCanvas)
  }, [
    grid,
    currentComponent,
    isPrototyping,
    viewMode,
    zoom,
    panOffset,
    connections,
    pcbComponents,
    componentPositions,
    selectedComponent,
    stars,
   
  ])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left mouse button
      // If a component is selected and we're in move mode
      if (selectedComponent && isMovingComponent) {
        // Let the component move handler handle it
        return
      }

      // Otherwise handle canvas dragging
      setIsDragging(true)
      setDragStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      // Handle canvas panning
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    } else if (selectedComponent && isMovingComponent) {
      // Handle component movement
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      // Calculate new position in grid coordinates
      const x = Math.round((e.clientX - rect.left - panOffset.x) / (CELL_SIZE * zoom))
      const y = Math.round((e.clientY - rect.top - panOffset.y) / (CELL_SIZE * zoom))

      // Snap to PCB grid (every 2 cells for 5.08mm pitch)
      const snappedX = Math.round(x / 2) * 2
      const snappedY = Math.round(y / 2) * 2

      // Update component position
      setComponentPositions((prev) => ({
        ...prev,
        [selectedComponent]: {
          x: Math.max(0, Math.min(GRID_SIZE - 4, snappedX)),
          y: Math.max(0, Math.min(GRID_SIZE - 4, snappedY)),
        },
      }))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)

    // If we were moving a component, update the grid
    if (selectedComponent && isMovingComponent) {
      initializeGrid()
      setIsMovingComponent(false)
      setShouldUpdateConnections(true)
    }
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
    if (isMovingComponent) {
      setIsMovingComponent(false)
    }
  }

  return (
    <ErrorBoundary>
      <div className="relative h-full flex">
        {/* Main PCB View */}
      <div className="flex-1 items-center overflow-hidden p-4 flex flex-col">
        <div className="flex flex-wrap justify-between mb-4 gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={viewMode === "realistic" ? "default" : "outline"}
              onClick={() => setViewMode(viewMode === "realistic" ? "schematic" : "realistic")}
            >
              {viewMode === "realistic" ? "Realistic View" : "Schematic View"}
            </Button>

            <Button variant="outline" onClick={downloadMatrixData}>
              <Download className="h-4 w-4 mr-2" />
              Download Matrix
            </Button>

            {selectedComponent && (
              <Button
                variant={isMovingComponent ? "default" : "outline"}
                onClick={() => setIsMovingComponent(!isMovingComponent)}
              >
                <Move className="h-4 w-4 mr-2" />
                {isMovingComponent ? "Placing Component..." : "Move Component"}
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= 0.5}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetZoom}>
              {Math.round(zoom * 100)}%
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= 3}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {pcbComponents.length === 0 ? (
          <Alert className="mb-4">
            <AlertTitle>No components in PCB view</AlertTitle>
            <AlertDescription>
              Move components from the schematic to the PCB view by selecting a component and clicking the "Move to PCB"
              button.
            </AlertDescription>
          </Alert>
        ) : processingStatus === "processing" ? (
          <div className="flex items-center justify-center h-64 border rounded-md">
            <div className="flex flex-col items-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Generating PCB layout...</p>
              <p className="text-sm text-muted-foreground mt-2">Placing {pcbComponents.length} components</p>
            </div>
          </div>
        ) : null}

     

        <div className="relative border border-border rounded-md overflow-hidden flex-1">
          <canvas
            ref={canvasRef}
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            className={`bg-black ${isDragging ? "cursor-grabbing" : isMovingComponent ? "cursor-move" : "cursor-grab"}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onClick={handleCanvasClick}
          />

          {/* Component selection overlay */}
          {pcbComponents.map((component) => {
            const position = componentPositions[component.id]
            if (!position) return null

            return (
              <div
                key={component.id}
                className={`absolute pointer-events-auto ${selectedComponent === component.id ? "z-20" : "z-10"}`}
                style={{
                  left: position.x * CELL_SIZE * zoom + panOffset.x,
                  top: position.y * CELL_SIZE * zoom + panOffset.y,
                  width: component.footprint.width * CELL_SIZE * zoom,
                  height: component.footprint.height * CELL_SIZE * zoom,
                  cursor: isMovingComponent && selectedComponent === component.id ? "move" : "pointer",
                }}
                onClick={(e) => handleComponentClick(component.id, e)}
                onMouseDown={
                  isMovingComponent && selectedComponent === component.id
                    ? (e) => e.stopPropagation()
                    : (e) => handleStartMoving(component.id, e)
                }
              >
                {/* Invisible overlay for component interaction */}
              </div>
            )
          })}
        </div>

        {/* Data View Section (Bottom) */}
        {isPrototyping && sentData && (
          <div className="border-t mt-4 pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium">Data Transmission</h3>
                <p className="text-sm text-muted-foreground">View the data being sent to the ESP32</p>
              </div>

              {sentData && (
                <Button variant="outline" size="sm" onClick={clearSentData}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Data
                </Button>
              )}
            </div>

            <MqttManager
              matrix={sentData.matrix}
              shouldConnect={true}
              componentName={sentData.componentName}
              triggerSend={mqttTrigger}
              onConnectionStatus={handleMqttConnectionStatus}
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <Card>
                <CardHeader className="py-2 px-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm">Component Data</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {new Date(sentData.timestamp).toLocaleTimeString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-2 px-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="font-medium">Name:</div>
                      <div>{sentData.componentName}</div>
                    </div>
                    <div>
                      <div className="font-medium">Orientation:</div>
                      <div>{sentData.orientation === 1 ? "Normal" : "Rotated"}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="font-medium">Data Type:</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">JSON</Badge>
                        <Badge variant="outline">Binary Matrix</Badge>
                        <Badge variant="default">MQTT Payload</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm">Matrix Representation (64x64)</CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-3">
                  <div className="bg-muted p-2 rounded-md overflow-x-auto">
                    <p className="text-xs mb-2">
                      The matrix is 64x64 in size. Showing a preview of the first 10x10 elements:
                    </p>
                    <pre className="text-xs">
                      {sentData.matrix
                        .slice(0, 10)
                        .map((row) => row.slice(0, 10).join(" "))
                        .join("\n")}
                      {"\n..."}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Component Checklist (Right Side) */}
      {isPrototyping && (
        <div className="w-1xl border-l p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Components</h3>
            <Badge>{pcbComponents.length}</Badge>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-medium">Current Component</h4>
              <p className="text-xs text-muted-foreground">
                {currentComponent >= 0 && currentComponent < pcbComponents.length
                  ? pcbComponents[currentComponent].name
                  : "None selected"}
              </p>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleOrientation}
              title={orientation === 1 ? "Normal Orientation" : "Rotated Orientation"}
            >
              {orientation === 1 ? "1" : <RotateCw className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex mb-4">
            <Button
              variant="default"
              className="w-full"
              onClick={sendCurrentComponent}
              disabled={currentComponent < 0 || currentComponent >= pcbComponents.length}
            >
              {isMqttConnected ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Data
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 mr-2" />
                  Connect to MQTT
                </>
              )}
            </Button>
          </div>

          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-2">
              {pcbComponents.map((component, index) => (
                <Card
                  key={component.id}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    currentComponent === index ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setCurrentComponent(index)}
                >
                  <div className="p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* {getIconForType(component.type)} */}
                      <div>
                        <p className="text-sm font-medium">{component.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {component.value || `${component.footprint.width}x${component.footprint.height}`}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Handle marking component as done - remove from checklist
                        const updatedComponents = [...pcbComponents]
                        updatedComponents.splice(index, 1)
                        // pcbComponents(updatedComponents);

                        // Adjust current component if needed
                        if (currentComponent >= index && currentComponent > 0) {
                          setCurrentComponent(currentComponent - 1)
                        }
                      }}
                      title="Mark as done"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      </div>
    </ErrorBoundary>
  )
}
