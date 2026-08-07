"use client"

import { useState, useEffect } from "react"
import { useCircuitComponents } from "./circuit-component-context"
import { Button } from "@/components/ui/button"
import { Play, RefreshCw, TriangleAlert, CircleCheck } from "lucide-react"
import { motion } from "framer-motion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useSimulation } from "./simulation-service"

export default function SimulationView() {
  const { schematicComponents, connections } = useCircuitComponents()
  const { runSimulation, validateCircuit } = useSimulation()
  const [simulationOutput, setSimulationOutput] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null)

  const handleRunSimulation = async () => {
    setIsRunning(true)

    try {
      // First validate the circuit
      const validation = validateCircuit()
      setValidationResult(validation)

      // Generate netlist
      const netlist = `* Circuit netlist generated from schematic\n.include models.lib\n.option TEMP=27\n\n`
      setSimulationOutput(netlist + "\nRunning simulation...\n")

      // Run simulation if valid
      if (validation.valid) {
        const results = await runSimulation()
        setSimulationOutput(results.output)
      } else {
        setSimulationOutput(netlist + `\nSimulation aborted: ${validation.message}\n`)
      }
    } catch (error) {
      console.error("Simulation error:", error)
      setSimulationOutput("Error running simulation. See console for details.")
    } finally {
      setIsRunning(false)
    }
  }

  // Run validation when view is first loaded
  useEffect(() => {
    if (!validationResult) {
      const validation = validateCircuit()
      setValidationResult(validation)
    }
  }, [])

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold mb-2 text-primary">ngspice Simulation</h2>
          <p className="text-sm text-muted-foreground">View simulation results for your circuit using ngspice.</p>
        </div>
        <Button
          onClick={handleRunSimulation}
          disabled={isRunning}
          className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300"
        >
          {isRunning ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          {isRunning ? "Running..." : "Run Simulation"}
        </Button>
      </div>

      {validationResult && (
        <Alert className={`mb-4 ${validationResult.valid ? "bg-green-500/10" : "bg-red-500/10"}`}>
          <div className="flex items-center gap-2">
            {validationResult.valid ? (
              <CircleCheck className="h-5 w-5 text-green-500" />
            ) : (
              <TriangleAlert className="h-5 w-5 text-red-500" />
            )}
            <AlertTitle>{validationResult.valid ? "Circuit Valid" : "Circuit Issues"}</AlertTitle>
          </div>
          <AlertDescription className="mt-2">{validationResult.message}</AlertDescription>
        </Alert>
      )}

      <motion.div
        className="flex-1 border rounded-md p-4 bg-black text-primary font-mono text-sm overflow-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <pre>{simulationOutput || "Preparing simulation..."}</pre>
      </motion.div>

      {schematicComponents.length === 0 && (
        <Alert className="mt-4">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>No components</AlertTitle>
          <AlertDescription>Add components to your schematic to run a simulation.</AlertDescription>
        </Alert>
      )}

      {connections.length === 0 && schematicComponents.length > 0 && (
        <Alert className="mt-4">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>No connections</AlertTitle>
          <AlertDescription>Connect your components to create a complete circuit.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
