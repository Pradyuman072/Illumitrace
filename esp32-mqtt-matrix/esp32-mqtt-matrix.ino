#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <WiFiManager.h>
#include <EEPROM.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// Web server for API
WebServer server(80);

// Fixed MQTT Configuration (like first code)
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* mqtt_client_id = "esp32-led-matrix";
const char* mqtt_subscribe_topic = "esp32/matrix/data";
const char* mqtt_status_topic = "esp32/matrix/status";

// MAX7219 Configuration
#define DIN_PIN 23
#define CS_PIN 5
#define CLK_PIN 18
#define NUM_DEVICES 64
#define NUM_ROWS 64
#define NUM_COLS 64

// MAX7219 Registers
#define REG_NOOP 0x00
#define REG_DECODEMODE 0x09
#define REG_INTENSITY 0x0A
#define REG_SCANLIMIT 0x0B
#define REG_SHUTDOWN 0x0C
#define REG_DISPLAYTEST 0x0F

// Configuration
#define CONFIG_PIN 0
bool setupMode = false;
int custom_brightness = 8;
bool matrixBuffer[NUM_ROWS][NUM_COLS] = { false };
char serialMatrix[16][65];

// Network clients
WiFiClient espClient;
PubSubClient mqttClient(espClient);
WiFiManager wifiManager;

// Animation control
unsigned long previousMillis = 0;
bool showingDefaultAnimation = true;
int defaultPatternIndex = 0;
bool patternsShown[5] = { false };

// WiFiManager Parameters
WiFiManagerParameter custom_brightness_param("brightness", "LED Brightness (0-15)", "8", 2);

// EEPROM Configuration
struct ConfigSettings {
  int brightness;
  uint32_t crc32;
};

void setupAPI();
void handleAPIRequest();
void saveConfigCallback();
bool loadConfig();
uint32_t calculateCRC32(const uint8_t* data, size_t length);
void sendCommand(int device, byte reg, byte data);
void clearDisplay(int device);
void clearAllDisplays();
void setLed(int device, int row, int col, bool state);
void updateLED(int x, int y, bool state);
void updateMatrix();
void callback(char* topic, byte* payload, unsigned int length);
void parseMatrixData(String message);
void parseRowData(String rowData, int row);
void displayMatrixOnSerial();
void reconnect();
void showConnectionAnimation();
void showErrorAnimation();
void movingDots();
void scrollingPattern();
void bouncingBall();
void wavePattern();
void expandingSquares();
// Add these implementations anywhere in your code, preferably with the other animation functions

void showErrorAnimation() {
  clearAllDisplays();
  // Draw X pattern
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < min(NUM_ROWS, NUM_COLS); j++) {
      updateLED(j, j, true);
      updateLED(NUM_COLS - j - 1, j, true);
    }
    updateMatrix();
    delay(200);
    clearAllDisplays();
    updateMatrix();
    delay(200);
  }
}

void showConnectionAnimation() {
  clearAllDisplays();
  // Light up perimeter in sequence
  for (int i = 0; i < NUM_COLS; i++) {
    updateLED(i, 0, true);
    updateLED(i, NUM_ROWS - 1, true);
    if (i % 8 == 0) updateMatrix();
  }
  for (int i = 0; i < NUM_ROWS; i++) {
    updateLED(0, i, true);
    updateLED(NUM_COLS - 1, i, true);
    if (i % 8 == 0) updateMatrix();
  }
  updateMatrix();
  delay(1000);
  clearAllDisplays();
  updateMatrix();
}
typedef void (*PatternFunction)();
PatternFunction patterns[] = { movingDots, scrollingPattern, bouncingBall, wavePattern, expandingSquares };
const int NUM_PATTERNS = sizeof(patterns) / sizeof(patterns[0]);

void setup() {
  Serial.begin(115200);
  EEPROM.begin(sizeof(ConfigSettings) + 16);

  // Hardware initialization
  pinMode(CS_PIN, OUTPUT);
  digitalWrite(CS_PIN, HIGH);
  SPI.begin(CLK_PIN, -1, DIN_PIN, CS_PIN);
  SPI.setFrequency(10000000);

  // WiFi Manager setup
  wifiManager.addParameter(&custom_brightness_param);
  wifiManager.setSaveConfigCallback(saveConfigCallback);

  if (digitalRead(CONFIG_PIN) == LOW || !loadConfig()) {
    startConfigPortal();
  }

  // MAX7219 initialization
  for (int device = 0; device < NUM_DEVICES; device++) {
    sendCommand(device, REG_SHUTDOWN, 0x01);
    sendCommand(device, REG_DISPLAYTEST, 0x00);
    sendCommand(device, REG_DECODEMODE, 0x00);
    sendCommand(device, REG_SCANLIMIT, 0x07);
    sendCommand(device, REG_INTENSITY, custom_brightness);
  }
  clearAllDisplays();

  // Network services
  setupAPI();
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(callback);
  mqttClient.setBufferSize(32768);
}

void loop() {
  server.handleClient();

  if (!mqttClient.connected()) {
    reconnect();
  }
  mqttClient.loop();

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }

  // Default animation handling
  unsigned long currentMillis = millis();
  if (showingDefaultAnimation && currentMillis - previousMillis >= 100) {
    previousMillis = currentMillis;

    if (!patternsShown[defaultPatternIndex]) {
      patterns[defaultPatternIndex]();

      if ((currentMillis / 5000) % NUM_PATTERNS != defaultPatternIndex) {
        patternsShown[defaultPatternIndex] = true;
        defaultPatternIndex = (defaultPatternIndex + 1) % NUM_PATTERNS;

        bool allShown = true;
        for (int i = 0; i < NUM_PATTERNS; i++) {
          if (!patternsShown[i]) allShown = false;
        }
        if (allShown) {
          showingDefaultAnimation = false;
          clearAllDisplays();
        }
      }
    }
  }
}

// MAX7219 Functions (from first code)
void sendCommand(int device, byte reg, byte data) {
  digitalWrite(CS_PIN, LOW);
  for (int i = NUM_DEVICES - 1; i > device; i--) {
    SPI.transfer(REG_NOOP);
    SPI.transfer(0x00);
  }
  SPI.transfer(reg);
  SPI.transfer(data);
  for (int i = device - 1; i >= 0; i--) {
    SPI.transfer(REG_NOOP);
    SPI.transfer(0x00);
  }
  digitalWrite(CS_PIN, HIGH);
}

void updateLED(int x, int y, bool state) {
  if (x < 0 || x >= NUM_COLS || y < 0 || y >= NUM_ROWS) return;
  matrixBuffer[y][x] = state;
  int moduleX = x / 8;
  int moduleY = y / 8;
  int device = moduleY * 8 + moduleX;
  setLed(device, y % 8, x % 8, state);
}

// MQTT Callback (fixed to handle PING/heartbeat separately from matrix data)
void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) message += (char)payload[i];

  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  Serial.println(message);

  // Handle heartbeat/control messages separately from matrix data
  if (message == "PING") {
    mqttClient.publish(mqtt_status_topic, "PONG");
    return; // don't touch the matrix or run parseMatrixData on this
  }

  mqttClient.publish(mqtt_status_topic, "Processing matrix data...");

  parseMatrixData(message);
  displayMatrixOnSerial();
  updateMatrix();
  showingDefaultAnimation = false;
  mqttClient.publish(mqtt_status_topic, "Matrix updated successfully");
}
// Configuration Functions (from second code)
void startConfigPortal() {
  setupMode = true;
  showConfigModeAnimation();
  wifiManager.setConfigPortalTimeout(180);
  wifiManager.addParameter(&custom_brightness_param);
  wifiManager.setSaveConfigCallback(saveConfigCallback);

  if (!wifiManager.startConfigPortal("ESP32_LED_Matrix", "ledmatrix")) {
    ESP.restart();
  }

  custom_brightness = atoi(custom_brightness_param.getValue());
  for (int device = 0; device < NUM_DEVICES; device++) {
    sendCommand(device, REG_INTENSITY, custom_brightness);
  }
  setupMode = false;
}

bool loadConfig() {
  ConfigSettings settings;
  EEPROM.get(0, settings);
  if (settings.crc32 != calculateCRC32((uint8_t*)&settings, sizeof(settings) - 4)) {
    return false;
  }
  custom_brightness = settings.brightness;
  return true;
}

void saveConfigCallback() {
  ConfigSettings settings;
  settings.brightness = atoi(custom_brightness_param.getValue());
  settings.crc32 = calculateCRC32((uint8_t*)&settings, sizeof(settings) - 4);
  EEPROM.put(0, settings);
  EEPROM.commit();
}
// ... [Keep all the previous includes and declarations above] ...

void setupAPI() {
  server.on("/api/matrix", HTTP_POST, handleAPIRequest);
  server.begin();
  Serial.println("HTTP server started");
}

void handleAPIRequest() {
  setupCORS();
  if (server.method() == HTTP_OPTIONS) {
    server.send(200, "text/plain", "");
    return;
  }

  String message = server.arg("plain");
  parseMatrixData(message);
  updateMatrix();
  server.send(200, "application/json", "{\"status\":\"OK\"}");
}

void setupCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
}

uint32_t calculateCRC32(const uint8_t* data, size_t length) {
  uint32_t crc = 0xffffffff;
  while (length--) {
    uint8_t c = *data++;
    for (uint32_t i = 0x80; i > 0; i >>= 1) {
      bool bit = crc & 0x80000000;
      if (c & i) bit = !bit;
      crc <<= 1;
      if (bit) crc ^= 0x04c11db7;
    }
  }
  return crc;
}

void clearDisplay(int device) {
  for (int i = 0; i < 8; i++) {
    sendCommand(device, i + 1, 0x00);
  }
}

void clearAllDisplays() {
  for (int device = 0; device < NUM_DEVICES; device++) {
    clearDisplay(device);
  }
  memset(matrixBuffer, 0, sizeof(matrixBuffer));
}

void setLed(int device, int row, int col, bool state) {
  byte data = 0;
  for (int c = 0; c < 8; c++) {
    int actualCol = c + (device % 8) * 8;
    int actualRow = row + (device / 8) * 8;
    if (actualCol < NUM_COLS && actualRow < NUM_ROWS && matrixBuffer[actualRow][actualCol]) {
      data |= (1 << c);
    }
  }
  if (state) data |= (1 << col);
  else data &= ~(1 << col);
  sendCommand(device, row + 1, data);
}

void updateMatrix() {
  for (int moduleY = 0; moduleY < 8; moduleY++) {
    for (int moduleX = 0; moduleX < 8; moduleX++) {
      int device = moduleY * 8 + moduleX;
      for (int row = 0; row < 8; row++) {
        byte rowData = 0;
        for (int col = 0; col < 8; col++) {
          int x = col + moduleX * 8;
          int y = row + moduleY * 8;
          if (x < NUM_COLS && y < NUM_ROWS && matrixBuffer[y][x]) {
            rowData |= (1 << col);
          }
        }
        sendCommand(device, row + 1, rowData);
      }
    }
  }
}

void parseMatrixData(String message) {
  // Always clear the matrix first (equivalent to old dense format filled with 0s)
  memset(matrixBuffer, 0, sizeof(matrixBuffer));
  
  if (message.length() == 0) {
    return; // Empty payload just clears the display
  }

  int startPos = 0;
  while (startPos < message.length()) {
    int endPos = message.indexOf(';', startPos);
    if (endPos == -1) endPos = message.length();
    
    String triplet = message.substring(startPos, endPos);
    
    // Expected format: "x,y,value"
    int firstComma = triplet.indexOf(',');
    int secondComma = triplet.indexOf(',', firstComma + 1);
    
    if (firstComma != -1 && secondComma != -1) {
      int x = triplet.substring(0, firstComma).toInt();
      int y = triplet.substring(firstComma + 1, secondComma).toInt();
      int val = triplet.substring(secondComma + 1).toInt();
      
      // Ensure bounds check before assigning to global buffer
      if (x >= 0 && x < NUM_COLS && y >= 0 && y < NUM_ROWS) {
        // As before, any non-zero value turns the LED on
        matrixBuffer[y][x] = (val != 0); 
      }
    }

    startPos = endPos + 1;
  }
}

void displayMatrixOnSerial() {
  Serial.println("\nMatrix Preview:");
  for (int y = 0; y < 16; y++) {
    for (int x = 0; x < 64; x++) {
      Serial.print(matrixBuffer[y][x] ? "#" : ".");
    }
    Serial.println();
  }
}

void reconnect() {
  String statusTopic = String(mqtt_status_topic);
  String subscribeTopic = String(mqtt_subscribe_topic);

  while (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (mqttClient.connect(mqtt_client_id)) {
      Serial.println("connected");
      mqttClient.subscribe(subscribeTopic.c_str());
      mqttClient.publish(statusTopic.c_str(), "Ready");
      showConnectionAnimation();
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 5 seconds");
      showErrorAnimation();
      delay(5000);
    }
  }
}


void showConfigModeAnimation() {
  clearAllDisplays();
  for (int y = 0; y < NUM_ROWS; y++) {
    for (int x = 0; x < NUM_COLS; x++) {
      if ((x + y) % 16 == 0) updateLED(x, y, true);
    }
  }
}

// Animation Patterns
void movingDots() {
  static int pos = 0;
  clearAllDisplays();
  for (int i = 0; i < 8; i++) {
    int x = (pos + i * 8) % 64;
    int y = (pos + i * 4) % 64;
    updateLED(x, y, true);
    updateLED(63 - x, 63 - y, true);
  }
  pos = (pos + 1) % 64;
}

void scrollingPattern() {
  static int offset = 0;
  clearAllDisplays();
  for (int x = 0; x < NUM_COLS; x++) {
    for (int y = 0; y < NUM_ROWS; y++) {
      if ((x + y + offset) % 16 < 8) {
        updateLED(x, y, true);
      }
    }
  }
  offset = (offset + 1) % 16;
}

void bouncingBall() {
  static float x = 10, y = 10, dx = 1.2, dy = 0.8;
  clearAllDisplays();
  x += dx;
  y += dy;
  if (x < 0 || x >= NUM_COLS) dx *= -1;
  if (y < 0 || y >= NUM_ROWS) dy *= -1;
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      updateLED((int)x + i, (int)y + j, true);
    }
  }
}

void wavePattern() {
  static float phase = 0;
  clearAllDisplays();
  for (int x = 0; x < NUM_COLS; x++) {
    int y = (int)(NUM_ROWS / 2 + (NUM_ROWS / 4) * sin(x / 8.0 + phase));
    for (int i = -1; i <= 1; i++) {
      updateLED(x, y + i, true);
    }
  }
  phase += 0.1;
}

void expandingSquares() {
  static int size = 0;
  clearAllDisplays();
  for (int s = size; s < size + 8; s++) {
    for (int x = NUM_COLS / 2 - s; x < NUM_COLS / 2 + s; x++) {
      updateLED(x, NUM_ROWS / 2 - s, true);
      updateLED(x, NUM_ROWS / 2 + s, true);
    }
    for (int y = NUM_ROWS / 2 - s; y < NUM_ROWS / 2 + s; y++) {
      updateLED(NUM_COLS / 2 - s, y, true);
      updateLED(NUM_COLS / 2 + s, y, true);
    }
  }
  size = (size + 1) % 28;
}