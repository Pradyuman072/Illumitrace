"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"

const DndProviderWithNoSSR = dynamic(() => import("./dnd-provider"), {
  ssr: false,
})

import { Button } from "@/components/ui/button"
import { SidebarProvider } from "@/components/ui/sidebar"
import ComponentSidebar from "@/components/component-sidebar"
import SchematicEditor from "@/components/schematic-editor"
import PcbView from "@/components/pcb-view"
import MqttManager from "@/components/mqtt-manager"
import { CircuitComponentProvider } from "@/components/circuit-component-context"
import SimulationView from "@/components/simulation-view"
import DetailedSimulation from "@/components/detailed-simulation"
import { CircuitBoard, Cpu, Zap, BarChart, CircleHelp, Settings } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"
import ComponentChecklist from "./component-checklist"
import ModelManager from "./model-manager"

export default function CircuitDesigner() {
  const [activeView, setActiveView] = useState<string>("schematic")
  const [isPrototyping, setIsPrototyping] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const viewButtons = useMemo(
    () => [
      {
        id: "schematic",
        icon: Zap,
        label: "Schematic",
        tooltip: "Design your circuit schematic",
      },
      {
        id: "pcb",
        icon: CircuitBoard,
        label: "PCB View",
        tooltip: "View and edit PCB layout",
      },
      ...(isSimulating
        ? [
            {
              id: "simulation",
              icon: Cpu,
              label: "Basic Simulation",
              tooltip: "Run basic circuit simulation",
            },
            {
              id: "detailed-simulation",
              icon: BarChart,
              label: "Detailed Simulation",
              tooltip: "View detailed simulation results",
            },
          ]
        : []),
    ],
    [isSimulating],
  )

  if (!isClient) {
    return null
  }

  return (
    <CircuitComponentProvider>
      <DndProviderWithNoSSR>
        <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <SidebarProvider>
              <ComponentSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="border-b p-2 md:p-4 flex flex-wrap justify-between items-center gap-2 bg-card/50 backdrop-blur-sm">
                  <TooltipProvider>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                      {viewButtons.map((button, index) => (
                        <Tooltip key={button.id}>
                          <TooltipTrigger asChild>
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <Button
                                variant={activeView === button.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveView(button.id)}
                                className={`flex items-center transition-all duration-300 ${
                                  activeView === button.id
                                    ? "bg-primary text-primary-foreground shadow-md dark:glow-hover"
                                    : "hover:border-primary/50 hover:text-primary"
                                }`}
                              >
                                <button.icon
                                  className={`h-4 w-4 mr-2 ${activeView === button.id ? "animate-pulse" : ""}`}
                                />
                                {button.label}
                              </Button>
                            </motion.div>
                          </TooltipTrigger>
                          <TooltipContent>{button.tooltip}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 border-primary/30 text-primary hover:bg-primary/20 transition-all duration-300"
                          >
                            <CircleHelp className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Help & Documentation</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 border-primary/30 text-primary hover:bg-primary/20 transition-all duration-300"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Settings</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            onClick={() => setIsSimulating(!isSimulating)}
                            className="bg-secondary/80 text-secondary-foreground hover:bg-secondary transition-all duration-300"
                          >
                            {isSimulating ? "Stop Simulation" : "Run Simulation"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isSimulating ? "Stop the current simulation" : "Run circuit simulation"}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={isPrototyping ? "destructive" : "default"}
                            onClick={() => setIsPrototyping(!isPrototyping)}
                            className={`transition-all duration-300 ${
                              isPrototyping
                                ? "bg-destructive/90 hover:bg-destructive"
                                : "bg-primary/90 hover:bg-primary dark:glow-hover"
                            }`}
                          >
                            {isPrototyping ? "Stop Prototyping" : "Start Prototyping"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isPrototyping ? "Stop prototyping mode" : "Start physical prototyping"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
                <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
                  <div className="flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeView}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="h-full"
                      >
                        {activeView === "schematic" && <SchematicEditor />}
                        {activeView === "pcb" && <PcbView isPrototyping={isPrototyping} />}
                       
                        {isSimulating && activeView === "simulation" && <SimulationView />}
                        {isSimulating && activeView === "detailed-simulation" && <DetailedSimulation />}
                      </motion.div>
                    </AnimatePresence>
                  </div>
{!isPrototyping&&                  <div className="w-full md:w-64 border-t md:border-t-0 md:border-l overflow-auto bg-card/30 backdrop-blur-sm">
                    <div className="p-4">
                      <h2 className="font-semibold mb-2 text-primary">Components</h2>
                      <ComponentChecklist />
                      <ModelManager />
                    </div>
                  
                  </div>
                   }
                   
                 
                </main>
              </div>
            </SidebarProvider>
          </div>
        </div>
      </DndProviderWithNoSSR>
    </CircuitComponentProvider>
  )
}

