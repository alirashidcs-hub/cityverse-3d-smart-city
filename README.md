# 🌆 CityVerse — AI-Powered 3D Digital Twin & Smart City Platform

<p align="center">
  <strong>Explore. Simulate. Analyze. Predict.</strong>
</p>

<p align="center">
  An interactive 3D Smart City Digital Twin powered by Three.js, React, TypeScript, simulation intelligence, and AI.
</p>

<p align="center">

[🌐 Live Demo](https://cityverse-3d-smart-city.vercel.app/) ·
[💻 GitHub](https://github.com/alirashidcs-hub) ·
[📚 Documentation](./docs)

</p>

---

## 🚀 Live Demo

### 🌐 CityVerse 3D Smart City

**Experience the live application:**

👉 https://cityverse-3d-smart-city.vercel.app/

The live application provides an interactive 3D smart-city environment where users can explore districts, inspect buildings, monitor simulated infrastructure, and run real-time "what-if" scenarios.

### ✨ Live Features

- 🌆 Interactive 3D city
- 🏙️ 8 smart-city districts
- 🏢 Interactive buildings
- 🚗 Animated traffic
- 🚦 Traffic-light simulation
- 🌦️ Dynamic weather
- 🌅 Time-of-day simulation
- 🌙 Dynamic night lighting
- ⚡ Energy monitoring
- 💧 Water monitoring
- 🌫️ Air-quality simulation
- 🎮 Simulation Mode
- 🚧 Construction simulation
- 🚫 Road closure simulation
- 🚨 Emergency simulation
- 📊 City analytics
- 🤖 AI City Assistant
- 🏠 Walkable villa interior
- 🌳 Parks and landscaping
- 🚑 Emergency vehicles
- 🔄 Before/After scenario comparison

---

# 📌 Overview

**CityVerse** is an interactive 3D Smart City Digital Twin and simulation platform.

Instead of displaying smart-city information through a traditional dashboard, CityVerse places the user directly inside a dynamic 3D city.

Users can:

- Explore an interactive city
- Inspect buildings
- Monitor traffic
- Analyze energy usage
- Monitor water systems
- Change weather conditions
- Change time of day
- Simulate emergencies
- Close roads
- Add construction zones
- Increase traffic
- Modify population
- Analyze infrastructure changes
- Ask an AI assistant about the simulated city

The project demonstrates how **3D visualization, simulation systems, AI, and smart-city concepts** can be combined into one interactive platform.

> **Current Status:** CityVerse is a functional prototype using simulated city data. The project includes a documented architecture for future PostgreSQL/Supabase databases, IoT sensors, authentication, persistent simulations, and multi-user functionality.

---

# 🎯 Project Vision

Traditional smart-city platforms often rely heavily on:

- Tables
- Charts
- Maps
- Static dashboards

CityVerse takes a different approach.

The goal is to create a **3D digital twin of a city** where users can visually understand what is happening and experiment with different scenarios.

### Vision

```text
Real / Simulated City Data
          ↓
     Smart City Engine
          ↓
   3D Digital Twin
          ↓
 Simulation Engine
          ↓
 AI Analysis
          ↓
 Decisions & Insights

---

🏙️ City Districts
CityVerse contains eight procedurally generated districts.
District
Purpose

🏙️ Downtown
Skyscrapers, offices and city landmark

🏡 Residential
Houses, apartments and parks

🛍️ Commercial
Shops, restaurants and businesses

🏭 Industrial
Factories, warehouses and logistics

🎓 University
Campus buildings and student areas

✈️ Airport
Airport terminal and transportation

🏥 Hospital
Healthcare infrastructure and emergency services

🛒 Shopping
Shopping centers, retail and pedestrian areas
Each district has different building types, roads, traffic characteristics and infrastructure behavior.

🌆 3D City Experience
The city is generated using Three.js.

The environment includes:
Buildings
Roads
Sidewalks
Curbs
Street lights
Traffic lights
Vehicles
Trees
Parks
Parking areas
Water
Fountains
Landmark tower
Pedestrians
Emergency vehicles

The city is designed to provide an architectural visualization experience rather than a traditional 2D dashboard.

🏢 Building System
CityVerse uses procedural architectural building archetypes.
Current building types include:
Tower
Office
House
Apartment
Mall
Warehouse
University/Campus
Airport Terminal
Hospital
Buildings contain multiple architectural components such as:
Podiums
Bodies
Crowns
Roofs
Balconies
Signs
Windows
Glass sections
Buildings are varied using seeded generation so the city does not contain identical structures everywhere.

🪟 Dynamic Windows
Buildings contain large numbers of instanced window elements.

During the day:
Windows appear as reflective glass.

During the night:
Selected windows illuminate.

Warm and cool lighting variations appear.
Building lighting changes automatically with the time-of-day system.

🛣️ Smart Road Network
CityVerse includes a multi-level road system.

Road types include:
Main roads
Secondary roads
Residential roads
Service roads
Road environments include:
Asphalt
Lane markings
Sidewalks
Curbs
Street lights
Traffic lights
Traffic simulation

🚗 Traffic Simulation
Traffic changes dynamically based on city conditions.
Traffic levels:
🟢 Low
🟡 Moderate
🟠 Heavy
🔴 Severe
Vehicles respond to simulated congestion.

Vehicle types include:
Cars
Buses
Trucks
Emergency vehicles
Road closure simulations can reroute traffic onto alternative roads.

🚦 Traffic Lights
Traffic lights are connected to simulated traffic conditions.
The system can visually reflect changes in:
Traffic volume
Congestion
Road conditions
Simulation scenarios

🌦️ Dynamic Weather
CityVerse supports multiple weather modes.

☀️ Clear
Normal visibility and lighting.

☁️ Cloudy
Reduced environmental brightness.

🌧️ Rain
Includes:
Particle rain
Wet-road appearance
Puddle effects

⛈️ Storm
Includes:
Heavy rain
Fog
Lightning effects
Darker lighting

🌫️ Fog
Dynamic atmospheric fog reduces visibility.

🌅 Time-of-Day Simulation
Users can change the city time.
Supported periods range from:
06:00
08:00
10:00
12:00
16:00
20:00
00:00
Changing the time affects:
Sunlight
Ambient lighting
Building windows
Street lights
Traffic lights
Landmark illumination

🎮 Simulation Mode
Simulation Mode is one of the core CityVerse features.
Users can change:
Traffic
Population
Energy demand
Water demand
Public transport
Construction activity
Weather severity
Example:
Traffic
0% ━━━━━━━━━●━━ 100%

Population
0% ━━━━━━━●━━━━ 100%

Energy
0% ━━━━━━━━━●━━ 100%
Changes immediately affect the simulated city.

🧪 What-If Simulation
CityVerse allows users to experiment with hypothetical situations.
Examples:
What happens if traffic increases by 40%?
What happens if a major road is closed?
What happens if construction starts downtown?
What happens during a power outage?
Which district is affected the most?
🖱️ Drag-to-Simulate
Users can drag simulation effects onto districts.
Example:
Traffic +30%
       ↓
    Downtown
The system calculates a simulated impact.
Results can include:
Traffic change
Affected roads
Estimated delay
Population impact
City score change

🚧 Construction Simulation
Users can place construction zones directly inside the 3D city.
Construction simulations can affect:
Traffic
Population
Roads
Infrastructure
District performance
The application displays a simulated construction timeline.

🚫 Road Closure Simulation
Users can select a road and close it.
CityVerse calculates:
Traffic before closure
Traffic after closure
Estimated delay
Affected districts
Alternative routes
Vehicles visually reroute through alternative roads.

🚨 Emergency Simulation
CityVerse supports multiple emergency scenarios.
Supported Events
🔥 Fire
🌊 Flood
🚗 Traffic accident
⚡ Power outage
💧 Water leak
Emergency simulations display:
Severity
Population affected
Infrastructure affected
Emergency response recommendations
Emergency markers appear directly in the 3D city.

🚑 Emergency Vehicles
Emergency simulations can activate emergency vehicles.
Supported vehicle types include:
Ambulance
Fire truck
Police vehicle
Emergency vehicles can move toward the simulated emergency location.

⚡ Energy System
CityVerse includes an energy visualization system.
Users can inspect:
Building energy usage
District energy consumption
Energy efficiency
Energy flow
Buildings can display energy-related visual indicators.

💧 Water System
The city includes simulated water infrastructure.
Water data can be visualized by district and incorporated into simulations.
Future versions can connect this system to real water sensors.

🌫️ Air Quality
Air quality can vary between districts.
The analytics system provides district-level visualization.
Future versions can connect the system to real:
Air-quality sensors
Weather stations
Environmental monitoring devices

🤖 AI City Assistant
CityVerse includes an AI assistant powered by the Anthropic API.
The assistant receives the current simulated city state as context.
This allows users to ask questions such as:
What is happening in Downtown?

Which district has the highest energy consumption?

What happens if traffic increases by 30%?

Which roads are currently affected?

What happens if this road is closed?

Which district needs infrastructure improvements?
The AI is designed to answer using the actual simulated values instead of relying purely on generic responses.

🧠 AI Grounding Architecture
The AI request flow is:

User
 ↓
CityVerse UI
 ↓
Simulation State
 ↓
/api/assistant
 ↓
Anthropic API
 ↓
AI Response
 ↓
CityVerse UI

The API key is kept server-side.
It is never intended to be exposed to the browser.

📊 Analytics
CityVerse includes analytics for:
Energy consumption
Traffic
Air quality
District performance
City Intelligence Score
Simulation results
Charts help users understand how changes affect the city.

🏆 City Intelligence Score
CityVerse calculates a simulated City Intelligence Score.
The score changes based on simulated conditions such as:
Traffic
Energy
Population
Water
Transport
Weather
Infrastructure
The score provides a simple high-level view of city performance.

🔄 Before / After Comparison
Simulation events can be compared against the baseline.

Example:
CITY SCORE

Before: 87
After: 72

TRAFFIC

Before: 45%
After: 81%

ENERGY

Before: 62%
After: 89%

This allows users to understand the impact of hypothetical decisions.

🏠 Walkable 3D Interior
CityVerse includes a procedural walkable Modern Villa interior.
The interior includes:
Living room
Kitchen
Dining area
Bedroom
Bathroom
Furniture
Doors
Interior lighting
Users can enter the building and explore the interior.
Controls
Desktop:
W / A / S / D
Mouse
Mobile:
Touch controls
Virtual joystick
The interior is loaded only when needed to reduce performance impact.

🌳 Environment
The city environment contains:
Trees
Bushes
Parks
Fountains
Grass areas
Parking areas
Water features
Street furniture
Vegetation is generated using optimized geometry and instancing.

🗼 Downtown Landmark
Downtown includes a custom futuristic landmark tower.
The landmark contains:
Glass facade
Illuminated sections
Tapered structure
Plaza
Fountain
Surrounding landscaping
It acts as the visual centerpiece of the city.

🎥 Camera & Exploration
Users can:
Orbit around the city
Zoom
Rotate
Inspect buildings
Fly toward selected buildings
Explore at street level
Enter selected buildings
The goal is to make the city feel like an explorable digital environment rather than a static visualization.

🗺️ City Layers
Users can independently toggle:
Buildings
Roads
Traffic
Parks
Water
Energy flow
Other visualization layers
This allows users to focus on specific infrastructure systems.

⚡ Performance
Performance is a major consideration.
CityVerse uses:
THREE.InstancedMesh
Shared materials
Procedural geometry
Frustum-friendly scene organization
Lazy interior loading
Efficient lighting
Reusable geometry
Optimized vehicle rendering
The exterior city uses approximately:
~300 draw calls
depending on runtime state.
Large groups such as:
Buildings
Windows
Trees
Vehicles
Lamps
Pedestrians
use instancing where appropriate.

📦 3D Asset Architecture
CityVerse includes a GLB/GLTF asset pipeline.
Current asset registry categories include:
Buildings
Vehicles
Landmarks
Interiors
Environment
External binary assets are not bundled by default.
This avoids accidentally distributing third-party models without verifying their licenses.

🧩 Adding Your Own 3D Models
Place models inside:
public/models/
For example:
public/models/
├── buildings/
│   ├── villa.glb
│   ├── hospital.glb
│   └── office.glb
├── vehicles/
│   ├── car.glb
│   └── ambulance.glb
├── landmarks/
└── interiors/
Then register the model inside:
src/data/modelRegistry.ts
Set:
available: true
and provide:
Model path
License
Source
Scale
LOD information
The application retains procedural fallbacks if a model is unavailable.

🧱 Technology Stack
Frontend
React
TypeScript
Vite
Three.js
Tailwind CSS
Lucide React
Recharts
3D Engine
Three.js
WebGL
InstancedMesh
ShaderMaterial
GLTFLoader
Procedural geometry
AI
Anthropic API
AI City Assistant
Simulation-aware context grounding
Backend
Current:
Vercel Serverless Functions
Planned:
Supabase
PostgreSQL
Realtime
Authentication
Persistent simulation storage
Deployment
Vercel
GitHub

📁 Project Structure

CityVerse/
│
├── api/
│   └── assistant.ts
│
├── docs/
│   ├── architecture.md
│   ├── database-schema.md
│   ├── api-design.md
│   ├── ai-architecture.md
│   ├── iot-integration.md
│   ├── deployment.md
│   └── security.md
│
├── public/
│   ├── favicon.svg
│   └── models/
│
├── src/
│   ├── 3d/
│   │   ├── assets/
│   │   │   └── assetLoader.ts
│   │   ├── controls/
│   │   │   ├── useKeyboardControls.ts
│   │   │   └── TouchJoystick.tsx
│   │   └── interiors/
│   │       └── VillaInterior.tsx
│   │
│   ├── data/
│   │   └── modelRegistry.ts
│   │
│   ├── CityVerse.tsx
│   ├── main.tsx
│   └── index.css
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── .gitignore
└── README.md
⚙️ Installation
Requirements
Install:
Node.js 18+
npm 9+
Git
Check:
node -v
npm -v
git --version

📥 Install Dependencies
Clone the repository:
git clone https://github.com/alirashidcs-hub/cityverse-3d-smart-city.git
Enter the project:
cd cityverse-3d-smart-city
Install dependencies:
npm install

🔐 Environment Variables
Create:
.env
from:
.env.example
Add:
ANTHROPIC_API_KEY=your_anthropic_api_key
The API key must remain private.
Never commit:
.env
The repository's .gitignore already excludes environment secrets.

💻 Run Locally
For frontend-only development:
npm run dev
Then open:
http://localhost:5173
The 3D city and simulation systems will work normally.
The AI assistant requires the serverless API function.

🔌 Run Frontend + API Locally
Install Vercel CLI:
npm install -g vercel
Then:
vercel dev
This allows the Vercel serverless function to run locally together with the frontend.

🧪 Type Check
Run:
npm run typecheck
🏗️ Production Build
Run:
npm run build
This performs:

TypeScript check
       ↓
Vite production build
       ↓
dist/

👀 Preview Production Build
npm run preview
☁️ Deploy to Vercel
The project is designed for Vercel deployment.
Install the Vercel CLI if needed:
npm install -g vercel
First deployment:
vercel
Production deployment:
vercel --prod
Alternatively, import the GitHub repository directly into Vercel.

🔑 Vercel Environment Variables
Inside:
Vercel
→ Project
→ Settings
→ Environment Variables
Add:
ANTHROPIC_API_KEY
with your actual API key.
Do not add the actual key to GitHub.
🔄 GitHub Workflow
After making changes:
git add .
Commit:
git commit -m "feat: improve CityVerse 3D experience"
Push:
git push
If Vercel is connected to the GitHub repository, the new version will automatically deploy.

🗄️ Future Supabase Architecture
The current version does not require a database.
City data is generated client-side using seeded procedural generation.
The planned production architecture is:

User
 ↓
Next.js / React
 ↓
API Layer
 ↓
Supabase
 ↓
PostgreSQL
 ↓
Realtime / IoT
 ↓
City Digital Twin

The future system can support:
User accounts
Saved cities
Persistent simulations
Scenario sharing
Historical data
IoT sensors
Real-time monitoring
Alerts
Reports
Multi-user collaboration
See:
docs/database-schema.md
docs/architecture.md
docs/deployment.md

📡 Future IoT Integration
The architecture is designed to eventually support real smart-city sensors.
Potential sensors:
Traffic sensors
Energy meters
Water meters
Air-quality sensors
Weather stations
Emergency sensors

Future data flow:

IoT Sensors
     ↓
IoT Gateway
     ↓
Backend
     ↓
PostgreSQL / Supabase
     ↓
Realtime Events
     ↓
CityVerse
     ↓
3D Visualization

🔮 Roadmap
Phase 1 — Core 3D City
[x] Procedural city
[x] 8 districts
[x] Buildings
[x] Roads
[x] Traffic
[x] Weather
[x] Time-of-day
[x] City layers
Phase 2 — Smart City Simulation
[x] Simulation Mode
[x] Traffic simulation
[x] Population simulation
[x] Energy simulation
[x] Water simulation
[x] Construction simulation
[x] Road closure
[x] Emergency simulation
[x] Before/After comparison
[x] AI simulation analysis
Phase 3 — Visual Upgrade
[x] Architectural building archetypes
[x] Dynamic windows
[x] Improved roads
[x] Street lighting
[x] Landscaping
[x] Downtown landmark
[x] Vehicles
[x] Emergency vehicles
[x] Weather visual effects
[x] Street-level camera
Phase 4 — Interactive Buildings
[x] GLB/GLTF asset architecture
[x] Model registry
[x] Asset loader
[x] Walkable villa interior
[x] Keyboard controls
[x] Touch controls
[x] Interior lighting
[x] Interior collision
Phase 5 — Production Platform
[ ] Supabase authentication
[ ] PostgreSQL database
[ ] Persistent city data
[ ] Saved simulations
[ ] User accounts
[ ] Real-time data
[ ] IoT integration
[ ] Advanced AI tool calling
[ ] Multi-user collaboration
[ ] Advanced scenario management
Phase 6 — Advanced Digital Twin
[ ] Real geographic data
[ ] GeoJSON integration
[ ] Real GIS layers
[ ] Live traffic data
[ ] Live weather data
[ ] Real sensor feeds
[ ] Predictive analytics
[ ] Machine-learning forecasting
[ ] Digital twin synchronization

🧠 Future AI Capabilities
Future versions can expand the AI assistant into a complete city intelligence engine.
Potential capabilities:
Predictive Traffic
Predict congestion before it happens.
Energy Forecasting
Predict district energy demand.
Emergency Planning
Recommend optimal emergency response locations.
Infrastructure Planning
Recommend:
Hospitals
Schools
Roads
Parks
Charging stations
Public transport
Urban Planning
Ask:
Where should we build a new hospital?

Which district needs another road?

Where should a new school be located?

How can we reduce Downtown congestion?

Which district has the highest energy risk?

🔒 Security
The current prototype keeps the Anthropic API key server-side.
Production architecture will additionally implement:
Authentication
Authorization
Row Level Security
API rate limiting
Input validation
Secure environment variables
Audit logs
Role-based access control
Server-side AI requests
Security documentation:
docs/security.md

📈 Performance Considerations
CityVerse uses several optimization techniques.
Instancing
Large groups of objects share GPU draw calls.
Procedural Generation
No large collection of static model files is required for the base city.
Lazy Loading
Interior scenes are loaded only when required.
Reusable Materials
Materials are shared whenever possible.
Scene Isolation
The main city renderer pauses while the villa interior is active.
LOD Strategy

Future GLB assets can use:

High Detail
    ↓
Medium Detail
    ↓
Low Detail
    ↓
Procedural Fallback

⚠️ Current Prototype Limitations
CityVerse is currently a prototype.
The following are simulated rather than connected to real-world infrastructure:
Traffic data
Energy data
Water data
Air quality
Population
Weather impact
Emergency data
There is currently:
No production database
No user authentication
No real IoT sensor integration
No persistent city state
No multi-user collaboration
The architecture for these capabilities is documented in docs/.

📚 Documentation
Detailed architecture documentation is available in:
docs/
├── architecture.md
├── database-schema.md
├── api-design.md
├── ai-architecture.md
├── iot-integration.md
├── deployment.md
└── security.md

🧪 Build Verification
The project has been verified using:
npm install
npm run typecheck
npm run build
Expected production output:
✓ TypeScript check
✓ Vite build
✓ Production bundle generated
📊 Current Technical Snapshot
Category
Technology
Frontend
React
Language
TypeScript
Build Tool
Vite
3D Engine
Three.js
Charts
Recharts
Styling
Tailwind CSS
Icons
Lucide React
AI
Anthropic API
API
Vercel Serverless
Deployment
Vercel
Source Control
GitHub
Future Database
PostgreSQL / Supabase
Future Realtime
Supabase Realtime
Future IoT
MQTT / IoT Gateway

🌐 Live Application
CityVerse 3D Smart City

🚀 Open the application:
https://cityverse-3d-smart-city.vercel.app/⁠

👨‍💻 Developer
Ali Rashid
Computer Science Student
University of Engineering and Technology (UET) Taxila

📧 Email:
ar2701699@gmail.com

💼 LinkedIn:
https://www.linkedin.com/in/ali-rashid-cs/⁠

⭐ Support the Project
If you find CityVerse interesting:
⭐ Star the repository
🍴 Fork the project
🐛 Report issues
💡 Suggest improvements
🔧 Contribute new features

📜 License
This project is currently a prototype/demo project.
Before distributing or commercializing the project, add an appropriate open-source or proprietary license.

🚀 Final Vision
CityVerse is designed to evolve from a procedural 3D prototype into a complete AI-powered Smart City Digital Twin platform.
The long-term goal is:
                 ┌─────────────────────┐
                 │     REAL CITY       │
                 └──────────┬──────────┘
                            │
                     IoT / GIS / APIs
                            │
                            ▼
                 ┌─────────────────────┐
                 │   CITY DATA LAYER   │
                 │ PostgreSQL/Supabase │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ SIMULATION ENGINE   │
                 └──────────┬──────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
       ┌────────────────┐     ┌────────────────┐
       │ 3D DIGITAL TWIN│     │ AI INTELLIGENCE│
       └────────────────┘     └────────────────┘
                │                       │
                └───────────┬───────────┘
                            ▼
                 ┌─────────────────────┐
                 │ SMART CITY DECISION │
                 │     PLATFORM        │
                 └─────────────────────┘
CityVerse aims to make complex urban systems understandable, interactive, and intelligent through 3D visualization, simulation, and AI.
�
Built with ❤️ using React, TypeScript, Three.js, and AI. 

�
CityVerse — Explore the Future of Smart Cities. 
```
