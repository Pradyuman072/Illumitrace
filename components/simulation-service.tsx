"use client"

import { useCircuitComponents } from "./circuit-component-context"

// This is a simplified simulation service that would normally interface with ngspice
export function useSimulation() {
  const { schematicComponents, connections } = useCircuitComponents()

  const generateNetlist = () => {
    let netlist = "* Circuit netlist generated from schematic\n"

    // Create a map of node connections
    const nodeMap = new Map()
    let nodeCounter = 1

    // First pass: assign node numbers to all pins
    connections.forEach((connection) => {
      const startComponent = schematicComponents.find((c) => c.id === connection.start)
      const endComponent = schematicComponents.find((c) => c.id === connection.end)

      if (startComponent && endComponent) {
        // Find the connected pins based on position
        const startPin = findPinByPosition(startComponent, connection.startPos)
        const endPin = findPinByPosition(endComponent, connection.endPos)

        if (startPin && endPin) {
          // Create a unique ID for each pin
          const startPinId = `${connection.start}-${startPin.type}-${startPin.x}-${startPin.y}`
          const endPinId = `${connection.end}-${endPin.type}-${endPin.x}-${endPin.y}`

          // Assign the same node number to connected pins
          if (!nodeMap.has(startPinId) && !nodeMap.has(endPinId)) {
            // Neither pin has a node number yet, assign a new one
            nodeMap.set(startPinId, nodeCounter)
            nodeMap.set(endPinId, nodeCounter)
            nodeCounter++
          } else if (nodeMap.has(startPinId) && !nodeMap.has(endPinId)) {
            // Start pin already has a node number, use it for end pin
            nodeMap.set(endPinId, nodeMap.get(startPinId))
          } else if (!nodeMap.has(startPinId) && nodeMap.has(endPinId)) {
            // End pin already has a node number, use it for start pin
            nodeMap.set(startPinId, nodeMap.get(endPinId))
          }
          // If both pins already have node numbers, they should be the same
          // This is handled by the connection logic
        }
      }
    })

    // Assign node numbers to unconnected pins
    schematicComponents.forEach((component) => {
      component.footprint.pins.forEach((pin) => {
        const pinId = `${component.id}-${pin.type}-${pin.x}-${pin.y}`
        if (!nodeMap.has(pinId)) {
          nodeMap.set(pinId, nodeCounter++)
        }
      })
    })

    // Second pass: generate component definitions with correct node numbers
    schematicComponents.forEach((component, index) => {
      switch (component.type) {
        case "resistor":
          // Find positive and negative pins
          const rPosPin = component.footprint.pins.find((p) => p.type === "positive") || component.footprint.pins[0]
          const rNegPin = component.footprint.pins.find((p) => p.type === "negative") || component.footprint.pins[1]

          const rPosPinId = `${component.id}-${rPosPin.type}-${rPosPin.x}-${rPosPin.y}`
          const rNegPinId = `${component.id}-${rNegPin.type}-${rNegPin.x}-${rNegPin.y}`

          const rPosNode = nodeMap.get(rPosPinId) || 0
          const rNegNode = nodeMap.get(rNegPinId) || 0

          netlist += `R${index} ${rPosNode} ${rNegNode} ${component.resistance || "1k"}\n`
          break

        case "capacitor":
          // Find positive and negative pins
          const cPosPin = component.footprint.pins.find((p) => p.type === "positive") || component.footprint.pins[0]
          const cNegPin = component.footprint.pins.find((p) => p.type === "negative") || component.footprint.pins[1]

          const cPosPinId = `${component.id}-${cPosPin.type}-${cPosPin.x}-${cPosPin.y}`
          const cNegPinId = `${component.id}-${cNegPin.type}-${cNegPin.x}-${cNegPin.y}`

          const cPosNode = nodeMap.get(cPosPinId) || 0
          const cNegNode = nodeMap.get(cNegPinId) || 0

          netlist += `C${index} ${cPosNode} ${cNegNode} ${component.capacitance || "10u"}\n`
          break

        case "inductor":
          // Find positive and negative pins
          const lPosPin = component.footprint.pins.find((p) => p.type === "positive") || component.footprint.pins[0]
          const lNegPin = component.footprint.pins.find((p) => p.type === "negative") || component.footprint.pins[1]

          const lPosPinId = `${component.id}-${lPosPin.type}-${lPosPin.x}-${lPosPin.y}`
          const lNegPinId = `${component.id}-${lNegPin.type}-${lNegPin.x}-${lNegPin.y}`

          const lPosNode = nodeMap.get(lPosPinId) || 0
          const lNegNode = nodeMap.get(lNegPinId) || 0

          netlist += `L${index} ${lPosNode} ${lNegNode} ${component.inductance || "10m"}\n`
          break

        case "diode":
          // Find positive (anode) and negative (cathode) pins
          const dPosPin = component.footprint.pins.find((p) => p.type === "positive") || component.footprint.pins[0]
          const dNegPin = component.footprint.pins.find((p) => p.type === "negative") || component.footprint.pins[1]

          const dPosPinId = `${component.id}-${dPosPin.type}-${dPosPin.x}-${dPosPin.y}`
          const dNegPinId = `${component.id}-${dNegPin.type}-${dNegPin.x}-${dNegPin.y}`

          const dPosNode = nodeMap.get(dPosPinId) || 0
          const dNegNode = nodeMap.get(dNegPinId) || 0

          netlist += `D${index} ${dPosNode} ${dNegNode} 1N4148\n`
          break

        case "transistor":
          // For transistors, we need to handle 3 pins (collector, base, emitter)
          const pins = component.footprint.pins
          if (pins.length >= 3) {
            const collectorPin = pins.find((p) => p.type === "positive") || pins[0]
            const basePin = pins.find((p) => p.type === "other") || pins[1]
            const emitterPin = pins.find((p) => p.type === "negative") || pins[2]

            const collectorPinId = `${component.id}-${collectorPin.type}-${collectorPin.x}-${collectorPin.y}`
            const basePinId = `${component.id}-${basePin.type}-${basePin.x}-${basePin.y}`
            const emitterPinId = `${component.id}-${emitterPin.type}-${emitterPin.x}-${emitterPin.y}`

            const collectorNode = nodeMap.get(collectorPinId) || 0
            const baseNode = nodeMap.get(basePinId) || 0
            const emitterNode = nodeMap.get(emitterPinId) || 0

            netlist += `Q${index} ${collectorNode} ${baseNode} ${emitterNode} 2N2222\n`
          }
          break

        case "led":
          // LEDs are diodes with different model
          const ledPosPin = component.footprint.pins.find((p) => p.type === "positive") || component.footprint.pins[0]
          const ledNegPin = component.footprint.pins.find((p) => p.type === "negative") || component.footprint.pins[1]

          const ledPosPinId = `${component.id}-${ledPosPin.type}-${ledPosPin.x}-${ledPosPin.y}`
          const ledNegPinId = `${component.id}-${ledNegPin.type}-${ledNegPin.x}-${ledNegPin.y}`

          const ledPosNode = nodeMap.get(ledPosPinId) || 0
          const ledNegNode = nodeMap.get(ledNegPinId) || 0

          netlist += `D${index} ${ledPosNode} ${ledNegNode} LED\n`
          break

        case "switch":
          const swPosPin = component.footprint.pins.find((p) => p.type === "positive") || component.footprint.pins[0]
          const swNegPin = component.footprint.pins.find((p) => p.type === "negative") || component.footprint.pins[1]

          const swPosPinId = `${component.id}-${swPosPin.type}-${swPosPin.x}-${swPosPin.y}`
          const swNegPinId = `${component.id}-${swNegPin.type}-${swNegPin.x}-${swNegPin.y}`

          const swPosNode = nodeMap.get(swPosPinId) || 0
          const swNegNode = nodeMap.get(swNegPinId) || 0

          netlist += `S${index} ${swPosNode} ${swNegNode} 0 1 SWITCH\n`
          break

        case "transformer":
          // Transformers have multiple pins for primary and secondary windings
          const tPins = component.footprint.pins
          if (tPins.length >= 4) {
            // Primary winding
            const p1Pin = tPins[0]
            const p2Pin = tPins[1]
            // Secondary winding
            const s1Pin = tPins[2]
            const s2Pin = tPins[3]

            const p1PinId = `${component.id}-${p1Pin.type}-${p1Pin.x}-${p1Pin.y}`
            const p2PinId = `${component.id}-${p2Pin.type}-${p2Pin.x}-${p2Pin.y}`
            const s1PinId = `${component.id}-${s1Pin.type}-${s1Pin.x}-${s1Pin.y}`
            const s2PinId = `${component.id}-${s2Pin.type}-${s2Pin.x}-${s2Pin.y}`

            const p1Node = nodeMap.get(p1PinId) || 0
            const p2Node = nodeMap.get(p2PinId) || 0
            const s1Node = nodeMap.get(s1PinId) || 0
            const s2Node = nodeMap.get(s2PinId) || 0

            // In ngspice, transformers are modeled as coupled inductors
            netlist += `L${index}p ${p1Node} ${p2Node} 1m\n`
            netlist += `L${index}s ${s1Node} ${s2Node} 1m\n`
            netlist += `K${index} L${index}p L${index}s 0.99\n`
          }
          break

        case "power_supply":
          const vPosPin = component.footprint.pins.find((p) => p.type === "positive") || component.footprint.pins[0]
          const vNegPin = component.footprint.pins.find((p) => p.type === "negative") || component.footprint.pins[1]

          const vPosPinId = `${component.id}-${vPosPin.type}-${vPosPin.x}-${vPosPin.y}`
          const vNegPinId = `${component.id}-${vNegPin.type}-${vNegPin.x}-${vNegPin.y}`

          const vPosNode = nodeMap.get(vPosPinId) || 0
          const vNegNode = nodeMap.get(vNegPinId) || 0

          netlist += `V${index} ${vPosNode} ${vNegNode} DC ${component.voltage || "5"}V\n`
          break

        default:
          break
      }
    })

    // Add a default voltage source if none exists
    if (!schematicComponents.some((c) => c.type === "power_supply")) {
      netlist += "V1 1 0 DC 5V\n"
    }

    // Add analysis commands
    netlist += "\n* Analysis commands\n"
    netlist += ".tran 1u 10m\n"
    netlist += ".control\n"
    netlist += "run\n"
    netlist += "plot v(1) v(2)\n"
    netlist += ".endc\n"
    netlist += ".end\n"

    return netlist
  }

  // Helper function to find a pin based on position
  const findPinByPosition = (component, position) => {
    if (!component || !position || !component.footprint || !component.footprint.pins) {
      return null
    }

    // Find the pin closest to the connection position
    let closestPin = null
    let minDistance = Number.POSITIVE_INFINITY

    component.footprint.pins.forEach((pin) => {
      // Calculate pin position relative to component position
      const pinX = component.x + pin.x
      const pinY = component.y + pin.y

      // Calculate distance to connection position
      const distance = Math.sqrt(Math.pow(pinX - position.x, 2) + Math.pow(pinY - position.y, 2))

      if (distance < minDistance) {
        minDistance = distance
        closestPin = pin
      }
    })

    return closestPin
  }

  // Function to check if the circuit is valid
  const validateCircuit = () => {
    // Check if there's at least one power source
    const hasPowerSource = schematicComponents.some(
      (c) => c.type === "power_supply" || c.type === "battery" || c.type === "voltage_source",
    )

    if (!hasPowerSource) {
      return {
        valid: false,
        message: "Circuit needs a power source (battery or power supply)",
      }
    }

    // Check if all components have at least one connection
    const disconnectedComponents = schematicComponents.filter((component) => {
      return !connections.some((conn) => conn.start === component.id || conn.end === component.id)
    })

    if (disconnectedComponents.length > 0) {
      return {
        valid: false,
        message: `${disconnectedComponents.length} component(s) are not connected to the circuit`,
      }
    }

    // Check for positive to negative connections
    const invalidConnections = connections.filter((connection) => {
      const startComponent = schematicComponents.find((c) => c.id === connection.start)
      const endComponent = schematicComponents.find((c) => c.id === connection.end)

      if (startComponent && endComponent) {
        const startPin = findPinByPosition(startComponent, connection.startPos)
        const endPin = findPinByPosition(endComponent, connection.endPos)

        // Check if we're connecting a positive pin to a negative pin
        if (startPin && endPin) {
          // Valid connections: positive to negative, or any to "other"
          const isValid =
            (startPin.type === "positive" && endPin.type === "negative") ||
            (startPin.type === "negative" && endPin.type === "positive") ||
            startPin.type === "other" ||
            endPin.type === "other"

          return !isValid
        }
      }

      return false
    })

    if (invalidConnections.length > 0) {
      return { 
        valid: false,
        message: `${invalidConnections.length} invalid connection(s) found (check terminal polarities)`,
      }
    }

    return { valid: true, message: "Circuit is valid" }
  }

  const runSimulation = async () => {
    // First validate the circuit
    const validation = validateCircuit()
    if (!validation.valid) {
      return {
        success: false,
        output: `
* Circuit validation failed
${validation.message}

Please fix the issues and try again.
        `,
        plots: [],
        validation,
      }
    }

    const netlist = generateNetlist()

    // In a real implementation, this would send the netlist to a server
    // that runs ngspice and returns the results
    console.log("Running simulation with netlist:", netlist)

    // Simulate a delay for the simulation to run
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Generate some sample waveform data
    const timePoints = 100
    const time = Array.from({ length: timePoints }, (_, i) => i * 0.1)
    const voltage = Array.from({ length: timePoints }, (_, i) => {
      const t = i * 0.1
      return 5 * (1 - Math.exp(-t / 2)) * (Math.random() * 0.1 + 0.95)
    })
    const current = Array.from({ length: timePoints }, (_, i) => {
      const t = i * 0.1
      return 0.01 * (1 - Math.exp(-t / 1.5)) * (Math.random() * 0.1 + 0.95)
    })

    // Return simulated results
    return {
      success: true,
      output: `
* Circuit simulation with ngspice
${netlist}

Running simulation...
Temperature: 27.0 C

Transient analysis... 100%
Simulation completed successfully.

Maximum voltage at node vcc: 5.0V
Minimum voltage at node vcc: 0.0V
Rise time: 2.3ms
      `,
      plots: [
        {
          title: "Voltage vs Time",
          data: time.map((t, i) => ({ time: t, voltage: voltage[i] })),
        },
      ],
      waveforms: { time, voltage, current },
      voltages: schematicComponents.map((component, i) => ({
        componentId: component.id,
        voltage: 5 * Math.random(),
      })),
      currents: schematicComponents.map((component, i) => ({
        componentId: component.id,
        current: 0.01 * Math.random(),
      })),
      validation,
    }
  }

  return {
    generateNetlist,
    runSimulation,
    validateCircuit,
  }
}
