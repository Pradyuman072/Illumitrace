"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Save, Moon, Sun, Monitor, Palette, Grid, Zap, Download, Upload } from "lucide-react"

export default function SettingsPage() {
  const [theme, setTheme] = useState("system")
  const [gridEnabled, setGridEnabled] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [simulationAccuracy, setSimulationAccuracy] = useState(75)
  const [exportFormat, setExportFormat] = useState("gerber")

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Configure your circuit design environment preferences</p>
      </div>

      <Tabs defaultValue="appearance" className="max-w-4xl">
        <TabsList className="mb-6">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="mr-2 h-5 w-5" />
                  Theme Settings
                </CardTitle>
                <CardDescription>Customize the appearance of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sun className="h-5 w-5" />
                      <Label htmlFor="theme-light">Light</Label>
                    </div>
                    <Switch id="theme-light" checked={theme === "light"} onCheckedChange={() => setTheme("light")} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Moon className="h-5 w-5" />
                      <Label htmlFor="theme-dark">Dark</Label>
                    </div>
                    <Switch id="theme-dark" checked={theme === "dark"} onCheckedChange={() => setTheme("dark")} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Monitor className="h-5 w-5" />
                      <Label htmlFor="theme-system">System</Label>
                    </div>
                    <Switch id="theme-system" checked={theme === "system"} onCheckedChange={() => setTheme("system")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <Select defaultValue="blue">
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="ml-auto">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="editor">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Grid className="mr-2 h-5 w-5" />
                  Editor Settings
                </CardTitle>
                <CardDescription>Configure the circuit editor behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="grid-enabled">Show Grid</Label>
                  <Switch id="grid-enabled" checked={gridEnabled} onCheckedChange={setGridEnabled} />
                </div>

                <div className="space-y-2">
                  <Label>Grid Size</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger>
                      <SelectValue placeholder="Select grid size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (10px)</SelectItem>
                      <SelectItem value="medium">Medium (20px)</SelectItem>
                      <SelectItem value="large">Large (40px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-save">Auto Save</Label>
                  <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="snap-to-grid">Snap to Grid</Label>
                    <Checkbox id="snap-to-grid" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-connect">Auto Connect Components</Label>
                    <Checkbox id="auto-connect" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-labels">Show Component Labels</Label>
                    <Checkbox id="show-labels" defaultChecked />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="ml-auto">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="simulation">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="mr-2 h-5 w-5" />
                  Simulation Settings
                </CardTitle>
                <CardDescription>Configure circuit simulation parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="simulation-accuracy">Simulation Accuracy</Label>
                    <span className="text-sm text-muted-foreground">{simulationAccuracy}%</span>
                  </div>
                  <Slider
                    id="simulation-accuracy"
                    min={0}
                    max={100}
                    step={1}
                    value={[simulationAccuracy]}
                    onValueChange={(value) => setSimulationAccuracy(value[0])}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher accuracy provides more precise results but may slow down simulation.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Simulation Engine</Label>
                  <Select defaultValue="spice">
                    <SelectTrigger>
                      <SelectValue placeholder="Select simulation engine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spice">SPICE</SelectItem>
                      <SelectItem value="simplified">Simplified</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <div className="flex items-center space-x-2">
                    <Input type="number" defaultValue="25" className="w-20" />
                    <span>°C</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="real-time-sim">Real-time Simulation</Label>
                  <Switch id="real-time-sim" defaultChecked />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="ml-auto">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="export">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="mr-2 h-5 w-5" />
                  Export Settings
                </CardTitle>
                <CardDescription>Configure export and file format options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Export Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select export format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gerber">Gerber</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="svg">SVG</SelectItem>
                      <SelectItem value="dxf">DXF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Export Resolution (DPI)</Label>
                  <Select defaultValue="300">
                    <SelectTrigger>
                      <SelectValue placeholder="Select resolution" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="150">150 DPI</SelectItem>
                      <SelectItem value="300">300 DPI</SelectItem>
                      <SelectItem value="600">600 DPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-components">Include Component List</Label>
                    <Checkbox id="include-components" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-measurements">Include Measurements</Label>
                    <Checkbox id="include-measurements" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-simulation">Include Simulation Results</Label>
                    <Checkbox id="include-simulation" defaultChecked />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Settings
                </Button>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
