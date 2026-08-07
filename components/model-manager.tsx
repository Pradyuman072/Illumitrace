"use client"

import { useState, useEffect } from "react"
import { useCircuitComponents } from "./circuit-component-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, FolderOpen, Trash2, DatabaseZap } from "lucide-react"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function ModelManager() {
  const { data: session } = useSession()
  const [circuits, setCircuits] = useState<any[]>([])
  const [circuitName, setCircuitName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const { schematicComponents, pcbComponents, connections, loadCircuit } = useCircuitComponents()

  const fetchCircuits = async () => {
    if (!session) return
    try {
      const res = await fetch("/api/circuits")
      if (res.ok) {
        const data = await res.json()
        setCircuits(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (isDialogOpen) {
      fetchCircuits()
    }
  }, [isDialogOpen, session])

  const handleSave = async () => {
    if (!circuitName.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/circuits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: circuitName,
          schematicComponents,
          pcbComponents,
          connections
        })
      })
      if (res.ok) {
        setCircuitName("")
        fetchCircuits()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/circuits/${id}`, { method: "DELETE" })
      fetchCircuits()
    } catch (e) {
      console.error(e)
    }
  }

  const handleLoad = async (id: string) => {
    try {
      const res = await fetch(`/api/circuits/${id}`)
      if (res.ok) {
        const data = await res.json()
        loadCircuit(data)
        setIsDialogOpen(false)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSeedDummy = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/circuits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Demo ESP32 Project",
          schematicComponents: [],
          pcbComponents: [],
          connections: []
        })
      })
      if (res.ok) {
        fetchCircuits()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  if (!session) return null;

  return (
    <div className="mt-6 border-t border-primary/20 pt-4">
      <h3 className="text-sm font-medium text-foreground mb-3">Saved Models</h3>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full mb-2 border-primary/50 text-primary hover:bg-primary/20">
            <FolderOpen className="h-4 w-4 mr-2" />
            Manage Models
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Manage Saved Circuits</DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 mb-4 mt-2">
            <Input 
              placeholder="Circuit Name..." 
              value={circuitName}
              onChange={(e) => setCircuitName(e.target.value)}
              className="bg-background"
            />
            <Button onClick={handleSave} disabled={isLoading || !circuitName.trim()}>
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </div>
          
          <div className="flex justify-between items-center text-sm font-medium mb-2 border-b pb-2">
            <span>Your Models</span>
            <Button variant="secondary" size="sm" onClick={handleSeedDummy} disabled={isLoading}>
              <DatabaseZap className="h-4 w-4 mr-2" /> Seed Demo
            </Button>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {circuits.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No models saved yet.</div>
            ) : (
              circuits.map(circuit => (
                <div key={circuit._id} className="flex items-center justify-between p-2 rounded-md border border-border bg-background/50 hover:bg-background transition-colors">
                  <span className="text-sm font-medium">{circuit.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary-foreground hover:bg-primary" onClick={() => handleLoad(circuit._id)}>
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDelete(circuit._id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
