"use client"

import { useCircuitComponents } from "./circuit-component-context"
import { Check, X } from "lucide-react"
import { motion } from "framer-motion"

export default function ComponentChecklist() {
  const { components, pcbComponents, moveComponentToPcb } = useCircuitComponents()

  if (components.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No components added yet. Drag components from the sidebar to the schematic.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {components.map((component, index) => {
        const isInPcb = pcbComponents.some((c) => c.id === component.id)

        return (
          <motion.div
            key={component.id}
            className={`flex items-center justify-between p-2 rounded-md border ${
              isInPcb ? "border-primary/30 bg-primary/5" : "border-muted"
            } transition-colors duration-300 hover:border-primary/50`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{component.name}</div>
              {component.value && <div className="text-xs text-muted-foreground overflow-hidden">{component.value}</div>}
            </div>
            {!isInPcb ? (
              <button
                onClick={() => moveComponentToPcb(component.id)}
                className="ml-2 p-1 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 rounded transition-colors"
                title="Add to PCB"
              >
                <Check className="h-4 w-4" />
              </button>
            ) : (
              <div className="ml-2 p-1 text-primary">
                <Check className="h-4 w-4" />
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

