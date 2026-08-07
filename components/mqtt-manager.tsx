"use client"

import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, CircleAlert } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import mqtt from "mqtt"

const MQTT_CONFIG = {
  brokerUrl: "wss://broker.emqx.io:8084/mqtt",
  topics: {
    publish: "esp32/matrix/data",
    subscribe: "esp32/matrix/status",
  },
  options: {
    clientId: `web-client-${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
    wsOptions: {
      keepalive: 60,
      reschedulePings: true,
      pingTimeout: 30000,
    } as any,
  },
}

interface MqttManagerProps {
  matrix: number[][]
  shouldConnect: boolean
  componentName?: string
  triggerSend?: number // Added timestamp trigger for sending
  onConnectionStatus?: (isConnected: boolean) => void
}

export default function MqttManager({
  matrix,
  shouldConnect,
  componentName,
  triggerSend,
  onConnectionStatus,
}: MqttManagerProps) {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [messages, setMessages] = useState<string[]>([])
  const clientRef = useRef<mqtt.MqttClient | null>(null)
  const connectionAttempts = useRef(0)
  const maxConnectionAttempts = 5
  const isInitialMount = useRef(true)
  const pendingSendRef = useRef(false)

  const matrixToString = () => {
    const matrixData = matrix.map((row) => row.join(",")).join(";")
    setMessages((prev) => [...prev, `[DATA] ${componentName} payload: ${matrixData.length} bytes`])
    return matrixData
  }

  const sendMatrix = () => {
    if (clientRef.current && status === "connected") {
      const message = matrixToString()
      setMessages((prev) => [...prev, `[MQTT] Publishing to ${MQTT_CONFIG.topics.publish}`])

      clientRef.current.publish(MQTT_CONFIG.topics.publish, message, { qos: 1, retain: false }, (err) => {
        if (err) {
          setMessages((prev) => [...prev, `[ERROR] Publish failed: ${err.message}`])
        } else {
          setMessages((prev) => [...prev, `[SUCCESS] ${componentName} data sent`])
          pendingSendRef.current = false
        }
      })
    } else {
      // If not connected, mark for sending when connected
      pendingSendRef.current = true
    }
  }

  const setupMqttClient = () => {
    if (!shouldConnect || connectionAttempts.current >= maxConnectionAttempts) return

    // Reset status to ensure we show connecting state
    setStatus("connecting")
    connectionAttempts.current += 1
    setMessages((prev) => [...prev, `[NETWORK] Attempt ${connectionAttempts.current}/${maxConnectionAttempts}`])

    const clientId = `web-client-${Math.random().toString(16).substr(2, 8)}`
    const options = { ...MQTT_CONFIG.options, clientId }

    // Close existing connection if any
    if (clientRef.current) {
      clientRef.current.end(true)
    }

    const mqttClient = mqtt.connect(MQTT_CONFIG.brokerUrl, options)
    clientRef.current = mqttClient

    mqttClient.on("connect", () => {
      setStatus("connected")
      setMessages((prev) => [...prev, `[NETWORK] Connected to MQTT broker`])
      connectionAttempts.current = 0
      mqttClient.subscribe(MQTT_CONFIG.topics.subscribe)

      // Notify parent component about connection status
      if (onConnectionStatus) onConnectionStatus(true)

      // If we have pending data to send or this is an initial connection, send it
      if (pendingSendRef.current || isInitialMount.current) {
        setTimeout(() => sendMatrix(), 500) // Small delay to ensure connection is stable
      }
    })

    mqttClient.on("reconnect", () => {
      setMessages((prev) => [...prev, `[NETWORK] Reconnecting...`])
    })

    mqttClient.on("offline", () => {
      setMessages((prev) => [...prev, `[NETWORK] Connection lost`])
      setStatus("disconnected")
      if (onConnectionStatus) onConnectionStatus(false)
    })

    mqttClient.on("message", (topic, message) => {
      setMessages((prev) => [...prev, `[ESP32] ${message.toString()}`])
    })

    mqttClient.on("error", (err) => {
      setMessages((prev) => [...prev, `[ERROR] ${err.message}`])
      // On error, try to reconnect after a short delay
      if (connectionAttempts.current < maxConnectionAttempts) {
        setTimeout(setupMqttClient, 2000)
      }
    })

    return mqttClient
  }

  // Effect to handle connection on initial mount or when shouldConnect changes
  useEffect(() => {
    if (shouldConnect) {
      const mqttClient = setupMqttClient()
      if (isInitialMount.current) {
        isInitialMount.current = false
      }

      return () => {
        if (mqttClient) {
          mqttClient.end(true)
          if (onConnectionStatus) onConnectionStatus(false)
        }
      }
    } else {
      if (onConnectionStatus) onConnectionStatus(false)
    }
  }, [shouldConnect])

  // Effect to handle matrix changes
  useEffect(() => {
    if (matrix && matrix.length > 0) {
      pendingSendRef.current = true

      if (status === "connected" && clientRef.current) {
        sendMatrix()
      } else if (status === "disconnected" && shouldConnect) {
        // Try to reconnect if we're not connected but should be
        setupMqttClient()
      }
    }
  }, [matrix])

  // Effect to handle triggerSend changes (when PCB View's Send Data button is clicked)
  useEffect(() => {
    if (triggerSend) {
      pendingSendRef.current = true

      if (status === "connected" && clientRef.current) {
        sendMatrix()
      } else if (shouldConnect) {
        // If not connected but should be, reconnect and queue the send
        setupMqttClient()
      }
    }
  }, [triggerSend])

  // Update connection status when status changes
  useEffect(() => {
    if (onConnectionStatus) {
      onConnectionStatus(status === "connected")
    }
  }, [status, onConnectionStatus])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm">ESP32 LED Matrix:</div>
        <Badge variant={status === "connected" ? "default" : "destructive"}>
          {status === "connecting" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {status === "connected" && <Check className="h-3 w-3 mr-1" />}
          {status}
        </Badge>
      </div>

      <Alert variant="outline" className="py-2">
        <CircleAlert className="h-4 w-4 mr-1" />
        <AlertDescription className="text-xs">
          {componentName ? `${componentName} data sent via MQTT` : "Matrix data sent via MQTT to ESP32 LED display"}
        </AlertDescription>
      </Alert>

      <div className="flex justify-between">
        <Button size="sm" onClick={sendMatrix} disabled={status !== "connected"}>
          Send Matrix
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            connectionAttempts.current = 0 // Reset attempts when manually reconnecting
            setupMqttClient()
          }}
        >
          Reconnect
        </Button>
      </div>

      <div className="border rounded-md p-2 h-32 overflow-y-auto text-xs font-mono">
        {messages.map((msg, i) => (
          <div key={i} className="text-muted-foreground">
            {msg}
          </div>
        ))}
      </div>
    </div>
  )
}
