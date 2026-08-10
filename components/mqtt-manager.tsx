import { useState, useEffect, useRef, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, CircleAlert, XCircle } from "lucide-react"
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

type ConnectionState = "disconnected" | "broker_connecting" | "esp32_connecting" | "connected" | "not_online"

interface MqttManagerProps {
  matrix: number[][]
  shouldConnect: boolean
  componentName?: string
  triggerSend?: number
  onConnectionStatus?: (isConnected: boolean) => void
}

export default function MqttManager({
  matrix,
  shouldConnect,
  componentName,
  triggerSend,
  onConnectionStatus,
}: MqttManagerProps) {
  const [status, setStatus] = useState<ConnectionState>("disconnected")
  const [messages, setMessages] = useState<string[]>([])
  const clientRef = useRef<mqtt.MqttClient | null>(null)
  const connectionAttempts = useRef(0)
  const maxConnectionAttempts = 5
  
  // Heartbeat tracking
  const lastHeartbeatRef = useRef<number>(0)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const pendingSendRef = useRef(false)

  const addMessage = useCallback((msg: string) => {
    setMessages((prev) => {
      const newMsgs = [...prev, msg]
      if (newMsgs.length > 50) return newMsgs.slice(newMsgs.length - 50)
      return newMsgs
    })
  }, [])

  const matrixToString = useCallback(() => {
    // Old dense encoding (for metric comparison)
    const denseSize = matrix.map((row) => row.join(",")).join(";").length
    
    // New sparse encoding: x,y,value;
    let sparseData = ""
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] !== 0) {
          sparseData += `${x},${y},${matrix[y][x]};`
        }
      }
    }
    
    // Remove trailing semicolon if it exists
    if (sparseData.endsWith(";")) {
      sparseData = sparseData.slice(0, -1)
    }
    
    // Add metrics log to dashboard
    addMessage(`[OPTIMIZATION] Dense: ${denseSize} bytes | Sparse: ${sparseData.length || 1} bytes`)
    const reduction = denseSize > 0 ? ((denseSize - Math.max(1, sparseData.length)) / denseSize * 100).toFixed(1) : 0
    addMessage(`[DATA] ${componentName || "Matrix"} payload sent (${reduction}% smaller)`)
    
    return sparseData
  }, [matrix, componentName, addMessage])

  const sendMatrix = useCallback(() => {
    if (clientRef.current && clientRef.current.connected) {
      const message = matrixToString()
      addMessage(`[MQTT] Publishing to ${MQTT_CONFIG.topics.publish}`)

      clientRef.current.publish(MQTT_CONFIG.topics.publish, message, { qos: 1, retain: false }, (err) => {
        if (err) {
          addMessage(`[ERROR] Publish failed: ${err.message}`)
        } else {
          addMessage(`[SUCCESS] Data sent. Waiting for ACK...`)
          pendingSendRef.current = false
        }
      })
    } else {
      pendingSendRef.current = true
    }
  }, [matrixToString, addMessage])

  // Heartbeat monitor loop
  useEffect(() => {
    if (status === "disconnected") return

    heartbeatIntervalRef.current = setInterval(() => {
      if (status === "disconnected" || !clientRef.current?.connected) return
      
      const now = Date.now()
      const timeSinceLastHeartbeat = now - lastHeartbeatRef.current

      if (timeSinceLastHeartbeat > 5000) {
        // More than 5 seconds without a message from ESP32
        if (status === "connected") {
          setStatus("not_online")
          addMessage("[WARNING] ESP32 heartbeat lost. Device not online.")
          if (onConnectionStatus) onConnectionStatus(false)
        }
        
        // Send a ping to try to wake it up
        if (clientRef.current?.connected) {
          clientRef.current.publish(MQTT_CONFIG.topics.publish, "PING", { qos: 0 })
        }
      }
    }, 2000)

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
    }
  }, [status, onConnectionStatus, addMessage])

  const setupMqttClient = useCallback(() => {
    if (!shouldConnect || connectionAttempts.current >= maxConnectionAttempts) return

    setStatus("broker_connecting")
    connectionAttempts.current += 1
    addMessage(`[NETWORK] Attempt ${connectionAttempts.current}/${maxConnectionAttempts}`)

    if (clientRef.current) {
      clientRef.current.end(true)
      clientRef.current = null
    }

    const clientId = `web-client-${Math.random().toString(16).substr(2, 8)}`
    const options = { ...MQTT_CONFIG.options, clientId }

    const mqttClient = mqtt.connect(MQTT_CONFIG.brokerUrl, options)
    clientRef.current = mqttClient

    mqttClient.on("connect", () => {
      addMessage(`[NETWORK] Connected to MQTT broker. Waiting for ESP32...`)
      connectionAttempts.current = 0
      setStatus("esp32_connecting")
      
      mqttClient.subscribe(MQTT_CONFIG.topics.subscribe, (err) => {
        if (!err) {
          // Send initial ping to check if ESP32 is alive
          mqttClient.publish(MQTT_CONFIG.topics.publish, "PING")
        }
      })

      if (pendingSendRef.current) {
        setTimeout(() => sendMatrix(), 500)
      }
    })

    mqttClient.on("reconnect", () => {
      addMessage(`[NETWORK] Reconnecting to broker...`)
      setStatus("broker_connecting")
    })

    mqttClient.on("offline", () => {
      addMessage(`[NETWORK] Broker connection lost`)
      setStatus("disconnected")
      if (onConnectionStatus) onConnectionStatus(false)
    })

    mqttClient.on("message", (topic, message) => {
      const msgStr = message.toString()
      addMessage(`[ESP32] ${msgStr}`)
      
      // Update heartbeat on ANY message from ESP32
      lastHeartbeatRef.current = Date.now()
      
      setStatus((prevStatus) => {
        if (prevStatus !== "connected") {
          addMessage(`[SUCCESS] ESP32 is online and responding!`)
          if (onConnectionStatus) onConnectionStatus(true)
        }
        return "connected"
      })
    })

    mqttClient.on("error", (err) => {
      addMessage(`[ERROR] ${err.message}`)
      if (connectionAttempts.current < maxConnectionAttempts) {
        setTimeout(setupMqttClient, 2000)
      }
    })

    return mqttClient
  }, [shouldConnect, sendMatrix, onConnectionStatus, addMessage])

  useEffect(() => {
    if (shouldConnect) {
      setupMqttClient()
    } else {
      if (clientRef.current) {
        clientRef.current.end(true)
        clientRef.current = null
      }
      setStatus("disconnected")
      if (onConnectionStatus) onConnectionStatus(false)
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.end(true)
        clientRef.current = null
      }
    }
  }, [shouldConnect, setupMqttClient, onConnectionStatus])

  useEffect(() => {
    if (matrix && matrix.length > 0) {
      pendingSendRef.current = true
      
      const timeoutId = setTimeout(() => {
        if (status === "connected" && clientRef.current) {
          sendMatrix()
        }
      }, 300)
      
      return () => clearTimeout(timeoutId)
    }
  }, [matrix, status, sendMatrix])

  useEffect(() => {
    if (triggerSend) {
      pendingSendRef.current = true
      if (status === "connected" && clientRef.current) {
        sendMatrix()
      } else if (shouldConnect && status === "disconnected") {
        setupMqttClient()
      }
    }
  }, [triggerSend, status, shouldConnect, setupMqttClient, sendMatrix])

  const getBadgeProps = () => {
    switch (status) {
      case "connected":
        return { variant: "default" as const, icon: <Check className="h-3 w-3 mr-1" />, text: "Connected" }
      case "not_online":
        return { variant: "destructive" as const, icon: <XCircle className="h-3 w-3 mr-1" />, text: "ESP32 Not Online" }
      case "broker_connecting":
        return { variant: "outline" as const, icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />, text: "Broker..." }
      case "esp32_connecting":
        return { variant: "outline" as const, icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />, text: "Finding ESP32..." }
      default:
        return { variant: "secondary" as const, icon: null, text: "Disconnected" }
    }
  }

  const badge = getBadgeProps()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">ESP32 Status:</div>
        <Badge variant={badge.variant}>
          {badge.icon}
          {badge.text}
        </Badge>
      </div>

      <Alert variant="outline" className="py-2">
        <CircleAlert className="h-4 w-4 mr-1" />
        <AlertDescription className="text-xs">
          {componentName ? `${componentName} data ready for MQTT` : "Matrix data ready for ESP32 display"}
        </AlertDescription>
      </Alert>

      <div className="flex justify-between">
        <Button size="sm" onClick={sendMatrix} disabled={status !== "connected"}>
          Send Data
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            connectionAttempts.current = 0
            setupMqttClient()
          }}
        >
          Reconnect
        </Button>
      </div>

      <div className="border rounded-md p-2 h-32 overflow-y-auto text-xs font-mono bg-muted/30">
        {messages.map((msg, i) => (
          <div key={i} className="text-muted-foreground whitespace-pre-wrap">
            {msg}
          </div>
        ))}
      </div>
    </div>
  )
}
