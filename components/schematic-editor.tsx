"use client"

import React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useDrop } from "react-dnd"
import { useDrag } from "react-dnd"
import { Button } from "@/components/ui/button"
import { useCircuitComponents } from "./circuit-component-context"
import { Trash2, RotateCw, Grid, ZoomIn, ZoomOut, Send } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getIconForType } from "./CustomIcons"

// Update the calculateRotatedPinPosition function to better handle pin positioning
function calculateRotatedPinPosition(component, pin) {
  const rotationRad = (component.rotation * Math.PI) / 180

  // Get the center of the component
  const componentCenterX = component.x + 20 // Assuming icon width is 40px
  const componentCenterY = component.y + 20 // Assuming icon height is 40px

  // Calculate pin position relative to component center
  const pinRelativeX = pin.x * 5 // Scale factor for pin coordinates
  const pinRelativeY = pin.y * 5 // Scale factor for pin coordinates

  // Apply rotation transformation
  const rotatedX = pinRelativeX * Math.cos(rotationRad) - pinRelativeY * Math.sin(rotationRad)
  const rotatedY = pinRelativeX * Math.sin(rotationRad) + pinRelativeY * Math.cos(rotationRad)

  // Return absolute position
  return {
    x: componentCenterX + rotatedX,
    y: componentCenterY + rotatedY,
  }
}

const DraggableComponent = React.memo(function DraggableComponent({
  id,
  component,
  isSelected,
  isConnecting,
  isAnyConnecting,
  onSelect,
  onStartConnection,
  onRotate,
  onDelete,
  onMoveToPcb,
}: {
  id: string
  component: any
  isSelected: boolean
  isConnecting: boolean
  isAnyConnecting: boolean
  onSelect: (id: string, e: React.MouseEvent) => void
  onStartConnection: (id: string, pinIndex: number, e: React.MouseEvent) => void
  onRotate: (id: string) => void
  onDelete: (id: string) => void
  onMoveToPcb: (id: string) => void
}) {
  const Icon = getIconForType(component.type)

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: "PLACED_COMPONENT",
      item: { id },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [id],
  )

  return (
    <div
      ref={drag}
      id={id}
      className={`absolute cursor-move transition-all ${
        isSelected ? "ring-2 ring-primary shadow-md" : ""
      } ${isConnecting ? "ring-2 ring-blue-500 shadow-md" : ""} ${isDragging ? "opacity-50" : ""}`}
      style={{
        left: component.x,
        top: component.y,
        transform: `rotate(${component.rotation}deg)`,
        zIndex: isSelected ? 10 : 1,
      }}
      onClick={(e) => onSelect(id, e)}
    >
      <Icon className="h-10 w-10 text-foreground" />

      {/* Render pins for connection - only show when component is selected or when connecting */}
      {component.footprint && component.footprint.pins && (isSelected || isConnecting || isAnyConnecting) && (
        <div className="absolute inset-0">
          {component.footprint.pins.map((pin, pinIndex) => {
            const pinX = pin.x * 5 // Updated scaling
            const pinY = pin.y * 5 // Updated scaling

            // Determine pin color based on type
            let pinColor = "bg-yellow-500" // Default for "other"
            if (pin.type === "positive") {
              pinColor = "bg-green-500"
            } else if (pin.type === "negative") {
              pinColor = "bg-red-500"
            }

            return (
              <div
                key={pinIndex}
                className={`absolute w-3 h-3 rounded-full ${pinColor} border border-gray-700 cursor-pointer hover:ring-2 hover:ring-blue-400 z-20`}
                style={{
                  left: `calc(50% + ${pinX}px)`,
                  top: `calc(50% + ${pinY}px)`,
                  transform: "translate(-50%, -50%)",
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isAnyConnecting && !isConnecting) {
                    onSelect(id, e) // This will trigger handleComponentClick which handles completing connections
                  } else {
                    onStartConnection(id, pinIndex, e)
                  }
                }}
              />
            )
          })}
        </div>
      )}

      {isSelected && (
        <TooltipProvider>
          <div className="absolute -top-10 left-0 flex space-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 bg-background shadow-sm text-green-500 hover:bg-green-500/10 hover:text-green-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveToPcb(id)
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move to PCB</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 bg-background shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRotate(id)
                  }}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 bg-background shadow-sm text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
    </div>
  )
})

export default function SchematicEditor() {
  const {
    schematicComponents,
    connections,
    addComponent,
    updateComponent,
    removeComponent,
    moveComponentToPcb,
    addConnection,
    removeConnection,
  } = useCircuitComponents()

  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectingPinIndex, setConnectingPinIndex] = useState<number>(-1)
  const [connectionStart, setConnectionStart] = useState<{ x: number; y: number } | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const editorRef = useRef<HTMLDivElement>(null)
  const [connectionPositions, setConnectionPositions] = useState<
    Record<
      string,
      { startPos: { x: number; y: number }; endPos: { x: number; y: number }; startPinType: string; endPinType: string }
    >
  >({})

  const handleDrop = useCallback(
    (item: any, monitor: any) => {
      const offset = monitor.getClientOffset()
      if (!offset || !editorRef.current) return

      const editorRect = editorRef.current.getBoundingClientRect()
      const x = (offset.x - editorRect.left - panOffset.x) / zoom
      const y = (offset.y - editorRect.top - panOffset.y) / zoom

      if (item.id) {
        // Update component position
        updateComponent(item.id, { x, y })
      } else {
        // Add component
        addComponent({
          ...item,
          x,
          y,
          rotation: 0,
          connections: [],
        })
      }
    },
    [addComponent, updateComponent, zoom, panOffset],
  )

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ["CIRCUIT_COMPONENT", "PLACED_COMPONENT"],
      drop: handleDrop,
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    [handleDrop],
  )

  const handleComponentClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()

      if (connecting) {
        const startComponent = schematicComponents.find((c) => c.id === connecting)
        const endComponent = schematicComponents.find((c) => c.id === id)

        if (startComponent && endComponent && connecting !== id) {
          // Get the selected pin from the starting component
          const startPin = startComponent.footprint.pins[connectingPinIndex]

          // Find the closest pin on the target component
          const endPinIndex = findClosestPinIndex(endComponent, mousePosition)
          const endPin = endComponent.footprint.pins[endPinIndex]

          // Calculate exact pin positions with rotation adjustment
          const startPinPos = calculateRotatedPinPosition(startComponent, startPin)
          const endPinPos = calculateRotatedPinPosition(endComponent, endPin)

          // Include all required properties in the connection
          const connectionId = addConnection({
            start: connecting,
            end: id,
            startPos: startPinPos,
            endPos: endPinPos,
            startPinIndex: connectingPinIndex,
            endPinIndex: endPinIndex,
            startPinType: startPin.type,
            endPinType: endPin.type,
          })

          // Store connection positions and pin types for rendering
          setConnectionPositions((prev) => ({
            ...prev,
            [connectionId]: {
              startPos: startPinPos,
              endPos: endPinPos,
              startPinType: startPin.type,
              endPinType: endPin.type,
            },
          }))

          // Update component connections
          updateComponent(connecting, {
            connections: [...startComponent.connections, id],
          })

          updateComponent(id, {
            connections: [...endComponent.connections, connecting],
          })
        }

        setConnecting(null)
        setConnectingPinIndex(-1)
        setConnectionStart(null)
      } else {
        setSelectedComponent(id)
      }
    },
    [connecting, connectingPinIndex, schematicComponents, addConnection, updateComponent, mousePosition],
  )

  // Helper function to find the closest pin on a component
  const findClosestPinIndex = (component, position) => {
    if (!component || !component.footprint || !component.footprint.pins || component.footprint.pins.length === 0) {
      return 0
    }

    let closestIndex = 0
    let minDistance = Number.POSITIVE_INFINITY

    component.footprint.pins.forEach((pin, index) => {
      // Calculate the pin position including rotation
      const rotationRad = (component.rotation * Math.PI) / 180
      const pinRelativeX = pin.x * 10
      const pinRelativeY = pin.y * 10

      // Apply rotation
      const rotatedX = pinRelativeX * Math.cos(rotationRad) - pinRelativeY * Math.sin(rotationRad)
      const rotatedY = pinRelativeX * Math.sin(rotationRad) + pinRelativeY * Math.cos(rotationRad)

      // Calculate absolute position
      const pinX = component.x + rotatedX
      const pinY = component.y + rotatedY

      const distance = Math.sqrt(Math.pow(pinX - position.x, 2) + Math.pow(pinY - position.y, 2))

      if (distance < minDistance) {
        minDistance = distance
        closestIndex = index
      }
    })

    return closestIndex
  }

  const startConnection = useCallback(
    (id: string, pinIndex: number, e: React.MouseEvent) => {
      e.stopPropagation()
      setConnecting(id)
      setConnectingPinIndex(pinIndex)

      const component = schematicComponents.find((c) => c.id === id)
      if (component && component.footprint && component.footprint.pins) {
        const pin = component.footprint.pins[pinIndex]

        // Get the exact position of the pin, accounting for rotation
        const pinPos = calculateRotatedPinPosition(component, pin)
        setConnectionStart(pinPos)
      }
    },
    [schematicComponents],
  )

  const rotateComponent = useCallback(
    (id: string) => {
      const component = schematicComponents.find((c) => c.id === id)
      if (component) {
        updateComponent(id, {
          rotation: (component.rotation + 90) % 360,
        })
      }
    },
    [schematicComponents, updateComponent],
  )

  const deleteComponent = useCallback(
    (id: string) => {
      // Find all connections involving this component
      const connectionsToRemove = connections.filter((conn) => conn.start === id || conn.end === id)

      // Remove all those connections
      connectionsToRemove.forEach((conn) => {
        removeConnection(conn.id)

        // Also remove from connectionPositions state
        setConnectionPositions((prev) => {
          const newPositions = { ...prev }
          delete newPositions[conn.id]
          return newPositions
        })
      })

      // Remove component
      removeComponent(id)

      if (selectedComponent === id) {
        setSelectedComponent(null)
      }
    },
    [connections, removeConnection, removeComponent, selectedComponent],
  )

  const moveComponentToPcbWithFeedback = useCallback(
    (id: string) => {
      const component = schematicComponents.find((c) => c.id === id)
      if (component) {
        moveComponentToPcb(id)

        const componentEl = document.getElementById(id)
        if (componentEl) {
          componentEl.classList.add("animate-pulse", "bg-green-500/20")
          setTimeout(() => {
            componentEl.classList.remove("animate-pulse", "bg-green-500/20")
          }, 1000)
        }
      }
    },
    [schematicComponents, moveComponentToPcb],
  )

  // Update connection positions when components move
  const updateConnectionPositions = useCallback(() => {
    connections.forEach((connection) => {
      const startComponent = schematicComponents.find((c) => c.id === connection.start)
      const endComponent = schematicComponents.find((c) => c.id === connection.end)

      if (startComponent && endComponent) {
        // These indices MUST be stored in the connection object
        const startPinIndex = connection.startPinIndex ?? 0
        const endPinIndex = connection.endPinIndex ?? 0

        // Get the actual pins
        const startPin = startComponent.footprint?.pins?.[startPinIndex]
        const endPin = endComponent.footprint?.pins?.[endPinIndex]

        if (startPin && endPin) {
          // Recalculate exact pin positions with current component positions and rotations
          const startPos = calculateRotatedPinPosition(startComponent, startPin)
          const endPos = calculateRotatedPinPosition(endComponent, endPin)

          // Update the connection positions with these exact pin locations
          setConnectionPositions((prev) => ({
            ...prev,
            [connection.id]: {
              startPos,
              endPos,
              startPinType: startPin.type,
              endPinType: endPin.type,
            },
          }))
        }
      }
    })
  }, [connections, schematicComponents])

  // Update connection positions when components change or move
  useEffect(() => {
    const timeoutId = setTimeout(updateConnectionPositions, 100)
    return () => clearTimeout(timeoutId)
  }, [schematicComponents, updateConnectionPositions])

  // Update the renderConnections function in the SchematicEditor component to draw better connections
  // Find the existing renderConnections code and replace with this improved version
  const connectionElements = useMemo(() => {
    return connections
      .map((connection) => {
        const positions = connectionPositions[connection.id]
        if (!positions) return null

        // Set a default connection style
        let strokeColor = "#3b82f6" // Default blue
        const strokeWidth = "2"
        const strokeDasharray = ""

        // Set different styles based on pin types
        if (positions.startPinType === "positive" && positions.endPinType === "negative") {
          strokeColor = "#10b981" // Green for positive to negative
        } else if (positions.startPinType === "negative" && positions.endPinType === "positive") {
          strokeColor = "#10b981" // Green for negative to positive
        }

        // Calculate control points for a smooth curve
        const dx = positions.endPos.x - positions.startPos.x
        const dy = positions.endPos.y - positions.startPos.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Create a curved path for the connection
        const path = `
          M ${positions.startPos.x} ${positions.startPos.y}
          C ${positions.startPos.x + dx / 3} ${positions.startPos.y + dy / 3},
            ${positions.endPos.x - dx / 3} ${positions.endPos.y - dy / 3},
            ${positions.endPos.x} ${positions.endPos.y}
        `

        return (
          <path
            key={connection.id}
            d={path}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            fill="none"
          />
        )
      })
      .filter(Boolean)
  }, [connections, connectionPositions])

  const inProgressConnection = useMemo(() => {
    if (!connecting || !connectionStart) return null
    return (
      <path
        d={`
          M ${connectionStart.x} ${connectionStart.y}
          C ${connectionStart.x + (mousePosition.x - connectionStart.x) / 3} ${connectionStart.y + (mousePosition.y - connectionStart.y) / 3},
            ${mousePosition.x - (mousePosition.x - connectionStart.x) / 3} ${mousePosition.y - (mousePosition.y - connectionStart.y) / 3},
            ${mousePosition.x} ${mousePosition.y}
        `}
        stroke="#3b82f6"
        strokeWidth="2"
        strokeDasharray="5,5"
        fill="none"
      />
    )
  }, [connecting, connectionStart, mousePosition])

  const handleEditorClick = useCallback(
    (e) => {
      // If we're connecting, check if we clicked on a component's pin
      if (connecting && connectionStart) {
        // We'll handle this in the component's click handler
        // Just keep the connection state active
        return
      }

      setSelectedComponent(null)
      setConnecting(null)
      setConnectingPinIndex(-1)
      setConnectionStart(null)
    },
    [connecting, connectionStart],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (editorRef.current) {
        const editorRect = editorRef.current.getBoundingClientRect()

        if (isDragging) {
          setPanOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
          })
        } else if (connectionStart) {
          setMousePosition({
            x: (e.clientX - editorRect.left - panOffset.x) / zoom,
            y: (e.clientY - editorRect.top - panOffset.y) / zoom,
          })
        }
      }
    },
    [isDragging, dragStart, connectionStart, panOffset, zoom],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.getModifierState("Space"))) {
        e.preventDefault()
        setIsDragging(true)
        setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
      }
    },
    [panOffset],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      const rect = editorRef.current?.getBoundingClientRect()
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
    },
    [zoom, panOffset],
  )

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5))
  }, [])

  const handleResetView = useCallback(() => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-background/80 backdrop-blur-sm p-1 rounded-md shadow-sm">
        <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= 0.5}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleResetView}>
          {Math.round(zoom * 100)}%
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= 3}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setShowGrid(!showGrid)}>
          <Grid className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={drop}
        className={`relative w-full h-full overflow-auto ${showGrid ? "bg-grid-pattern dark:bg-grid-pattern-dark" : "bg-background"}`}
        onClick={handleEditorClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <div
          ref={editorRef}
          className="relative w-[2000px] h-[2000px]"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Draw connections */}
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {connectionElements}
            {inProgressConnection}
          </svg>

          {/* Components */}
          {schematicComponents.map((component) => (
            <DraggableComponent
              key={component.id}
              id={component.id}
              component={component}
              isSelected={selectedComponent === component.id}
              isConnecting={connecting === component.id}
              isAnyConnecting={!!connecting}
              onSelect={handleComponentClick}
              onStartConnection={startConnection}
              onRotate={rotateComponent}
              onDelete={deleteComponent}
              onMoveToPcb={moveComponentToPcbWithFeedback}
            />
          ))}
          {isOver && <div className="absolute inset-0 bg-primary/10 pointer-events-none" />}
        </div>
      </div>
    </div>
  )
}
